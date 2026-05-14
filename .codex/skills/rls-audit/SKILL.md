---
name: rls-audit
description: >
  Verify Row-Level Security policy coverage on Supabase migrations. For every `create table` in the target migration, asserts that RLS is enabled and all four policies (SELECT/INSERT/UPDATE/DELETE) exist, are scoped `TO authenticated`, use the `(select auth.uid())` performance form, and INSERT/UPDATE policies have a `WITH CHECK` clause. Use after any edit to `supabase/migrations/*.sql` that touches `create table`, `enable row level security`, or `create policy`.
---

# RLS audit

The project's entire authorization model is RLS at Postgres (`docs/engineering-handbook.md` §3.2). A table shipped without complete policies leaks every user's rows under the anon key — and TypeScript will not flag it. This skill is the structural gate.

## Phase 1 — Resolve the target

Parse the user-supplied argument text:
- A path ending in `.sql` → audit that file.
- `--latest` → audit the migration with the highest timestamp prefix under `supabase/migrations/`.
- `--all` → audit every `supabase/migrations/*.sql`. Use sparingly.
- Empty → ask the user which migration; do NOT default to `--all`.

```bash
ls supabase/migrations/*.sql | sort | tail -1   # for --latest
```

## Phase 2 — Extract tables in this migration

For each migration, enumerate every `create table` and `alter table ... enable row level security` statement:

```bash
rg -n '^\s*create table (public\.)?[a-z_]+' "$MIGRATION" \
  | sed -E 's/.*create table (public\.)?([a-z_]+).*/\2/'
```

Also extract tables that existed pre-migration but are being modified by this migration's policies (rare — typically `alter table ... enable row level security` introduces RLS to a pre-existing table).

## Phase 3 — Per-table compliance check

For each table T in this migration, verify ALL FIVE invariants. Use these greps against the same migration file:

| # | Invariant | Detection search |
|---|---|---|
| 1 | RLS enabled | `rg "alter table (public\.)?$T enable row level security" "$MIGRATION"` |
| 2 | SELECT policy exists | `rg "create policy \".*\" on (public\.)?$T\\s+for select" "$MIGRATION"` |
| 3 | INSERT policy exists | `... for insert` |
| 4 | UPDATE policy exists | `... for update` |
| 5 | DELETE policy exists | `... for delete` |

If T is created in this migration, all five must be present in the SAME migration. If T was created earlier and this migration only modifies it, check the cumulative migration set (search older migrations for the missing policies). For added safety, the skill should always run a cross-migration sanity scan:

```bash
rg -n "create policy \".*\" on (public\.)?$T\\s+for (select|insert|update|delete)" supabase/migrations/
```

### Quality checks per policy (run on each policy block found)

| Check | What | Why |
|---|---|---|
| Scope | `to authenticated` clause present | The default (`public`) includes the anon role — bypasses every guard. |
| Owner predicate | `user_id = (select auth.uid())` or `id = (select auth.uid())` (for `profiles` table) | The bare `auth.uid()` form re-evaluates per row; the `(select ...)` form caches it — Supabase's recommended pattern. |
| INSERT has WITH CHECK | INSERT policy includes `with check (...)` | `USING` only applies to existing rows; INSERT writes new rows — without `WITH CHECK`, the constraint is unenforced. |
| UPDATE has WITH CHECK | UPDATE policy includes `with check (...)` | Without it, an attacker can reassign `user_id` on update. |

Extract each policy's body via:

```bash
awk -v t="$T" '/create policy.*on (public\.)?'"$T"'/,/;/' "$MIGRATION"
```

## Phase 4 — Cross-cutting checks

For each table found:

- **Cascade FK to `financial_profiles(id)` or `auth.users(id)`:** every user-scoped table in this project uses `user_id uuid references public.financial_profiles(id) on delete cascade` (or `references auth.users(id) on delete cascade` for the profiles table itself). If the table has a `user_id` column without `on delete cascade`, flag it — orphan rows after account deletion.
- **`prefix == "financial_"`:** since `20260507000000_rename_public_tables_financial_prefix.sql`, all user-scoped tables live under `public.financial_*`. New tables that don't follow this prefix should be flagged unless they are explicitly system tables (rare; ask the user).

## Phase 5 — Render the report

For each table, render a compliance card:

```
### public.financial_<name>
- [✓] RLS enabled
- [✓] SELECT policy (TO authenticated, owner predicate ✓, perf form ✓)
- [✓] INSERT policy (TO authenticated, WITH CHECK ✓, perf form ✓)
- [✗] UPDATE policy (missing — see migration 20260512000000_xxx.sql)
- [✓] DELETE policy (TO authenticated, owner predicate ✓)
- [✓] FK cascade on user_id
- [✓] `financial_` prefix
```

Then a one-line verdict:
- All tables green → "**RLS coverage complete.** Safe to merge."
- Any structural miss (missing policy, missing RLS, missing scope) → "**RLS GAP.** Do not merge until fixed."
- Only stylistic issues (perf form, prefix) → "**Advisory.** Functional but inconsistent with project conventions."

## Phase 6 — Caveats

- This skill verifies STRUCTURAL compliance. It does NOT prove the policy *predicate* is correct — a policy `to authenticated using (true)` passes structural checks but allows any authenticated user to read every row. Predicate review is human.
- The skill cannot detect `auth.uid()` returning `NULL` for unauthenticated requests, which is the correct behavior for anonymous users. The combination of `to authenticated` + `auth.uid()` is what gates anonymous access.
- For tables that reference *other* user-scoped tables (e.g. `financial_budget_line_overrides.budget_line_id → financial_budget_lines.id`), the chained access path is enforced by the policy on the parent table; this skill does not verify chain-policies. Surface as a manual review item if the new table has FKs to other user-scoped tables.
