---
name: find-orphans
description: >
  Surface exported functions and components with no inbound edges in the function tree, excluding framework-invoked entry points (pages, route handlers, server actions, middleware). Reads docs/function-tree/function-tree.json. Use during cleanup, refactors, or pre-release dead-code sweeps.
---

# Find orphans

List functions with zero inbound edges that aren't framework-invoked entry points.
These are dead-code candidates. Verify before deletion — the tree resolves only
type-checker-visible references, so externally-loaded modules (config files,
codegen) can be false positives.

## Phase 1 — Freshness gate

```bash
npm run map:check 2>&1 | tail -3
```

Stale → stop. `--allow-stale` to override.

## Phase 2 — Build the orphan set

A function is an orphan when ALL hold:

1. `exported == true` (internal functions can't be orphans — they're scoped).
2. Function ID not in any of `reverse.calls`, `reverse.renders`, `reverse.new`,
   `reverse["dynamic-import"]`.
3. **Parent module's** `classification` array does NOT contain any of:
   `page`, `layout`, `loading`, `error`, `not-found`, `template`,
   `route-handler`, `middleware`, `server-action`.
   (These are framework entry points — Next.js invokes them by filesystem
   convention, no internal caller is expected. Use the module classification,
   not the per-function array — the generator tags module-level only.)

Canonical query:

```bash
jq -r '
  ([.reverse.calls, .reverse.renders, .reverse.new, .reverse["dynamic-import"]]
   | map(keys) | add | unique) as $referenced
  | [.modules[]
     | . as $m
     | select($m.classification
              | any(. == "page" or . == "layout" or . == "loading"
                    or . == "error" or . == "not-found" or . == "template"
                    or . == "route-handler" or . == "middleware"
                    or . == "server-action") | not)
     | $m.functions[]
     | select(.exported)
     | select(.id as $id | $referenced | index($id) | not)
     | { id: .id, kind: .kind, line: .line, root: $m.root,
         classification: ($m.classification | join(",")) }]
  | sort_by(.root, .id)
' docs/function-tree/function-tree.json
```

If `--root <name>` was passed, filter the output to that root only (`.root == $r`).

If `--include-internal` was passed, drop the `select(.exported)` filter — surfaces
unused local helpers too (large output, use sparingly).

## Phase 3 — Render

Group by root. For each orphan: ID, kind, line, classification (italicised, "—" if
empty). Order alphabetically within each root group. Format:

```
### src/lib
- `src/lib/dates.ts#unusedHelper` — function, L42 _(—)_
- `src/lib/currency.ts#OldFormat` — component, L15 _(client-component)_
```

After the list, print counts: `Total: N orphans across M roots.`

## Phase 4 — Caveats

Always print after results:

> **Verify before deleting.** Orphans are static-resolution-only. False positives:
> - Symbols referenced by string in dynamic imports with computed paths.
> - Symbols consumed by external tools (codegen, fixtures, storybook).
> - Symbols whose only usage is from `node_modules/` (the resolver intentionally
>   drops `node_modules`-rooted call sites).
> - Symbols re-exported from a barrel that's consumed externally.
> - **Symbols passed as values, not called** — e.g. `<form action={myAction}>` or
>   `arr.map(myFn)`. The v1 generator does NOT track callback/value-passing edges;
>   a server action consumed only by `<form action={...}>` will appear as an
>   orphan even though it's invoked at runtime. This is a known v1 limitation.
>
> Cross-check with `rg -n "<name>"` before removing.

## Notes

- Test files (`*.test.ts`) appear as orphan callers themselves when their assertions
  exercise functions without re-exporting helpers. They are correctly orphans by
  this definition — Vitest discovers them by filename, not by import.
- A function with `unresolved > 0` is NOT an orphan — that count is about outbound
  edges, not inbound.
