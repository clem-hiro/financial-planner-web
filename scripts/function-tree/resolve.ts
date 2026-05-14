import path from "node:path";
import {
  Node,
  Symbol as TsSymbol,
  CallExpression,
  NewExpression,
  JsxOpeningElement,
  JsxSelfClosingElement,
  SyntaxKind,
} from "ts-morph";

export type ResolvedTarget =
  | { kind: "internal"; id: string; declPath: string; declName: string; declLine: number }
  | { kind: "external"; package: string }
  | { kind: "unresolved" }
  | { kind: "stdlib" };

const NODE_MODULES = `${path.sep}node_modules${path.sep}`;
const TS_LIB_DTS_RE = /[\\/]node_modules[\\/]typescript[\\/]lib[\\/]lib\.[^\\/]+\.d\.ts$/;
const STDLIB_DTS_RE = /[\\/]node_modules[\\/]@types[\\/]node[\\/]/;

// Follow re-export chains: foo (in barrel) -> foo (real decl).
// ts-morph's getAliasedSymbol throws when symbol isn't an alias; guard with flags first.
export function followAliases(symbol: TsSymbol | undefined): TsSymbol | undefined {
  if (!symbol) return undefined;
  let current = symbol;
  for (let i = 0; i < 16; i++) {
    const compiler = current.compilerSymbol;
    const isAlias = (compiler.flags & /* SymbolFlags.Alias */ 0x200000) !== 0;
    if (!isAlias) return current;
    try {
      current = current.getAliasedSymbol() ?? current;
    } catch {
      return current;
    }
  }
  return current;
}

// Extract the package name from a node_modules-resident path.
// .../node_modules/zod/lib/index.js -> "zod"
// .../node_modules/@scope/pkg/dist/x.js -> "@scope/pkg"
export function packageFromNodeModulesPath(filePath: string): string | undefined {
  const idx = filePath.lastIndexOf(NODE_MODULES);
  if (idx === -1) return undefined;
  const after = filePath.slice(idx + NODE_MODULES.length);
  const parts = after.split(path.sep);
  if (parts.length === 0) return undefined;
  // @types/foo declares types for runtime package `foo`. Surface the runtime name, not the @types one.
  if (parts[0] === "@types" && parts.length >= 2) return parts[1];
  if (parts[0].startsWith("@") && parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
}

export function repoRelative(repoRoot: string, absPath: string): string {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

// Pick a declaration that's a function/method/class/arrow. Falls back to the first.
function pickFunctionDeclaration(symbol: TsSymbol): Node | undefined {
  const decls = symbol.getDeclarations();
  if (decls.length === 0) return undefined;
  const isFn = (d: Node) =>
    Node.isFunctionDeclaration(d) ||
    Node.isMethodDeclaration(d) ||
    Node.isArrowFunction(d) ||
    Node.isFunctionExpression(d) ||
    Node.isClassDeclaration(d) ||
    Node.isVariableDeclaration(d);
  return decls.find(isFn) ?? decls[0];
}

// Build the stable function ID. Disambiguates with `:line` when the same name appears more than once in a file.
export function buildFunctionId(
  repoRoot: string,
  declPath: string,
  declName: string,
  declLine: number,
  duplicates: Set<string>
): string {
  const rel = repoRelative(repoRoot, declPath);
  const base = `${rel}#${declName}`;
  return duplicates.has(base) ? `${base}:${declLine}` : base;
}

function resolveSymbolDeclaration(symbol: TsSymbol | undefined): ResolvedTarget {
  const followed = followAliases(symbol);
  if (!followed) return { kind: "unresolved" };
  const decl = pickFunctionDeclaration(followed);
  if (!decl) return { kind: "unresolved" };
  const declPath = decl.getSourceFile().getFilePath();
  // Stdlib types (lib.es*.d.ts, lib.dom.d.ts, @types/node) — drop as noise.
  if (TS_LIB_DTS_RE.test(declPath) || STDLIB_DTS_RE.test(declPath)) return { kind: "stdlib" };
  if (declPath.includes(NODE_MODULES)) {
    const pkg = packageFromNodeModulesPath(declPath);
    return pkg ? { kind: "external", package: pkg } : { kind: "unresolved" };
  }
  // Variable declaration -> use the symbol name; otherwise the named node.
  const name =
    (Node.isVariableDeclaration(decl) && decl.getName()) ||
    ((decl as unknown as { getName?: () => string }).getName?.() ?? followed.getName());
  if (!name) return { kind: "unresolved" };
  const line = decl.getStartLineNumber();
  return {
    kind: "internal",
    id: "", // caller assigns via buildFunctionId once duplicates set is known
    declPath,
    declName: name,
    declLine: line,
  };
}

export function resolveCallTarget(callExpr: CallExpression, repoRoot: string): ResolvedTarget {
  const callee = callExpr.getExpression();
  // Dynamic import: `import("./x")` parses as a CallExpression whose expression is ImportKeyword.
  if (callee.getKind() === SyntaxKind.ImportKeyword) {
    return resolveDynamicImport(callExpr, repoRoot);
  }
  const symbol = callee.getSymbol();
  if (!symbol) {
    // Fall back to call signature declaration for typed callables / methods returning fns.
    const sigs = callee.getType().getCallSignatures();
    const decl = sigs[0]?.getDeclaration();
    if (decl) {
      const sf = decl.getSourceFile();
      const declPath = sf.getFilePath();
      if (TS_LIB_DTS_RE.test(declPath) || STDLIB_DTS_RE.test(declPath)) return { kind: "stdlib" };
      if (declPath.includes(NODE_MODULES)) {
        const pkg = packageFromNodeModulesPath(declPath);
        return pkg ? { kind: "external", package: pkg } : { kind: "unresolved" };
      }
      const named = (decl as unknown as { getName?: () => string }).getName?.();
      if (named) {
        return {
          kind: "internal",
          id: "",
          declPath,
          declName: named,
          declLine: decl.getStartLineNumber(),
        };
      }
    }
    return { kind: "unresolved" };
  }
  return resolveSymbolDeclaration(symbol);
}

export function resolveNewTarget(newExpr: NewExpression): ResolvedTarget {
  const callee = newExpr.getExpression();
  const symbol = callee.getSymbol();
  return resolveSymbolDeclaration(symbol);
}

export function resolveJsxTarget(
  el: JsxOpeningElement | JsxSelfClosingElement
): ResolvedTarget {
  const tag = el.getTagNameNode();
  // Lowercase tag = host element (<div>, <span>) — not a renders edge.
  const text = tag.getText();
  const first = text.split(".")[0];
  if (first && first[0] === first[0].toLowerCase()) return { kind: "unresolved" };
  const symbol = tag.getSymbol();
  return resolveSymbolDeclaration(symbol);
}

function resolveDynamicImport(callExpr: CallExpression, repoRoot: string): ResolvedTarget {
  const arg = callExpr.getArguments()[0];
  if (!arg || !Node.isStringLiteral(arg)) return { kind: "unresolved" };
  const spec = arg.getLiteralValue();
  const sf = callExpr.getSourceFile();

  // Relative or alias: resolve against the project's source files.
  if (spec.startsWith(".") || spec.startsWith("@/")) {
    const fromDir = path.dirname(sf.getFilePath());
    const base = spec.startsWith("@/")
      ? path.join(repoRoot, "src", spec.slice(2))
      : path.resolve(fromDir, spec);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ];
    const project = sf.getProject();
    for (const candidate of candidates) {
      const hit = project.getSourceFile(candidate);
      if (hit) {
        return {
          kind: "internal",
          id: "",
          declPath: hit.getFilePath(),
          declName: "<module>",
          declLine: 1,
        };
      }
    }
    return { kind: "unresolved" };
  }
  // Bare specifier: tag as external (package name only).
  const parts = spec.split("/");
  const pkg = parts[0].startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  return { kind: "external", package: pkg };
}
