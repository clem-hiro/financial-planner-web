# QR-hardening scenario matrix

Verifies `supabase/migrations/20260523000000_qr_token_hash_and_atomic_redeem.sql`
(P0 + P1-a/b/c/d). The repo has **no DB integration harness** and the P0
invariant lives in the `handle_new_user` auth-insert trigger — only meaningfully
testable against a real Postgres (decision: option 3, no new dependency). The
trigger/RLS matrix is an operator-run SQL runbook; pure logic is automated.

## What is automated (vitest, `npm test`)

| Coverage | File |
|---|---|
| `qrShareTokenSchema` accepts exactly 22, rejects 21/23/24/25/non-base64url/empty | `src/lib/validation.test.ts` |
| `tokenHash` determinism + `sha256("")` vector (Node ↔ Postgres `encode(...,'hex')` parity) | `src/server/advisor-qr-share.test.ts` |
| `formatSignupError` maps `qr_token_invalid` (bare + Supabase-wrapped) → expired-link copy | `src/features/auth/signup-error.test.ts` |

## How to run the SQL matrix

Against a **scratch** Postgres/Supabase (never shared prod), as owner/service role:

```bash
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/qr_redeem_scenarios.sql
```

Every scenario is `begin … rollback` (nothing persists). Success prints
`SCENARIO n: PASS`; a failed `assert` aborts with the scenario's message.
Adjust the `pg_temp.mk_user` `auth.users` column list if your GoTrue version
rejects a NOT NULL column — only `id`, `email`, `raw_user_meta_data`, and the
`*_at` timestamps are load-bearing for the trigger.

## Matrix (input → expected → actual → pass/fail)

`actual`/`pass` columns are filled per operator run. Status legend: **auto** =
covered by vitest; **sql** = single-session block in `qr_redeem_scenarios.sql`;
**operator-verify** = needs a live DB / two sessions / manual UI (overlaps
`HANDOFF.md` §5 real-phone QR smoke).

| # | Scenario (input) | Expected | Status |
|---|---|---|---|
| 1 | Valid token, client signup | client bound to issuing advisor; key `claimed`; token `consumed_at`+`claimed_by_user_id` set | sql |
| 2 | Valid token, signUp raises (dup email) | full rollback: no client profile; token `consumed_at IS NULL` | sql |
| 3 | Expired token | trigger `qr_token_invalid`; signup fails; token untouched | sql |
| 4 | Replay (consumed, different email) | `qr_token_invalid`; no 2nd binding; original claim intact | sql |
| 5 | Double-submit same token+email | exactly one binding | sql |
| 6 | Concurrent two mints, same key (P1-d) | exactly one live token row for (advisor,key) | operator-verify (2 sessions) |
| 7 | Key claimed via non-QR path then render (P1-c) | no dead token reused | code-verified (see below) |
| 8 | Non-QR manual access-key signup | unchanged: key claimed, client bound | sql |
| 9 | Advisor signup (no key/token) | unchanged: advisor profile, `advisor_user_id` null | sql |
| 10 | Hash at rest (P1-a) | only `token_hash`; raw token absent from the table | sql |
| 11 | LoginForm QR branch sends `qr_token` not `access_key` | `signUp` metadata has `qr_token`, no `access_key`, no pre-validate RPC | operator-verify (manual, see below) |
| 12 | Advisor identity banner (P1-b) | scan view shows "You're connecting with <Advisor>" before signup | operator-verify (manual, see below) |

### Scenario 6 — concurrent mint (two psql sessions)

`mint_qr_share_token` requires `auth.uid()` = advisor. In two sessions, set the
JWT sub then call the RPC for the same (advisor, key):

```sql
-- both sessions, after fixture commit on the scratch DB:
select set_config('request.jwt.claim.sub', '<ADVISOR_UUID>', false);
begin;
select public.mint_qr_share_token(
  encode(extensions.digest('rawA','sha256'),'hex'), '<KEY>', '<ADVISOR_UUID>', now()+interval '15 min');
-- keep session A's txn open; run the same in session B with 'rawB' — B blocks
-- on the FOR UPDATE access-key lock until A commits.
commit;  -- then B proceeds, retires A's token, inserts its own
```

Then assert exactly one live token:

```sql
select count(*) from public.advisor_qr_share_tokens
where advisor_user_id = '<ADVISOR_UUID>' and access_key = '<KEY>'
  and consumed_at is null;          -- expected: 1
```

Without the `FOR UPDATE` (pre-migration `if not exists`), B would not block and
two live rows could result — that is the P1-d regression this guards.

### Scenario 7 — P1-c (code-verified by absence)

The pre-migration bug was `peekExistingLiveToken` reusing a token whose key was
no longer `available`. The fix removes the function entirely: since only
`sha256(token)` is stored, the raw token can't be reconstructed to reuse a prior
QR, so `buildShareData` always mints fresh, and `mint_qr_share_token`'s
`SELECT … FOR UPDATE … status='available'` rejects a non-available key. Verify:

```bash
rg -n 'peekExistingLiveToken' src/        # expect: no matches (function deleted)
rg -n 'await mintQrShareToken' src/server/advisor-qr-share.ts   # buildShareData always mints
```

### Scenarios 11–12 — LoginForm manual checks (no React harness)

No jsdom/@testing-library in the repo, so these are manual on a Vercel preview
(overlaps `HANDOFF.md` §5 item 4 real-phone QR smoke):

- **11**: scan a live QR → `/login?qr_token=…`; in DevTools Network, the
  `auth/v1/signup` request body `data` must contain `qr_token` and **no**
  `access_key`; no `validate_client_access_key_for_signup` RPC fires before it.
  Manual-key signup (no QR) must still send `access_key` and call
  `validate_client_access_key_for_signup` (unchanged).
- **12**: the scan view renders the calm banner "You're connecting with
  **<Advisor display name>**" above the form before the user signs up; an
  invalid/expired token shows no banner (peek returns nothing).

---

# Consent-Gate Phase 2 — scratch verifier

`advisor_consent_scenarios.sql` is the canonical operator runbook (S1–S11).
`scratch_verify_phase2.sql` is a **single paste-once** script for the Supabase
SQL editor: precondition guard → the FULL amended
`20260529000000_advisor_consent_phase2.sql` (embedded **verbatim**, applied and
NOT rolled back — it is the test target) → self-contained synthetic scenarios
S6–S12 (`begin … rollback`) → `select public.verify_consent_gated_access() as
ship_gate;`.

Run **on the scratch project only** (applies real DDL; never prod). It needs
only the Phase-1 schema (`20260528000000`) present — data may be empty; every
scenario builds its own synthetic fixtures. Read `SCENARIO Sx: PASS` lines and
the final `ship_gate = OK`; any failure `raise exception`s and aborts.

### Embedded-migration drift guard (CI / pre-amend)

The migration is duplicated inside `scratch_verify_phase2.sql` (necessary for
paste-once). After **any** edit to `20260529000000_advisor_consent_phase2.sql`,
re-embed it (replace the block between the `(b) BEGIN embedded` framing and the
`-- END embedded 20260529000000.` line with the new canonical contents,
byte-identical) and run:

```bash
npm run check:scratch-verify
```

It fails loudly (with the first divergent migration line) if the embedded copy
is stale — so the scratch gate can never validate out-of-date DDL and report a
false `ship_gate = OK`.
