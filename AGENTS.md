<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:function-tree-harness -->
# Function tree (blast-radius reference)

Before editing any function in `src/`, consult `docs/function-tree/` — it is the machine-extracted function-level view that complements the hand-curated C4 diagrams in `docs/engineering-handbook.md` §4.

- `docs/function-tree/index.md` — start here. Top-level table per root.
- `docs/function-tree/src-<root>.md` — bidirectional call graph for that root.
- `docs/function-tree/function-tree.json` — canonical JSON consumed by skills.

## Codex skills

- `$blast-radius <fn-id-or-symbol>` — direct callers, renderers, instantiators, test coverage, forward dependencies. Use before changing any non-trivial function.
- `$trace-flow <fn-id-or-symbol>` — forward call chain through the layered architecture; flags trust-boundary crossings and layer violations.
- `$find-orphans [--root <name>]` — exported functions with no inbound edges, excluding framework entry points. Use during dead-code sweeps.

Each skill freshness-gates via `npm run map:check`; stale artifact stops the skill unless `--allow-stale` is passed.

## Structural query skill

- `$function-tree-navigator` — read-only structural query skill for free-form questions that don't fit the three skills above (e.g. "which client components call any server action", "find functions with >5 callers"). Returns `path:line` citations.

## When the tree is wrong

The tree is type-checker-resolved, not text-search-based. Two known gaps:
1. Computed dispatch (`obj[key]()`, `(x as any).method()`) is counted in the `unresolved` field per function and emits no edge.
2. Modules consumed by external tools (codegen, fixtures referenced only by Vitest globs) appear as orphans. Cross-check `find-orphans` results with `rg` before deleting.

Regenerate with `npm run map`; CI gate is `npm run map:check`.
<!-- END:function-tree-harness -->

<!-- BEGIN:dev-skills-and-agents -->
# Development skills

Project-specific Codex skills covering the stack-specific failure modes that generic tooling can't catch. Loaded from `.codex/skills/`.

## Correctness & safety skills (P0)

- `$rls-audit <migration>` — verify every new table in `supabase/migrations/*.sql` has all four RLS policies (SELECT/INSERT/UPDATE/DELETE), scoped `TO authenticated`, with `WITH CHECK` on writes. Guards the project's trust boundary (handbook §3.2).
- `$nextjs16-guard <file>` — flag Next.js 16 breaking-change patterns coding agents may write by default (sync `params`/`cookies`, single-arg `revalidateTag`, removed `unstable_cache`). `middleware.ts` is advisory-only (migration to `proxy.ts` deferred).
- `$validate-drift <action-or-route>` — compare server-action inline validation against the canonical Zod schema in `src/lib/validation.ts`. **Zod is canonical** (handbook §3.3); verdict reads "update action to match schema."

## Schema & coverage skills (P1)

- `$types-vs-migrations [table]` — diff `src/data/supabase/types.ts` against `supabase/migrations/*.sql`. Catches drift the TS compiler can't (column added in SQL but missing in `<Entity>Row` → silent `undefined` reads).
- `$revalidation-coverage <action>` — using the function tree, walk write→read paths and verify the action's `revalidatePath(...)` calls cover every page that consumes the written table.
- `$test-strategy-gate <file>` — pre-implementation gate: map the file to its test layer per §3.10 and flag implicated untested invariants (RLS, conflict guard, middleware redirects, action error paths).

## UI consistency skill (P2)

- `$design-system-check <file>` — flag raw Tailwind tokens in `src/features/**/*.tsx` where `src/ui/*-classes.ts` primitives already exist (`surfaceClass`, `inputClass`, `appLinkStyles`, `appTabStyles`, `chartStyles`).

## Domain skill

- `$sg-finance-domain-expert` — read-only skill for SG regulatory verification. Fetches current CPFB / LTA / HDB values and diffs against hardcoded constants in `src/domain/finance/sg-*.ts`, `vehicle-sg.ts`, `housing-loan-quick.ts`. Use when changing any SG-regulatory constant or on annual sweeps (CPFB typically announces Q4 for the next calendar year).

## PROJECT_CONTEXT (required on ship)

`PROJECT_CONTEXT.md` is the repo source of truth for shipped vs planned. **In the same task** as any user-facing ship under `src/` or `supabase/migrations/`, update the **Feature inventory (shipped vs planned)** section in `PROJECT_CONTEXT.md` (status + notes), plus Routes/Database bullets when relevant, and the `_Last reviewed_` line. Then sync the [BYOFA Feature Roadmap](https://app.clickup.com/90182722727/v/l/6-901818233981-1) in ClickUp per `.cursor/rules/project-context-clickup-sync.mdc` (or ask to **sync BYOFA**). Skip for refactors, tests-only, or non–user-facing changes. Cursor: `.cursor/rules/update-project-context-on-ship.mdc`.

## When to invoke

| Edit type | Invoke |
|---|---|
| User-facing ship (`src/app/**`, `src/features/**`, migrations with app-facing schema) | Update `PROJECT_CONTEXT.md` + BYOFA ClickUp sync |
| `supabase/migrations/*.sql` | `$rls-audit`, `$types-vs-migrations` |
| `src/app/**`, `src/server/actions.ts`, `src/middleware.ts`, route handlers | `$nextjs16-guard` |
| Any server-action add/change | `$validate-drift`, `$revalidation-coverage`, `$test-strategy-gate` |
| `src/data/supabase/types.ts` | `$types-vs-migrations` |
| `src/domain/finance/sg-*.ts`, `vehicle-sg.ts`, `housing-loan-quick.ts` | `$sg-finance-domain-expert` |
| `src/features/**/*.tsx` | `$design-system-check` |
| Any new feature touching mutation paths | `$test-strategy-gate` first |
<!-- END:dev-skills-and-agents -->
