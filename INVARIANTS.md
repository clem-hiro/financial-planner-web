# Invariants

Canonical registry of guarantees this codebase must never violate. **Cumulative and append-only** — an entry persists until explicitly retired (move it to "Retired" with reason + date; never delete). Each entry states the guarantee, why, how it is enforced, how to verify, and the date added.

> **Primacy (2026-05-17):** this file is the **single canonical home** for invariants. `HANDOFF.md` §7 has been collapsed to "Refer to INVARIANTS.md" — being non-session, this file survives `/passdown` and is readable by non-claude-code contributors. **Follow-up:** the `/passdown` skill's §7 step must be updated to maintain this file instead of regenerating §7. When anything conflicts, INVARIANTS.md wins.

---

## Consent-Gated Client-Data Access

_(added: 2026-05-17)_

**Guarantee.** A row of client financial data is readable only by (a) the owning client (self), or (b) an advisor for whom that client has an **active consent** record. No identity reads another user's client data without that user's current consent. There is no path around this; the default (no action, a forgotten policy, a new table) is **deny**.

**Why.** PDPA compliance for sensitive financial data, and the product rule that the client controls advisor visibility. Must hold for **future development that may not use claude-code** — so it cannot rely on the `$rls-audit` skill, CLAUDE.md/AGENTS.md conventions, CI linters, or reviewer discipline. Those are *process controls* (supplementary), **not** this invariant.

**Structural enforcement (DB-resident, tool-independent — two pillars).**
1. **Auto-RLS event trigger** `enforce_client_data_rls` — a Postgres `EVENT TRIGGER` on `ddl_command_end` that auto-`ENABLE ROW LEVEL SECURITY` on every new client-data table and `RAISE`s on a cross-user policy that does not route through the consent predicate. Fires for *any* migration source (claude-code, `psql`, the Supabase SQL editor, future tooling). Eliminates "forgot to enable RLS" and "copied a linkage-only policy".
2. **Single consent chokepoint** — the *only* RLS policies on client tables are self policies (`user_id = (select auth.uid())`). **No table has an advisor cross-user RLS policy.** All advisor→client reads go through SECURITY DEFINER functions that embed `advisor_can_read_client(p_client uuid)` (linkage AND latest-event-wins active consent). A new table is advisor-invisible by default; exposing it requires adding it to the consent-gated RPC surface, which structurally contains the consent check. The invariant holds by *absence of an alternative cross-user path*, not by presence of a correct per-table policy.

**Exact artifact strings (one term — no synonyms).**
- Invariant name: `Consent-Gated Client-Data Access`
- DB self-assertion: `verify_consent_gated_access()` (scans `pg_class`/`pg_policies`, `RAISE`s on any fail-open table or any cross-user policy bypassing the consent predicate)
- Event trigger: `enforce_client_data_rls`
- Consent predicate: `advisor_can_read_client(p_client uuid)`
- Consent ledger (append-only): `advisor_client_consents`

**How to verify (the ship gate).** Run the "Pre-Production Invariant Checklist — Consent-Gated Client-Data Access" in `~/.claude/plans/image-1-this-is-dapper-truffle.md` against **prod** (no-ledger reality ⇒ repo ≠ prod must be proven). Minimum: every `financial_*` base table `relrowsecurity=true`; zero cross-user `pg_policies` not routing through `advisor_can_read_client`; `select verify_consent_gated_access()` passes; event trigger present + enabled. Failures #1–#3 are P0; do not ship.

**Honest residual.** A superuser / table owner / Supabase **service-role** bypasses RLS, grants, and event triggers — true in any RDBMS; absolute enforcement vs a privileged actor is out of scope. The achievable invariant is: *default-deny + cross-boundary access only via the consent path + privileged bypass requires a deliberate, auditable act.* Bounded by **No service-role key in app code** below.

**Status (2026-05-17).** Designed, not yet implemented. Plan: `~/.claude/plans/image-1-this-is-dapper-truffle.md`. Open pre-build decisions in that plan: confirm this structural architecture; resolve the `financial_income_tax_configs` advice-integrity anomaly (advisor silently tax-blind — fix via a consent-gated RPC, recommended).

---

## Carried invariants (migrated verbatim from HANDOFF §7, 2026-05-17)

- **Phone single-source-of-truth: `auth.users.phone` only.** Never reintroduce `financial_profiles.phone_e164`/any mirror. Cross-user via `get_my_advisor_contact()` SECURITY DEFINER RPC. _(added: 2026-05-14)_
- **No app-level dev/prod gating for auth.** Every dev/prod difference is Supabase Dashboard config or per-env URL+anon key. _(added: 2026-05-14)_
- **`handle_new_user` must not consume `raw_user_meta_data.phone_e164`.** _(added: 2026-05-14)_
- **No service-role key in app code.** RLS is the trust boundary; cross-user via SECURITY DEFINER RPCs only. `scripts/` is the ONLY `SUPABASE_SERVICE_ROLE_KEY` consumer; never under `src/`; never `NEXT_PUBLIC_`. _(added: 2026-05-14, expanded: 2026-05-15)_
- **Migration filenames unique per timestamp prefix.** Latest on disk: `20260527000000_qr_digest_search_path_fix.sql`. **Consent-gate migrations reserved from `20260528000000`.** _(added: 2026-05-14, updated: 2026-05-17)_
- **`/auth/callback` `next=` validated** — same-origin, single `/`, ≤512 chars (`safeNext`). _(added: 2026-05-14)_
- **One cash-flow surplus engine: `sumInvestableSurplusOverHorizon`.** `gE=0 ∧ gI=0` byte-identical to the pre-extension [Debts] computation; never reintroduce a competing accrual. _(added: 2026-05-16)_
- **Net-worth-by-age chart caps surplus/bonus at target retirement age (Finding A).** Per-age `months: Math.min(p.monthsFromToday, monthsToRet)`; chart equals `projectedAtRetirement` at retirement. _(added: 2026-05-16)_
- **QR token stored only as `sha256` `token_hash`** — raw token never persisted; lives only in the QR URL. _(added: 2026-05-16)_
- **QR redemption atomic inside `handle_new_user`** (consume + key-claim + bind one txn; bad/replayed token RAISEs → rollback, fail-closed). No pre-signup consume, no fail-open. _(added: 2026-05-16)_
- **`digest()` in QR SECURITY DEFINER fns resolves regardless of pgcrypto schema** — `peek`/`redeem` use `set search_path = public, extensions`. Do NOT hard-qualify `extensions.digest`. _(added: 2026-05-16, repo-enforced+verified: 2026-05-17)_
- **Proposal preview == accept (C6).** Overlay + accept MUST use the ONE shared pure `applyProposalChanges` (`src/domain/advisor-proposals/apply-overlay.ts`); never a second transform, never a persisted "proposed plan" copy; overlay computed in-memory from persisted canonical + persisted proposal diff only; no-overlay `getDashboardPayload` byte-identical (identity return). **Merge-conflict rule:** if conflicting vs a pre-change `main`, KEEP this design — reject any duplicate mapper or persisted overlay snapshot. Anchored in-code at `apply-overlay.ts` + the `dashboard.ts` overlay seam. _(enforced & verified: 2026-05-17)_

---

## Retired Invariants

- ~~QR deeplinks carry only the opaque token, never the access key~~ — retired 2026-05-16 (code-enforced).
- ~~QR token: peek-on-GET, consume-on-POST~~ — retired 2026-05-16 (superseded by atomic-redeem-in-trigger).
- ~~`SITE_URL` is the production canonical origin, not `VERCEL_URL`~~ — retired 2026-05-16 (still true in `getSiteOrigin`).
