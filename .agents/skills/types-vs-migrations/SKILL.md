---
name: types-vs-migrations
description: Diff column lists between hand-maintained `src/data/supabase/types.ts` Row types and the cumulative state in `supabase/migrations/*.sql`. Catches schema drift the TypeScript compiler can't — a SQL column added without a matching field in `<Entity>Row` produces `undefined` reads at the mapper seam with no compile error. Run after any migration edit or hand-edit to `types.ts`.
allowed-tools: Read, Bash, Grep, Glob
argument-hint: "[<table-name>]  — omit to scan all tables"
---

# Types ↔ migrations drift

Handbook §3.7 records the deliberate choice to hand-maintain `src/data/supabase/types.ts` rather than run `supabase gen types` (URL coupling, lost inline comments). The trade-off is drift risk. With 21 migrations and 11 `<Entity>Row` types, a single missed column edit produces `undefined` reads in `src/data/mappers.ts` with zero TypeScript error. This skill closes the gap.

## Phase 1 — Resolve the target tables

Parse `$ARGUMENTS`:
- A table name like `financial_expenses` → scan that one table.
- Empty → scan ALL `<Entity>Row` types in `src/data/supabase/types.ts` against their corresponding SQL tables.

Mapping convention (verify in the codebase, don't assume):
- `ProfileRow` ↔ `public.financial_profiles` (or `public.profiles` for older code)
- `ExpenseRow` ↔ `public.financial_expenses`
- `BudgetLineRow` ↔ `public.financial_budget_lines`
- `BudgetLineMonthOverrideRow` ↔ `public.financial_budget_line_overrides`
- `InvestmentRow` ↔ `public.financial_investments`
- `CashAccountRow` ↔ `public.financial_cash_accounts`
- `LiabilityRow` ↔ `public.financial_liabilities`
- `VehicleRow` ↔ `public.financial_vehicles`
- `FinancialGoalRow` ↔ `public.financial_goals`
- `CpfBalanceRow` ↔ `public.financial_cpf_balances`
- `HousingLoanRow` ↔ `public.financial_housing_loans`

If a new table appears in migrations without a matching `Row` type, surface it as a top-level finding (NEW UNMAPPED TABLE).

## Phase 2 — Reconstruct the cumulative SQL schema per table

For each table T, walk `supabase/migrations/*.sql` in timestamp order. Build the cumulative column list:

```bash
# Initial create table
awk -v t="$T" '/create table (public\.)?'"$T"' *\(/,/\);/' supabase/migrations/*.sql

# Subsequent alter table statements
grep -hE "alter table (public\.)?$T (add|drop|rename) column" supabase/migrations/*.sql

# Renames (table-level)
grep -hE "alter table (public\.)?[a-z_]+ rename to (public\.)?$T" supabase/migrations/*.sql
```

For each column, capture: `name`, `type` (postgres type), `nullable` (presence of `not null`), `default` (presence of `default ...`).

## Phase 3 — Read the TS Row type

Parse `src/data/supabase/types.ts` for the matching `<Entity>Row` declaration. For each field, capture: `name`, `tsType`, `nullable` (presence of `| null` or `?` optional).

Postgres-to-TS type mapping (project's actual convention; refine from observed types):

| Postgres | TypeScript |
|---|---|
| `uuid`, `text`, `varchar` | `string` |
| `integer`, `bigint`, `smallint`, `numeric` | `number` |
| `boolean` | `boolean` |
| `timestamp with time zone`, `date` | `string` (ISO format) |
| `jsonb` | known shape or `unknown` |

## Phase 4 — Diff

For each table T, render the diff:

```
## financial_<table>

Columns in SQL but missing in <Entity>Row:
- `new_column` (text, not null) — add `new_column: string` to ExpenseRow

Columns in <Entity>Row but missing in SQL:
- `legacy_field: number` — column not found in any migration. Either remove from row, or migration is missing.

Type mismatch:
- `expected_annual_return`: SQL `numeric` (number), Row `string` — likely wrong, fix Row.

Nullability mismatch:
- `started_at`: SQL `not null`, Row `string | null` — narrow Row to `string`.
- `closed_at`: SQL nullable, Row `string` — widen Row to `string | null`.
```

When a `<Entity>Row` is fully synced: `✓ ExpenseRow matches financial_expenses (12 columns, all aligned)`.

## Phase 5 — Verdict

Aggregate findings:

- All tables clean → "**Schema in sync.** Safe."
- Drift in a non-active feature path → "**Advisory drift.** Update Row types when convenient."
- Drift in a table referenced by `src/server/actions.ts` or `src/data/repositories/` writes → "**Active-path drift.** Block — `undefined` reads will surface in production."

Use the function tree to determine "active path": if `src/data/repositories/<table>.ts` has callers (check `reverse.calls` in `docs/function-tree/function-tree.json`), the path is active.

## Phase 6 — Caveats

- SQL parsing is regex-based. Complex statements (CTEs in column defaults, multi-statement transactions, `do $$ ... $$` blocks) may be misread. When a column-level finding looks wrong, manually open the source migration to confirm.
- Generated columns (`generated always as ... stored`) are not treated specially; if the project starts using them, refine the skill to mark them read-only in the type.
- The skill does NOT verify enum value sets between Postgres `create type ... as enum (...)` and TypeScript union types — handle that manually for now.
- Does NOT cross-reference the `Database` type if one is later introduced; if a `Database` namespace gets added (e.g. via `supabase-js` typing), update the skill to walk that too.
