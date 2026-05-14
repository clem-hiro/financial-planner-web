---
name: blast-radius
description: Show what depends on a function or component before you edit it. Reads docs/function-tree/function-tree.json. Use when about to change a function in src/ and you need to know callers, renderers, and test coverage. Accepts a function ID (`src/path/file.ts#name`), a bare symbol name, or a JSX component name.
allowed-tools: Read, Bash, Grep
argument-hint: "<function-id-or-symbol>  [--hops N]"
---

# Blast radius

Answer "if I change X, what breaks?" using the precomputed function tree at
`docs/function-tree/function-tree.json`. One hop by default; `--hops N` walks
transitively up to N levels.

## Phase 1 — Freshness gate

```bash
npm run map:check 2>&1 | tail -3
```

If exit is non-zero the artifact is stale. **Stop and tell the user**: "function-tree
is stale — run `npm run map` first, or pass `--allow-stale` to proceed anyway."
Skip this step only when `--allow-stale` was passed in `$ARGUMENTS`.

## Phase 2 — Resolve the target

Parse `$ARGUMENTS`. Strip flags. The remaining token is the target.

- If it contains `#` and starts with `src/`: treat as fully-qualified function ID.
- Otherwise: bare symbol. Resolve to the unique ID:
  ```bash
  jq -r --arg name "$NAME" '
    .modules[].functions[] | select(.name == $name) | .id
  ' docs/function-tree/function-tree.json
  ```
  - Zero matches → report "symbol not found in function tree" and stop.
  - One match → use it.
  - Multiple matches → list all candidates with classification, ask the user which.

## Phase 3 — Surface the impact

For each kind in `[calls, renders, new]` (skip `dynamic-import` unless --hops > 0):

```bash
jq -r --arg id "$ID" '.reverse.calls[$id] // []' docs/function-tree/function-tree.json
jq -r --arg id "$ID" '.reverse.renders[$id] // []' docs/function-tree/function-tree.json
jq -r --arg id "$ID" '.reverse.new[$id] // []' docs/function-tree/function-tree.json
```

Show:

1. **Target** — id, kind, line, classification (`server-action` / `client-component` /
   `route-handler` / `page` / etc.), exported flag.
2. **Called by** — direct callers. Group by root (`src/app`, `src/features`, …).
   Annotate each caller with its classification so a UI vs server boundary is visible.
3. **Rendered by** — JSX usage sites (when target is a component).
4. **Instantiated by** — `new` sites.
5. **Tests touching this function** — filter callers whose path matches `*.test.ts`.
6. **Forward dependencies** — what this function itself calls/renders/news (so the
   reviewer can also assess upstream changes). Pull from the forward edges:
   ```bash
   jq -r --arg id "$ID" '
     .modules[].functions[] | select(.id == $id) | .edges[] |
     if .target then .kind + " → " + .target
     elif .external then .kind + " → [external] " + .external
     else .kind + " → [unresolved]" end
   ' docs/function-tree/function-tree.json
   ```

## Phase 4 — Multi-hop (optional)

If `--hops N` was given with N > 1: BFS up the `reverse.calls` index for N levels.
Cap output at 50 nodes per hop; if exceeded, summarise as "+M more" and stop the
walk on that branch. Render as an indented tree, one line per node, classification
in `_(...)_` italics.

## Phase 5 — Verdict

End with a one-line summary tailored to the result:

- 0 callers and not on a public surface (page/layout/route-handler/middleware/server-action)
  → "**Likely dead.** Safe to delete or refactor freely."
- 0 callers but classification is a public surface → "**Public entry point.** Framework
  invokes this; check usage outside the codebase."
- 1–3 callers → "**Local change.** Verify each named caller still type-checks."
- 4+ callers → "**Load-bearing.** List call sites in PR description; ensure tests
  for each caller run."
- Any caller is a `.test.ts` file → "**Covered by tests.** Run those tests after the
  edit." Quote the test file paths.

## Notes

- The JSON includes `external` edges (npm packages) — surface them in forward
  dependencies but never as inbound edges (external code can't be in the reverse index).
- The `unresolved` counter per function indicates how many call sites the type-checker
  could not resolve (computed dispatch, `any` erasure). If target's unresolved > 0,
  warn: "{N} call sites could not be statically resolved — grep may surface more."
- Edges are bidirectional via inversion; reverse index keys are function IDs only,
  not external packages.
- **Value-passing limitation (v1):** the generator tracks only `calls`, `renders`,
  `new`, and `dynamic-import` — NOT values passed as arguments (`arr.map(myFn)`,
  `<form action={myAction}>`, `onClick={handler}`). For any target classified as
  `server-action`, OR a callback-shaped function (single-export, name ending in
  `Handler` / `Callback` / `Action`), append this caveat to the report:
  > **Caveat:** v1 doesn't track value-passing edges. Common Next.js usage
  > (`<form action={...}>`, `onSubmit={...}`) is invisible to the tree. Run
  > `grep -rn '<name>' src/` to find prop-binding sites.
