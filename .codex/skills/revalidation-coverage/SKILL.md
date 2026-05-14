---
name: revalidation-coverage
description: >
  Given a server action or route handler that performs a write, list every page route that reads the same table (via the function-tree) and verify each is covered by a `revalidatePath(...)` call. Catches stale-UI bugs where a new page consumes an existing repository but the mutation forgets to invalidate it. Reuses `docs/function-tree/function-tree.json`.
---

# Revalidation coverage

After a mutation, Next.js' router cache must be invalidated for any page that displays the changed data. Handbook §3.5 has a hand-curated revalidation matrix; this skill mechanically computes it from the function tree and compares against the action's literal `revalidatePath(...)` calls. Catches the bug class: a new "retirement" page reads vehicles, but `createVehicleAction` only revalidates `/balances` and `/dashboard` — the new page goes stale silently.

## Phase 1 — Freshness gate

```bash
npm run map:check 2>&1 | tail -3
```

Stale → stop. `--allow-stale` to override.

## Phase 2 — Resolve target

Parse the user-supplied argument text to a function ID (use the same resolution as `$blast-radius`: bare symbol → unique ID via `jq` over modules[].functions[]).

Confirm the target writes (i.e. is a `server-action` or a route handler `POST|PUT|PATCH|DELETE` export). If the target reads only, skip — there's nothing to revalidate.

## Phase 3 — Identify the table(s) written

Walk the action's call edges (forward, one hop) to repository targets:

```bash
jq -r --arg id "$ID" '
  .modules[].functions[] | select(.id == $id) | .edges[]
  | select(.kind == "calls") | select(.target | tostring | startswith("src/data/repositories/"))
  | .target' docs/function-tree/function-tree.json
```

For each repository function called, extract the table name: read the repository file, find `supabase.from("<table>")` calls. Capture the set of tables touched.

## Phase 4 — Find pages that read those tables

For each table T, walk the function tree forward from any function that reads it:

1. Identify reader functions: any function whose source file imports a repository for T and calls its read functions (`list*`, `get*`, `find*`).
2. Walk transitively up `reverse.calls` from those readers to find which `page.tsx` / `layout.tsx` / `route.ts` ultimately consume them.
3. Map each page to its URL path (the App Router maps `src/app/(group)/foo/page.tsx` → `/foo`, ignoring `(group)` segments).

```bash
# All readers of table T (composition + repo helpers)
jq -r --arg t "$T" '
  .modules[] | select(.path | startswith("src/data/"))
  | .functions[] | .id' docs/function-tree/function-tree.json
# Then trace upward to pages — use the existing $trace-flow logic in reverse direction.
```

Build the required-revalidation set: pages that transitively consume table T.

## Phase 5 — Extract the action's actual revalidations

Read the action's source. Grep `revalidatePath\("([^"]+)"\)` calls within the function body. Capture the path set.

## Phase 6 — Diff

```
## src/server/actions.ts#createVehicleAction
Writes table(s): financial_vehicles

Pages reading financial_vehicles (transitively):
- /balances    ✓ in revalidatePath
- /dashboard   ✓ in revalidatePath
- /goals       ✗ MISSING — referenced via src/data/dashboard.ts → goals composition

Verdict: revalidation incomplete. Add: revalidatePath("/goals").
```

If the action revalidates a path that no longer reads the written table (stale revalidation):

```
- /setup   ⚠ stale — no transitive reader of financial_vehicles found via /setup
```

Stale revalidations are advisory (they're harmless but waste cache).

## Phase 7 — Verdict

- Complete coverage, no stale → "**Revalidation complete.**"
- Missing paths → "**Missing revalidation.** Listed pages will show stale data after this mutation."
- Only stale revalidations → "**Advisory.** Listed `revalidatePath` calls are dead — remove when convenient."
- Both → list each in its own section.

## Phase 8 — Caveats

- The function tree v1 does NOT track value-passing edges (`<form action={myAction}>`). Coverage will undercount when actions are bound by JSX prop. Cross-check with `rg -n "myAction" src/features/`.
- Read-detection assumes repository functions whose name starts with `list*` / `get*` / `find*` are reads. A repository function that mixes read and write is a code smell — flag it.
- Route groups in App Router (`(app)`, `(public)`) collapse to nothing in URL paths. Use the function-tree's module path → URL conversion when rendering page lists.
- The skill does not currently handle `revalidateTag` (project doesn't use it yet). When tag-based cache is introduced, extend the diff to compute the required tag set from `cacheTag(...)` calls in reader functions.
