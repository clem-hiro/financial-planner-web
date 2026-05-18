# Consent Gate — Phase 2 Prod-Apply Runbook (user-run)

Operator runbook for shipping Consent-Gate **Phase 2** (`20260529000000_advisor_consent_phase2.sql`)
to the **shared production** Supabase. The coding agent is environment-blocked from any prod
connection; **you (the user) execute every prod step yourself** in the prod Supabase SQL editor.
This file is self-contained and copy-pasteable — you do not need the agent to run it.

> No migration ledger. Migrations are hand-applied to a shared prod via the SQL editor.
> `20260529000000` is **idempotent by construction** (`add column if not exists`,
> `create or replace function`, `drop ... if exists`, guarded `do $$`) — safe to re-run and
> safe if a prior apply was partial.

---

## 0. Scope

- **What this applies:** Phase 2 — the consent chokepoint completion: `seq bigint generated always
  as identity` tie-break column on `advisor_client_consents`; 10 `advisor_read_*` SECURITY DEFINER
  RPCs; roster `advisor_client_list_metrics`/`_count` → security definer + per-row
  `advisor_can_read_client`; consent-independent `advisor_linked_client`; the amended ship-gate
  audit; and the drop of all legacy advisor cross-user `financial_*` policies.
- **Prereq already done:** Phase 1 (`20260528000000_advisor_consent_invariant.sql`) is **already
  applied to prod** (HANDOFF: Phase 1 shipped + structural prod checks 2a–2e verified).
  `verify_consent_gated_access()` currently RAISEs on the 10 not-yet-migrated tables — that is the
  Phase-2 backlog this apply closes.
- **No data migration.** Phase 2 adds a column + RPCs + policy drops only. Zero row backfill.

---

## 1. HARD GATES — all three must be TRUE before you touch prod

Do **not** proceed past this section until every box is checked.

- [ ] **G1 — PDPA legal copy is real (HARD #9 gate).**
  `src/server/advisor-consent.ts` ships `CONSENT_TEXT` / `CONSENT_VERSION` as a flagged
  **placeholder** (see the `⚠ TODO(product/legal)` block, ~lines 18–26: `CONSENT_VERSION = "v1"`,
  placeholder `CONSENT_TEXT`). Serving placeholder legal copy to real users is **not acceptable**.
  Before prod apply: the reviewed PDPA disclosure text replaces the placeholder and
  `CONSENT_VERSION` is set to the approved version string. Per-event `consent_text`/`consent_version`
  recording keeps prior grants attributable, so bumping the version is safe and intended.
  _Verify:_ open `src/server/advisor-consent.ts`, confirm the `⚠ TODO(product/legal)` placeholder
  block is gone and the text is the legal-approved copy.

  - [ ] **G1a — `CONSENT_VERSION` string is user-confirmed.** It is recorded per consent
    event for legal attributability and must be a stable, dated identifier. **Proposed
    (pending user confirmation): `2026-05-18.option-b`.** Do not prod-apply until the user
    confirms the exact version string.
  - [ ] **G1b — supporting helper line is user-confirmed.** A small non-legal helper line
    shown beneath the consent text (withdrawal-location pointer). **Proposed (pending user
    confirmation): "Manage or withdraw this anytime in More → Privacy & Advisor Access."**
    This is functional UX copy, not legal language — user confirms wording before prod apply.
  - [ ] **G1c — recorded `consent_text` is the RENDERED string.** The canonical copy is a
    template with a single `{adviserName}` interpolation, server-resolved from the client's
    own advisor linkage (never client/form input). The per-event `consent_text` stores the
    **rendered** string (with the actual resolved adviser name) — that is the exact text the
    client agreed to. Confirm this is the recorded form (not the raw template).

- [ ] **G2 — Step-0 migration-dup reconciliation is done (#8, LEAD-GATED).**
  The standing byte-identical `profile_expense_growth_nominal` duplicate-prefix pair (cash-flow
  co-dev merge provenance) was reconciled on 2026-05-18 with a CleAyz heads-up: the dead
  byte-identical copy deleted, the surviving file renamed to a free unique prefix
  (`20260525000001_profile_expense_growth_nominal.sql`), and INVARIANTS.md updated. Filename
  hygiene only — no prod change (the column is already applied; the migrations are idempotent).
  **This step is lead-coordinated and gated on the CleAyz heads-up — do not perform it ad hoc.**
  Only confirm here that the lead has reported it complete on a clean branch.

- [ ] **G3 — Scratch verification is GREEN and the branch is clean.**
  On a `sandbox`-synced branch (merged with `origin/main`, **never rebased**), with the working
  tree clean (`git status --porcelain` empty except intended Phase-2 files):
  - `npm test` → 305/305 pass
  - `npm run check:scratch-verify` → `OK: ... embedded byte-identical ...`
  - The scratch verifier has been run by you in a **throwaway/scratch** Supabase SQL editor
    (paste `supabase/tests/scratch_verify_phase2.sql` whole) and the final row reads
    **`ship_gate = OK`** with every `SCENARIO 6..12: PASS` notice. (Scratch is disposable; never
    point this at prod; never restore a scratch dump onto prod.)

---

## 2. The exact prod apply

1. Open the **production** Supabase project → **SQL Editor** → new query.
2. Open `supabase/migrations/20260529000000_advisor_consent_phase2.sql` from the **branch you
   verified in G3**, select **all**, copy.
3. Paste the entire file into the prod SQL editor. Do **not** hand-edit it.
4. Run it. It is idempotent: a clean apply and a re-apply (or a retried partial apply) both end in
   the same state. If it errors, read the error, stop, and report to the lead — do not patch the
   SQL in the editor.

> Apply **only** `20260529000000`. `20260528000000` (Phase 1) is already on prod — re-running it is
> safe (idempotent) but unnecessary.

---

## 3. Post-apply verification (run on PROD, in order)

Run each, top to bottom, in the prod SQL editor. **Stop on the first failure** and report.

```sql
-- 3a. SHIP GATE — the primary structural proof. Data-independent: scans
--     pg_policies / pg_class, not rows. MUST return exactly: OK
select public.verify_consent_gated_access() as ship_gate;

-- 3b. The seq tie-break column exists and is identity-generated.
select column_name, is_identity, identity_generation
from information_schema.columns
where table_schema = 'public' and table_name = 'advisor_client_consents'
  and column_name = 'seq';   -- expect: seq | YES | ALWAYS

-- 3c. The 14 consent chokepoint functions exist and are SECURITY DEFINER,
--     not executable by PUBLIC/anon (only `authenticated`): the 11 read
--     surfaces (advisor_read_investments is from already-applied Phase 1) +
--     advisor_linked_client + the 2 roster RPCs.
select p.proname, p.prosecdef as security_definer,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_exec,
       has_function_privilege('public',        p.oid, 'execute') as public_can_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('advisor_read_expenses','advisor_read_goals','advisor_read_budget_lines',
    'advisor_read_budget_line_month_overrides','advisor_read_cash_accounts',
    'advisor_read_liabilities','advisor_read_cpf_balances','advisor_read_housing_loans',
    'advisor_read_vehicles','advisor_read_investments','advisor_read_profile',
    'advisor_linked_client','advisor_client_list_metrics','advisor_client_list_count')
order by p.proname;
-- expect every row: security_definer = t, auth_can_exec = t, public_can_exec = f

-- 3d. No legacy advisor cross-user policy survived on any financial_* table.
--     (verify_consent_gated_access already enforces this; this is the human-
--     readable confirmation.) Expect ZERO rows.
select tablename, policyname, roles, qual
from pg_policies
where schemaname = 'public' and tablename like 'financial\_%'
  and (qual ilike '%auth.uid()%' or coalesce(with_check,'') ilike '%auth.uid()%')
  and qual not ilike '%advisor_can_read_client%'
  and coalesce(with_check,'') not ilike '%advisor_can_read_client%'
  and qual not ilike '%user_id%' and qual not ilike '%id =%';  -- non-self, non-consent
```

**Pass condition:** 3a returns `OK`; 3b returns `seq | YES | ALWAYS`; every 3c row is
`t / t / f`; 3d returns no rows. If `verify_consent_gated_access()` already proved `OK` on the
scratch clone (G3) it is data-independent and will prove `OK` here too — 3a is the gate of record.

---

## 4. Pre-Prod Checklist — Phase-2-adapted (the final ship gate)

Carried forward from the Phase-1 doc's 10-point Pre-Prod checklist, adapted to what Phase 2
changes (Phase 2 adds **no new tables**, so the new-table RLS items become column/RPC/policy
items). All ten must hold; most are proven mechanically by §3.

1. **RLS still enabled** on every `financial_*` base table (no fail-open) — proven by §3a check #1.
2. **No cross-user `financial_*` policy** that does not route through `advisor_can_read_client`
   and is not a recognised self form — proven by §3a check #2 + §3d.
3. **No public/anon mis-scoped `financial_*` policy** that is neither self nor consent-routed —
   proven by §3a check #3 (the amended option-B narrowing).
4. **All 11 read surfaces are SECURITY DEFINER**, `revoke all ... from public`,
   `grant execute ... to authenticated` — proven by §3c.
5. **`search_path` is pinned** on the SECURITY DEFINER functions (`set search_path = public,
   pg_catalog` / `public, extensions` as written in the migration) — present in the applied DDL
   (do not edit it in the editor).
6. **`seq` tie-break column** exists, `generated always as identity`, so same-tick
   grant/withdraw resolves deterministically (C1 invariant, TS `Number(seq)` agrees) — §3b + the
   scratch S7 PASS.
7. **Roster is consent-gated**: `advisor_client_list_metrics`/`_count` are security definer with
   per-row `advisor_can_read_client` (identity-only for non-consented) — scratch S8 PASS + §3c.
8. **Linkage is consent-independent**: `advisor_linked_client` returns the linked client without
   consent; `advisor_read_profile` stays gated — scratch S10 PASS.
9. **PDPA legal copy is real** (G1) — `CONSENT_TEXT`/`CONSENT_VERSION` are the approved values,
   not the placeholder.
10. **Ship gate returns `OK` on prod** — §3a. This is the data-independent final gate; it RAISEs
    on any regression of items 1–3.

> The event trigger / superuser concern from Phase 1 (Pre-Prod item #4) is **not re-introduced**
> by Phase 2 (Phase 2 adds no event trigger); Phase 1's trigger remains as applied.

---

## 5. Post-ship (same task as the prod apply)

1. **`PROJECT_CONTEXT.md`** — in the same task as the ship, update:
   - **Feature inventory (shipped vs planned)**: set the advisor consent-gate / client consent
     control rows to **Shipped** with a one-line note.
   - **Routes** / **Database** bullets if user-visible surfaces changed (client consent control
     under `/more`; the 11 `advisor_read_*` RPCs / `seq` column).
   - the **`_Last reviewed_`** line.
   Per `.cursor/rules/update-project-context-on-ship.mdc` — do not leave this for later.
2. **BYOFA Notion sync** — after editing the inventory, reconcile [BYOFA Features] via the
   **Notion MCP (`user-notion`)** per `.cursor/rules/project-context-notion-sync.mdc`
   (status mapping: Shipped → Done). Or tell the agent **"sync BYOFA"**.
3. **Branch / PR (merge-never-rebase SOP, from HANDOFF):**
   - Co-dev CleAyz pushes `sandbox`/`main` in parallel: **fetch + divergence check**, optional
     pre-PR `merge origin/main` → sandbox if conflicts (**never rebase** the shared `sandbox`).
   - Open the `sandbox` → `main` PR and **squash-merge** it (sandbox carries iteration churn;
     squash keeps `main` clean).
   - **Mandatory post-merge back-merge** `origin/main` → `sandbox` (squash always re-diverges the
     branches by construction — re-sync immediately).

---

## 6. Rollback

- **Phase 2 is additive + idempotent.** There is no destructive data change to roll back.
- If the ship gate fails post-apply: the failing policy/table is named in the `RAISE` message.
  Do not improvise SQL on prod — capture the exact message, report to the lead, and reconcile on
  a branch + re-verify on scratch before re-applying (re-apply is safe — idempotent).
- App-side rollback (if needed) is a normal code revert + back-merge; it does not require a DB
  downgrade because the RPCs/column are inert unless the app calls them.

[BYOFA Features]: https://www.notion.so/BYOFA-Features-35fa694147bf8093be2fc57673cee41a
