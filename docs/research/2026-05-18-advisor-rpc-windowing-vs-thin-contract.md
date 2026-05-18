# Research: Parameterize SECURITY DEFINER advisor RPCs vs. thin uniform contract

**Date:** 2026-05-18
**Status:** Complete

## Question

For RLS-/consent-gated data exposed via Postgres `SECURITY DEFINER` RPC
(Supabase/PostgREST), is current best practice (A) keep a uniform minimal
`(p_client uuid)` signature and window in the app, or (B) push window params
(`p_year_month`) into the function? Focus on the 2 month-windowed tables
(`financial_expenses`, `financial_budget_line_month_overrides`).

## Key Findings

1. **Predicate pushdown is the documented consensus.** Every modern source
   (Airbyte, Materialize, Databricks 2026 federation guidance) states: filter
   as close to the data source as possible; without pushdown the engine
   "retrieves all rows then discards irrelevant rows," wasting scan, transfer,
   and sort. Returning full multi-year history to discard all but one month is
   the textbook anti-pattern these sources warn against.

2. **PostgREST cannot rescue the thin contract here — the functions are
   `language plpgsql`.** PostgREST function *inlining* (which lets an external
   `?spent_at=gte.…` filter / `limit` be pushed into the query plan) applies
   **only to SQL-language functions** meeting PostgreSQL's table-function
   inlining rules. A `plpgsql RETURNS SETOF` function is a planner black box:
   `return query select * … where user_id = p_client order by spent_at desc`
   executes **fully** (entire history scanned + sorted) before any outer
   filter/limit applies. So "filter in the app" (or via PostgREST query params)
   does **not** avoid the over-fetch — the over-fetch happens inside the
   function regardless. Only a parameter in the function's own WHERE removes it.

3. **Index usability.** `where user_id = p_client and spent_at >= … ` lets the
   planner use a composite `(user_id, spent_at)` index and bounded sort; the
   thin form forces a full per-user partition scan + sort of all history on
   every dashboard render.

4. **Parameterizing does NOT widen the security/injection surface.** Supabase /
   PostgREST guidance: injection risk in `SECURITY DEFINER` arises only from
   dynamic SQL — string concatenation, `EXECUTE`, `format()` misuse. A
   strongly-typed bound parameter (`p_year_month date`) used directly in a
   static `WHERE` is a query parameter, never interpolated SQL. The existing
   hardening that matters (`set search_path`, `revoke … from public` /
   `grant execute … to authenticated`, consent predicate first) is unchanged.
   Adding a typed arg is safe.

5. **API consistency is a recognized principle, but the modern framing is
   "optimize *within* a consistent framework via standard
   filtering/pagination params" — not "identical signatures."** Per PostgREST
   convention, named function arguments *are* the idiomatic RPC
   parameterization/filtering mechanism. The contract is already non-uniform
   internally (each `advisor_read_*` has a different `order by` mirroring its
   self-path repo fn). Adding `p_year_month` to 2 functions is a minor,
   idiomatic divergence, not a pattern break.

## Codebase Patterns

- `supabase/migrations/20260529000000_advisor_consent_phase2.sql`: 10
  `advisor_read_*(p_client uuid)` fns, all `plpgsql / stable / security definer
  / set search_path = public, extensions`, consent-gated via
  `advisor_can_read_client(p_client)`, deny-shaped (early `return`).
- `advisor_read_expenses` → `select * … where user_id = p_client order by
  spent_at desc` (full history, then app windows per month).
- `advisor_read_budget_line_month_overrides` → `select * … where user_id =
  p_client` (no order; app windows per month).
- Self-path equivalents are already month-windowed
  (`listExpensesForMonth`, `listBudgetLineOverridesForMonth`), so a
  `p_year_month` arg mirrors the self path *more* faithfully than the thin form.
- Security posture audited clean 2026-05-18 (agent-memory
  `project-consent-gate.md`); adding a typed arg does not regress it.

## Recommendations

**Verdict: B, for these 2 tables only.** Add a typed window parameter
(`p_year_month date`, NULL ⇒ return all for back-compat) to
`advisor_read_expenses` and `advisor_read_budget_line_month_overrides`; keep
the other 8 thin. Reasons: (a) the over-fetch is real and *cannot* be mitigated
downstream because the functions are plpgsql (no inlining); (b) pushdown +
index usability is the documented best practice; (c) no security cost with a
typed bound parameter; (d) it mirrors the self-path windowed contract more
faithfully. **Tradeoff:** signature uniformity across the 10 RPCs is lost for 2
— but uniformity is already only skin-deep (per-table `order by` differs), and
2024–2026 API guidance explicitly favors standard filtering params over rigid
signature symmetry. Mitigate the consistency cost by making the arg optional
(thin call site still works) and documenting the windowed pair in the migration
header alongside the existing contract note.

## Sources

- https://docs.postgrest.org/en/stable/references/api/functions.html — function inlining is SQL-language only; plpgsql not inlined
- https://wiki.postgresql.org/wiki/Inlining_of_SQL_functions — table-function inlining conditions
- https://docs.postgrest.org/en/v12/references/api/pagination_count.html — PostgREST filtering/pagination conventions
- https://airbyte.com/data-engineering-resources/predicate-pushdown — predicate pushdown rationale; "retrieve all then discard" anti-pattern
- https://materialize.com/blog/how-filter-pushdown-works/ — filter pushdown reduces scan/transfer
- https://docs.databricks.com/aws/en/query-federation/performance-recommendations — push predicates to source; app-layer filter only when pushdown impossible
- https://supabase.com/docs/guides/database/functions — SECURITY DEFINER hardening (search_path, grants)
- https://vibeappscanner.com/vulnerability-in/sql-injection-supabase-apps — injection only via dynamic SQL/concat; typed params safe
- https://bastion.tech/blog/supabase-security-best-practices/ — SECURITY DEFINER least-privilege, strict input typing
- https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design — consistency + standard filtering params
- https://treblle.com/blog/rest-api-endpoint-design-guide — optimize within a consistent framework, not rigid uniformity
