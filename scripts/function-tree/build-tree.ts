import type { IntermediateModule, PendingInternalEdge } from "./extract.ts";
import type {
  FunctionTree,
  ForwardEdge,
  FunctionNode,
  ModuleNode,
  ReverseIndex,
} from "./types.ts";
import { repoRelative } from "./resolve.ts";

function pendingToId(
  repoRoot: string,
  pending: PendingInternalEdge,
  duplicates: Set<string>
): string {
  const rel = repoRelative(repoRoot, pending.declPath);
  const base = `${rel}#${pending.declName}`;
  return duplicates.has(base) ? `${base}:${pending.declLine}` : base;
}

export function buildTree(
  repoRoot: string,
  intermediates: IntermediateModule[],
  duplicates: Set<string>,
  generatedAt: string
): FunctionTree {
  // Pass 1: build the master ID set across all modules.
  const allIds = new Set<string>();
  for (const m of intermediates) for (const f of m.functions) allIds.add(f.id);

  // Pass 2: resolve pending internal edges -> final IDs, dropping invalid targets to `unresolved`.
  const modules: ModuleNode[] = [];
  const reverse: ReverseIndex = {
    calls: {},
    renders: {},
    new: {},
    "dynamic-import": {},
  };

  for (const im of intermediates) {
    const functions: FunctionNode[] = [];
    for (const f of im.functions) {
      const edges: ForwardEdge[] = [...f.forwardExternal];
      let unresolved = f.unresolved;
      const seenEdges = new Set<string>();
      // Deduplicate forward edges (the AST visit can hit the same target multiple times — once per call site).
      for (const e of edges) {
        const k = "target" in e ? `${e.kind}|t|${e.target}` : `${e.kind}|x|${e.external}`;
        seenEdges.add(k);
      }
      for (const p of f.pendingInternal) {
        // Dynamic imports target modules, not functions — use the module path directly.
        if (p.kind === "dynamic-import") {
          const modulePath = repoRelative(repoRoot, p.declPath);
          const dedup = `dynamic-import|t|${modulePath}`;
          if (seenEdges.has(dedup)) continue;
          seenEdges.add(dedup);
          edges.push({ kind: "dynamic-import", target: modulePath });
          reverse["dynamic-import"][modulePath] ??= [];
          reverse["dynamic-import"][modulePath].push(f.id);
          continue;
        }
        const targetId = pendingToId(repoRoot, p, duplicates);
        if (!allIds.has(targetId)) {
          unresolved++;
          continue;
        }
        if (targetId === f.id) continue; // self-call: keep noise out, don't emit.
        const dedup = `${p.kind}|t|${targetId}`;
        if (seenEdges.has(dedup)) continue;
        seenEdges.add(dedup);
        edges.push({ kind: p.kind, target: targetId });
        reverse[p.kind][targetId] ??= [];
        reverse[p.kind][targetId].push(f.id);
      }
      functions.push({
        id: f.id,
        name: f.name,
        kind: f.kind,
        line: f.line,
        exported: f.exported,
        classification: f.classification,
        edges,
        unresolved,
      });
    }
    modules.push({ ...im.module, functions });
  }

  // Sort reverse arrays for stable output.
  for (const kind of Object.keys(reverse) as (keyof ReverseIndex)[]) {
    for (const id of Object.keys(reverse[kind])) {
      reverse[kind][id] = [...new Set(reverse[kind][id])].sort();
    }
  }
  // Sort modules by path for determinism.
  modules.sort((a, b) => a.path.localeCompare(b.path));
  for (const m of modules) {
    m.functions.sort((a, b) => a.line - b.line);
  }

  const roots = [...new Set(modules.map((m) => m.root))].sort();

  return {
    $schema: "function-tree/v1",
    generated_at: generatedAt,
    roots,
    modules,
    reverse,
  };
}
