import path from "node:path";
import {
  Project,
  Node,
  SourceFile,
  SyntaxKind,
  FunctionDeclaration,
  MethodDeclaration,
  ArrowFunction,
  FunctionExpression,
} from "ts-morph";
import type {
  FunctionNode,
  ForwardEdge,
  ModuleNode,
  NextClassification,
  FunctionKind,
} from "./types.ts";
import {
  resolveCallTarget,
  resolveJsxTarget,
  resolveNewTarget,
  repoRelative,
  buildFunctionId,
} from "./resolve.ts";

const APP_SPECIAL_FILENAMES = new Set([
  "page",
  "layout",
  "loading",
  "error",
  "not-found",
  "template",
]);

const HTTP_VERBS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export type ExtractInput = {
  repoRoot: string;
  tsConfigFilePath: string;
  // Files to walk (absolute paths). If omitted, the generator walks every source file under `srcDir`.
  files?: string[];
  srcDir: string;
};

export type ExtractOutput = {
  modules: ModuleNode[];
  // For ID assignment: declarations indexed by (declPath, declName) -> count.
  // Populated during walking; consumed by `assignIds`.
  duplicates: Set<string>;
};

function getRoot(repoRoot: string, srcDir: string, absPath: string): string {
  const relSrc = path.relative(srcDir, absPath).split(path.sep);
  const srcRel = repoRelative(repoRoot, srcDir);
  // middleware.ts is the only file directly under src/. Route to src/server so we keep 8 roots,
  // not 9 — middleware is server-runtime request interception, conceptually adjacent to server actions.
  if (relSrc.length === 1 && relSrc[0] === "middleware.ts") return `${srcRel}/server`;
  if (relSrc.length === 1) return srcRel;
  return `${srcRel}/${relSrc[0]}`;
}

function fileLevelClassification(
  sf: SourceFile,
  repoRoot: string,
  srcDir: string
): NextClassification[] {
  const tags: NextClassification[] = [];
  const text = sf.getFullText();
  const firstNonComment = text.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  const useClient = /^["']use client["']/.test(firstNonComment);
  const useServer = /^["']use server["']/.test(firstNonComment);

  const relFromSrc = path.relative(srcDir, sf.getFilePath()).split(path.sep);
  const fname = path.basename(sf.getFilePath(), path.extname(sf.getFilePath()));
  const inApp = relFromSrc[0] === "app";
  const isMiddleware =
    sf.getFilePath() === path.join(srcDir, "middleware.ts") ||
    sf.getFilePath() === path.join(repoRoot, "middleware.ts");

  if (isMiddleware) tags.push("middleware");
  if (useClient) tags.push("client-component");
  if (useServer) tags.push("server-action");

  if (inApp) {
    if (fname === "route") {
      const hasVerb = sf.getExportSymbols().some((s) => HTTP_VERBS.has(s.getName()));
      if (hasVerb) tags.push("route-handler");
    } else if (APP_SPECIAL_FILENAMES.has(fname)) {
      tags.push(fname as NextClassification);
    } else if (!useClient) {
      // Non-special file in app/ without "use client" is a Server Component module.
      tags.push("server-component");
    }
  }

  // No specific Next.js tag fired -> mark as "regular" so every module has at least one classification.
  if (tags.length === 0) tags.push("regular");
  return tags;
}

type RawFnSeed = {
  name: string;
  kind: FunctionKind;
  line: number;
  bodyNode: Node;
  exported: boolean;
  functionLevelUseServer: boolean;
};

function isExported(node: Node): boolean {
  // `getExportKeyword`-style fast path; falls back to `isExported` symbol check via VariableStatement parent.
  const maybe = node as unknown as { hasExportKeyword?: () => boolean; isExported?: () => boolean };
  if (typeof maybe.hasExportKeyword === "function" && maybe.hasExportKeyword()) return true;
  if (typeof maybe.isExported === "function" && maybe.isExported()) return true;
  return false;
}

// Collect top-level function-bearing declarations from a source file.
function collectFunctions(sf: SourceFile): RawFnSeed[] {
  const seeds: RawFnSeed[] = [];

  for (const fn of sf.getFunctions()) {
    const name = fn.getName();
    if (!name) continue;
    seeds.push({
      name,
      kind: "function",
      line: fn.getStartLineNumber(),
      bodyNode: fn,
      exported: isExported(fn),
      functionLevelUseServer: hasUseServerDirective(fn),
    });
  }

  for (const decl of sf.getVariableDeclarations()) {
    const init = decl.getInitializer();
    if (!init) continue;
    if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
      const stmt = decl.getVariableStatement();
      seeds.push({
        name: decl.getName(),
        kind: "arrow",
        line: decl.getStartLineNumber(),
        bodyNode: init,
        exported: stmt ? isExported(stmt) : false,
        functionLevelUseServer: hasUseServerDirective(init),
      });
    }
  }

  for (const cls of sf.getClasses()) {
    const clsName = cls.getName();
    if (clsName) {
      // Emit a node for the class itself so `new ClassName(...)` lands on a tracked target.
      seeds.push({
        name: clsName,
        kind: "function",
        line: cls.getStartLineNumber(),
        bodyNode: cls,
        exported: isExported(cls),
        functionLevelUseServer: false,
      });
    }
    for (const m of cls.getMethods()) {
      const mName = m.getName();
      if (!mName) continue;
      seeds.push({
        name: `${clsName ?? "<anon>"}.${mName}`,
        kind: "method",
        line: m.getStartLineNumber(),
        bodyNode: m,
        // Class methods inherit the class's export visibility; non-public methods are still "exported"
        // from a call-graph perspective because they can be invoked from anywhere the class is.
        exported: clsName ? isExported(cls) : false,
        functionLevelUseServer: hasUseServerDirective(m),
      });
    }
  }

  return seeds;
}

function hasUseServerDirective(
  fn: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression
): boolean {
  const body = (fn as { getBody?: () => Node | undefined }).getBody?.();
  if (!body || !Node.isBlock(body)) return false;
  const stmts = body.getStatements();
  if (stmts.length === 0) return false;
  const first = stmts[0];
  if (!Node.isExpressionStatement(first)) return false;
  const expr = first.getExpression();
  if (!Node.isStringLiteral(expr)) return false;
  return expr.getLiteralValue() === "use server";
}

// React component pragma: capitalised name AND returns JSX (or contains a JSX expression in body).
function isComponent(name: string, body: Node): boolean {
  if (!name) return false;
  const first = name.split(".").pop() ?? name;
  if (first[0] !== first[0].toUpperCase() || /^[^A-Za-z]/.test(first)) return false;
  // Cheap proxy: any JSX descendant inside the body.
  let found = false;
  body.forEachDescendant((d, traversal) => {
    if (
      d.getKind() === SyntaxKind.JsxElement ||
      d.getKind() === SyntaxKind.JsxSelfClosingElement ||
      d.getKind() === SyntaxKind.JsxFragment
    ) {
      found = true;
      traversal.stop();
    }
  });
  return found;
}

function collectForwardEdges(
  repoRoot: string,
  bodyNode: Node
): { edges: ForwardEdge[]; unresolved: number; pendingInternal: PendingInternalEdge[] } {
  const edges: ForwardEdge[] = [];
  const pendingInternal: PendingInternalEdge[] = [];
  let unresolved = 0;

  const addInternal = (kind: ForwardEdge["kind"], declPath: string, declName: string, declLine: number) => {
    pendingInternal.push({ kind, declPath, declName, declLine });
  };

  const visit = (node: Node) => {
    const kind = node.getKind();
    if (kind === SyntaxKind.CallExpression) {
      const ce = node.asKindOrThrow(SyntaxKind.CallExpression);
      const callee = ce.getExpression();
      const edgeKind = callee.getKind() === SyntaxKind.ImportKeyword ? "dynamic-import" : "calls";
      const r = resolveCallTarget(ce, repoRoot);
      if (r.kind === "external") edges.push({ kind: edgeKind, external: r.package });
      else if (r.kind === "internal") addInternal(edgeKind, r.declPath, r.declName, r.declLine);
      else if (r.kind === "unresolved") unresolved++;
      // stdlib: drop silently
    } else if (kind === SyntaxKind.NewExpression) {
      const ne = node.asKindOrThrow(SyntaxKind.NewExpression);
      const r = resolveNewTarget(ne);
      if (r.kind === "external") edges.push({ kind: "new", external: r.package });
      else if (r.kind === "internal") addInternal("new", r.declPath, r.declName, r.declLine);
      else if (r.kind === "unresolved") unresolved++;
    } else if (kind === SyntaxKind.JsxOpeningElement || kind === SyntaxKind.JsxSelfClosingElement) {
      const el =
        kind === SyntaxKind.JsxOpeningElement
          ? node.asKindOrThrow(SyntaxKind.JsxOpeningElement)
          : node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
      const r = resolveJsxTarget(el);
      if (r.kind === "external") edges.push({ kind: "renders", external: r.package });
      else if (r.kind === "internal") addInternal("renders", r.declPath, r.declName, r.declLine);
      // Lowercase host elements / stdlib: drop silently.
    }
  };

  bodyNode.forEachDescendant(visit);
  return { edges, unresolved, pendingInternal };
}

export type PendingInternalEdge = {
  kind: ForwardEdge["kind"];
  declPath: string;
  declName: string;
  declLine: number;
};

// Per-source intermediate: function node with not-yet-resolved internal-edge targets.
type IntermediateFunctionNode = Omit<FunctionNode, "edges"> & {
  forwardExternal: ForwardEdge[];
  pendingInternal: PendingInternalEdge[];
};

export type IntermediateModule = {
  module: Omit<ModuleNode, "functions">;
  functions: IntermediateFunctionNode[];
};

// Two-phase: pass 1 walks all source files, collects function metadata + raw edges, tracks duplicate names.
// Pass 2 (in build-tree.ts) resolves internal-edge declPath/declName/declLine -> final ID string.
export function extract(input: ExtractInput): { intermediates: IntermediateModule[]; duplicates: Set<string> } {
  const project = new Project({
    tsConfigFilePath: input.tsConfigFilePath,
    skipAddingFilesFromTsConfig: false,
  });

  const allFiles = project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    if (fp.includes(`${path.sep}node_modules${path.sep}`)) return false;
    if (input.files) return input.files.includes(fp);
    return fp.startsWith(input.srcDir + path.sep) || fp === path.join(input.srcDir, "middleware.ts");
  });

  // Pass 1a: track duplicate (declPath, declName) so IDs can disambiguate with :line.
  const seenNames = new Map<string, number>();
  const duplicates = new Set<string>();
  for (const sf of allFiles) {
    for (const seed of collectFunctions(sf)) {
      const key = `${repoRelative(input.repoRoot, sf.getFilePath())}#${seed.name}`;
      const n = (seenNames.get(key) ?? 0) + 1;
      seenNames.set(key, n);
      if (n > 1) duplicates.add(key);
    }
  }

  const intermediates: IntermediateModule[] = [];
  for (const sf of allFiles) {
    const filePath = sf.getFilePath();
    const moduleClass = fileLevelClassification(sf, input.repoRoot, input.srcDir);
    const fileUseServer = moduleClass.includes("server-action");
    const fileUseClient = moduleClass.includes("client-component");

    const seeds = collectFunctions(sf);
    const fnNodes: IntermediateFunctionNode[] = [];

    for (const seed of seeds) {
      const id = buildFunctionId(input.repoRoot, filePath, seed.name, seed.line, duplicates);
      const fnClass: NextClassification[] = [];
      // Inherit module classification on individual functions when load-bearing (component-level tag).
      const componentish = isComponent(seed.name, seed.bodyNode);
      const kind: FunctionKind = componentish ? "component" : seed.kind;
      if (fileUseClient && componentish) fnClass.push("client-component");
      if (fileUseServer || seed.functionLevelUseServer) fnClass.push("server-action");
      if (
        moduleClass.includes("server-component") &&
        componentish &&
        !fileUseClient
      ) {
        fnClass.push("server-component");
      }

      const { edges, unresolved, pendingInternal } = collectForwardEdges(
        input.repoRoot,
        seed.bodyNode
      );

      fnNodes.push({
        id,
        name: seed.name,
        kind,
        line: seed.line,
        exported: seed.exported,
        classification: fnClass,
        forwardExternal: edges,
        pendingInternal,
        unresolved,
      });
    }

    intermediates.push({
      module: {
        path: repoRelative(input.repoRoot, filePath),
        root: getRoot(input.repoRoot, input.srcDir, filePath),
        classification: moduleClass,
      },
      functions: fnNodes,
    });
  }

  return { intermediates, duplicates };
}
