# Per-user unique entity-name constraint + proposal-flow guard

> **Execution handoff.** This plan is self-contained; a fresh session can run it cold.
> It was authored on 2026-05-23 after restarting Claude Code to load the Supabase MCP.
> **Start with Phase 0 (verify MCP + run the audit) before changing anything.**

## Problem Statement

- A client proposal-detail view showed 10 "Suggested changes" that were actually **two distinct investment accounts both named `ilp2`** — visually indistinguishable (`src/features/proposals/ProposalReviewView.tsx`, the collapsible "Suggested changes" pane).
- Root cause of the *display*: the pane groups by `section` only; the rail uses `groupChangesBySection` which also groups by entity. (That display issue is **out of scope** here — see Out of Scope.)
- Root cause of the *data*: nothing prevents a user from having two entities with the same name in the same group. The user wants this **prevented at the DB level** and existing duplicates cleaned up.
- Schema note (load-bearing): the live tables are **`financial_`-prefixed** (`financial_investments`, `financial_cash_accounts`, …). The older migration names (`investments`, `cash_accounts`, `profiles`) were renamed. Confirm real table/column names from `src/data/supabase/types.ts` and `.from("…")` calls in `src/data/`, **not** from old `create table` migrations.

## Success Criteria

- A unique constraint (case-insensitive, trimmed) prevents duplicate names per user on the agreed tables.
- All pre-existing duplicates are renamed (` 2`, ` 3`, …) so the constraint can be created without error.
- An advisor proposal that would create a colliding name is blocked at compose time **and** produces a friendly error at accept time (not a raw `23505`).
- `$rls-audit` and `$types-vs-migrations` pass on the new migration; typecheck + lint clean.
- A functional test proves a duplicate insert is rejected and a colliding proposal accept returns a friendly conflict.

## Locked Decisions (from user, do not re-ask)

| Decision | Value |
|---|---|
| Name matching | **Case-insensitive + trimmed** → functional unique index on `lower(btrim(<col>))` |
| "Group" definition | **Per `user_id`** for every table — including `financial_cash_accounts` (NOT purpose-aware) |
| Existing duplicates | **Rename**, suffix ` 1`/` 2`/` 3` (space + number). Non-destructive. |
| Advisor proposal collisions | **Guard at compose AND accept** (reuse the existing `ProposalConflict` surface for accept) |

## Decision Gate D0 — confirm with user before touching these two tables

The user leaned "include everything, just suffix numbers." That works for label-style names but **`financial_expenses` and `financial_budget_lines` use `category`, a repeating classification/tag, not a per-item name.** A uniqueness constraint there would break expense tracking / budgeting (many rows per category by design; suffixing `Food 1`, `Food 2`… destroys the grouping the math relies on).

**Recommended: EXCLUDE both.** Re-confirm with the user at the start of execution. The include set below assumes they are excluded.

## Include set (per-user, name-like column)

| Table | Name column | Notes |
|---|---|---|
| `financial_investments` | `name` | the screenshot case; also a proposal `entity_type` |
| `financial_goals` | `title` | also a proposal `entity_type` |
| `financial_liabilities` | `name` | |
| `financial_properties` | `name` | |
| `financial_cash_accounts` | `name` | constraint is `(user_id, name)` — purpose ignored, per decision |
| `financial_housing_loans` | `label` | default `'Home loan'` → existing dups get suffixed |
| `financial_vehicles` | `label` | default `'Vehicle'` → existing dups get suffixed |

Excluded (no user-named entity): `financial_cpf_balances`, `financial_income_tax_configs`, `financial_profiles`, `financial_inbox_notifications`, `*_snapshots`, `*_month_overrides`. Excluded pending D0: `financial_expenses`, `financial_budget_lines`.

---

## Phase 0 — Verify MCP + run the duplicate audit (READ-ONLY, do first)

**Gate to Phase 1:** audit output captured below in this doc, and a per-row rename mapping is known.

1. Run `/mcp`; confirm `supabase` is **connected** (OAuth browser flow if prompted). Server is read-only, scoped to project `cxinqaagixwpehyyhhtw` (see `.mcp.json`).
2. Run this via the Supabase MCP `execute_sql` (read-only). Adjust table list per D0.

```sql
select tbl, user_id, norm_name, n from (
  select 'financial_investments' tbl, user_id, lower(btrim(name)) norm_name, count(*) n
    from financial_investments group by 1,2,3 having count(*)>1
  union all select 'financial_goals', user_id, lower(btrim(title)), count(*)
    from financial_goals group by 1,2,3 having count(*)>1
  union all select 'financial_liabilities', user_id, lower(btrim(name)), count(*)
    from financial_liabilities group by 1,2,3 having count(*)>1
  union all select 'financial_properties', user_id, lower(btrim(name)), count(*)
    from financial_properties group by 1,2,3 having count(*)>1
  union all select 'financial_cash_accounts', user_id, lower(btrim(name)), count(*)
    from financial_cash_accounts group by 1,2,3 having count(*)>1
  union all select 'financial_housing_loans', user_id, lower(btrim(label)), count(*)
    from financial_housing_loans group by 1,2,3 having count(*)>1
  union all select 'financial_vehicles', user_id, lower(btrim(label)), count(*)
    from financial_vehicles group by 1,2,3 having count(*)>1
) d order by tbl, n desc;
```

3. **Also check for pre-existing suffixed-name collisions** (e.g. a `Foo 2` that already exists alongside `Foo`,`Foo`) so the rename doesn't create a NEW duplicate. The unique-index creation in Phase 1 is the hard safety net, but surface these now:

```sql
-- after computing intended renames, the index build will fail if any remain.
-- For each include-set table, eyeball names matching '<base> <int>' that coincide with a duplicate base.
```

4. Paste results into this doc under "Audit results" and report to the user.

### Audit results
_Run 2026-05-23 against prod project `cxinqaagixwpehyyhhtw` (read-only MCP)._

**Zero duplicates found** across all seven include-set tables (query returned `[]`).
- The original `ilp2`/`ILP2` investment pair no longer exists in the live DB.
- All seven table/column names validated (query ran without column errors).
- **Consequence:** Phase 1 rename UPDATEs are no-ops; migration is purely additive (unique-index creation only). Numbering-scheme nuance is moot (nothing is renamed). Suffix-collision edge case (Phase 0 step 3) is therefore N/A.
- Defensive rename UPDATEs are retained in the migration so it remains correct if applied to any DB that does contain duplicates.

---

## Phase 1 — Migration: rename duplicates + add unique indexes

**Gate to Phase 2:** migration applies cleanly on a dev/branch DB; `$rls-audit` + `$types-vs-migrations` pass; a manual duplicate insert is rejected.

Create `supabase/migrations/<UTC-timestamp>_unique_entity_names.sql`. The rename runs first, then the index (index creation is the verification that the rename was complete).

Per-table template (repeat for each include-set table; swap `<table>`/`<col>`):

```sql
-- 1) Rename duplicates: keep the oldest row's name; suffix later rows ' 2', ' 3', …
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(<col>))
           order by created_at, id
         ) rn
  from <table>
)
update <table> t
set <col> = btrim(t.<col>) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

-- 2) Enforce: case-insensitive, trimmed, per user
create unique index if not exists <table>_user_name_ci_uq
  on <table> (user_id, lower(btrim(<col>)));
```

Notes / edge cases to handle:
- **Suffix collision:** if `<base> 2` already exists, step 1 may produce a duplicate and step 2 will fail. If the audit (Phase 0 step 3) shows any, switch that table's rename to a loop that picks the next free integer. Default window approach is fine when no pre-existing `<base> <int>` rows exist.
- Decision nuance on numbering: default keeps the oldest row's name bare and suffixes the rest (`name`, `name 2`, `name 3`). User said "` 1`, ` 2`, ` 3`" — if they want **all** rows suffixed from 1, change `r.rn > 1` to `true` and use `rn` (so `name 1`, `name 2`, …). Confirm if it matters.
- Run `$rls-audit <migration>` — note this migration only adds indexes + UPDATEs (no new tables), so RLS policy checks should be N/A, but run it to be safe.
- Run `$types-vs-migrations` — no column changes, so types.ts is unaffected; confirm.

---

## Phase 2 — Compose-time guard (advisor)

**Gate to Phase 3:** composing a proposal change that duplicates an existing client name (or another pending new entity in the same proposal) is blocked with a clear message; covered by a test.

- Constrained proposal `entity_type`s in scope: **`investment` (name)** and **`goal` (title)**. (`budget_line` excluded per D0; `profile` has no name.)
- Trace the compose save path with `$trace-flow` / `$blast-radius` and grep:
  - `src/features/advisor/AdvisorClientCompose.tsx`, `src/features/advisor/forms/AdvisorNewGoalForm.tsx`, and the server action that persists proposal changes (grep `advisor_proposal_changes` writers in `src/server/` and `src/data/repositories/advisor-proposals*`).
- Validate uniqueness against: (a) the client's existing `financial_investments.name` / `financial_goals.title`, and (b) other pending new entities within the same proposal. Compare with `lower(btrim())`.
- Zod is canonical (handbook §3.3). Put the shared rule in `src/lib/validation.ts`; have the action call it. Run `$validate-drift`.

## Phase 3 — Accept-time guard (client)

**Gate to Phase 4:** accepting a proposal that collides returns a friendly `ProposalConflict`, not a raw DB error; covered by a functional test.

- Accept path: `acceptAdvisorProposalAction` in `src/server/advisor-proposal-actions.ts` → accept RPC `supabase/migrations/20260605000000_advisor_accept_rpc.sql`.
- The new unique index throws SQLSTATE **`23505`** mid-accept. The RPC sets status `accepting` under a row lock before entity writes; on failure the proposal parks at `accepting` (terminal). Decide: either (a) pre-check uniqueness inside the RPC before writes and raise a structured conflict (preferred — avoids the terminal park), or (b) catch `23505` and map to a conflict the action surfaces.
- Reuse the existing conflict surface: `acceptState.conflicts: ProposalConflict[]` (already rendered by `ProposalReviewActions` in `ProposalReviewView.tsx`). Add a conflict reason like "name already in use".

## Phase 4 — Normal CRUD friendly validation (recommended, confirm scope)

The constraint also fires on the ordinary setup forms (add/rename investment, goal, cash account, etc.), surfacing as a DB error. For good UX, add the same Zod uniqueness check to those server actions. The DB constraint is the hard guarantee; this is the friendly message. Confirm with user whether to include now or defer.

---

## Public Interfaces / Contracts

- **DB migration:** new file `supabase/migrations/<ts>_unique_entity_names.sql` — adds `*_user_name_ci_uq` unique indexes on the include-set tables and UPDATEs duplicate names. No new tables, no column changes, no RLS policy changes.
- **Rollback:** `drop index if exists <table>_user_name_ci_uq;` per table. The rename UPDATEs are **not** auto-reversible (note in PR; original names are lost unless captured — Phase 0 audit output is the record).
- **API/actions:** `acceptAdvisorProposalAction` may return an additional `ProposalConflict` reason; compose action gains a validation error path. No route or wire-format change.
- **Zod:** add a per-user uniqueness validator to `src/lib/validation.ts` (canonical).

## Test Plan

- **Migration:** apply on a Supabase dev branch (or `npx supabase db ...` if linked); assert each `*_user_name_ci_uq` exists; `insert` a duplicate (diff case/whitespace) → expect `23505`.
- **Unit:** Zod uniqueness validator (`src/lib/validation.ts`) — case/whitespace variants.
- **Functional (API surface, per testing-philosophy):**
  - Compose: add a 2nd investment named `ilp2` for a client who has `ILP2` → blocked.
  - Accept: client accepts a proposal whose new investment name collides → friendly conflict, proposal not left in a broken state.
- **Static:** `$nextjs16-guard` on any touched `src/app/**`/action files; `$validate-drift`; `$rls-audit`; `$types-vs-migrations`.

## Rollout / Rollback

- Rollout: apply migration to dev branch → verify → promote to prod. (Migrations note in repo says prior migrations applied on prod; confirm prod state has no duplicates first via Phase 0 against the prod project.)
- Rollback: drop the unique indexes (one line each). Renames are not reversed automatically.
- Production safeguard: run the Phase 0 audit against the **prod** project before applying, since the rename mutates real rows.

## Out of Scope

- The collapsible-pane *display* grouping (flat list vs per-entity sub-headings). Earlier offered as an entity-grouping fix using `groupChangesBySection`; not part of this work unless the user revisits it.
- Changing `financial_cash_accounts` to a purpose-aware unique key (explicitly decided against).

## Assumptions

- "Group" = `user_id` everywhere (locked).
- `created_at` exists on all include-set tables for deterministic rename ordering (verify; `financial_*` rows carry `created_at` per `types.ts`).
- The Supabase MCP remains read-only; the schema change ships as a committed migration file, not ad-hoc MCP DDL.

## Config already in place (no action needed)

- `.mcp.json`: `supabase` remote HTTP server, `read_only=true`, `project_ref=cxinqaagixwpehyyhhtw`.
- `.claude/settings.json`: `supabase` added to `enabledMcpjsonServers`.
