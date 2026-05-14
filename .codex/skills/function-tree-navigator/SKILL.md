---
name: function-tree-navigator
description: >
  Read-only structural query skill. Use when you need to answer a free-form
  "who/what/which/how-many" question about call structure that doesn't fit the
  $blast-radius, $trace-flow, or $find-orphans skills. Consumes
  docs/function-tree/function-tree.json. Reports a concise structured answer
  with file paths and line numbers. Never modifies code.
---

You answer structural questions about the codebase by querying
`docs/function-tree/function-tree.json`. You never write code. You return
concrete answers with `path:line` citations and brief verdicts.

## The artifact

`docs/function-tree/function-tree.json` is the machine-generated function tree.
Schema:

```jsonc
{
  "$schema": "function-tree/v1",
  "generated_at": "<ISO8601>",
  "roots": ["src/app", "src/content", "src/data", "src/domain",
            "src/features", "src/lib", "src/server", "src/ui"],
  "modules": [
    {
      "path": "src/server/actions.ts",
      "root": "src/server",
      "classification": ["server-action"],
      "functions": [
        {
          "id": "src/server/actions.ts#createExpense",
          "name": "createExpense",
          "kind": "function" | "method" | "arrow" | "component",
          "line": 82,
          "exported": true,
          "classification": ["server-action"],
          "edges": [
            { "kind": "calls" | "renders" | "new" | "dynamic-import",
              "target": "<id>" }      // internal
            | { "kind": "...",
                "external": "<package>" }  // external
            | { "kind": "..." }       // unresolved
          ],
          "unresolved": 0
        }
      ]
    }
  ],
  "reverse": {
    "calls":          { "<id>": ["<caller-id>", ...] },
    "renders":        { "<id>": [...] },
    "new":            { "<id>": [...] },
    "dynamic-import": { "<module-path>": [...] }
  }
}
```

Notes:
- Stable function ID format: `<repo-relative-path>#<symbol>`; on duplicate names
  within a file, suffix `:line` is appended.
- `external` edges target npm packages, not internal IDs. They never appear in
  the reverse index.
- `classification` is a tag set, not a single tag. A function can be both
  `server-action` and `regular` if the directive scope differs.
- `dynamic-import` reverse keys are module paths, not function IDs.

## Process

### 1. Freshness check (always first)

```bash
npm run map:check 2>&1 | tail -3
```

If stale, warn the requester before proceeding: "Function tree is stale; results
may not reflect HEAD. Run `npm run map` to refresh."

### 2. Parse the question into a query plan

Extract:
- Target entity (function ID, file path, class of functions, root, classification).
- Direction (inbound = `reverse.*`, outbound = `edges`).
- Filter (classification, root, exported, kind).
- Aggregation (count, list, group-by).

State the plan in one sentence before running queries: "Plan: list all
client-components that call any server-action, grouped by feature."

### 3. Execute via jq

Always use `jq` against `docs/function-tree/function-tree.json`. Examples:

- **All server actions:**
  ```bash
  jq -r '.modules[].functions[] | select(.classification | index("server-action")) | .id' \
    docs/function-tree/function-tree.json
  ```

- **Client components calling server actions:**
  ```bash
  jq -r '
    [.modules[].functions[]
     | select(.classification | index("server-action"))
     | .id] as $actions
    | .modules[].functions[]
    | select(.classification | index("client-component"))
    | . as $caller
    | .edges[]
    | select(.target as $t | $actions | index($t))
    | $caller.id + " → " + .target
  ' docs/function-tree/function-tree.json
  ```

- **Functions with >N callers (load-bearing):**
  ```bash
  jq -r --argjson n 5 '
    .reverse.calls | to_entries[] | select(.value | length >= $n)
    | (.value | length | tostring) + "\t" + .key
  ' docs/function-tree/function-tree.json | sort -rn
  ```

- **Cross-root edges (architectural sanity):**
  ```bash
  jq -r '
    .modules[] as $m | $m.functions[] | . as $fn | .edges[]
    | select(.target) | select(.target | startswith("src/"))
    | ($m.root + " → " + (.target | split("/")[0:2] | join("/")))
  ' docs/function-tree/function-tree.json | sort | uniq -c | sort -rn
  ```

If a query needs more than a one-liner, write the jq script to a heredoc and
explain what it does in one sentence.

### 4. Report

Structure every answer:

1. **Restated question** (one sentence).
2. **Result** — a list, count, or table. Always include `path:line` (or just the
   function ID, which already encodes path).
3. **Verdict** — one short line: "expected", "anomaly", "needs investigation".
4. **Caveats** — only if relevant: stale tree, unresolved-counter warnings,
   ambiguous symbol resolution.

### 5. Never

- Never modify code, even if the answer suggests an obvious fix.
- Never run `npm run map` to refresh — the requester decides when to regenerate.
- Never search the source as a substitute for the tree — the tree is the
  type-checker-resolved view; text search is less precise.
- Never speculate when an edge isn't in the tree. If the tree says zero
  callers, report zero callers and mention the `unresolved` count caveat if
  relevant.

## When this is not the right skill

Decline and redirect:

- "Modify or refactor X" → not this skill's job. Switch back to normal coding workflow.
- "Why does X behave this way at runtime?" → not this skill's job. Use debugging workflow.
- "Is the design good?" → not this skill's job. Use code-review or refactoring workflow.
- "Show me the call graph visually" → no visualisation tool wired up; offer the
  per-root markdown at `docs/function-tree/src-<root>.md`.
