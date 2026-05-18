# pgcrypto unqualified-call / restricted search_path audit

**Task:** #5 — enumerate every function in `supabase/migrations/*.sql` that calls a
pgcrypto function (`gen_random_bytes`, `digest`, `gen_salt`, `crypt`, `hmac`,
`pgp_*`, `encrypt_iv`/`decrypt_iv`, `armor`/`dearmor`) **unqualified** while
declared `set search_path = public` (or any path excluding `extensions`).
**Read-only audit. No code changed.**

## Method

`rg` for all listed pgcrypto symbols across every migration (excluded
`gen_random_uuid` — core `pg_catalog` in PG13+, not pgcrypto, search_path
irrelevant; no `uuid-ossp`/`uuid_generate_*` usage exists). Every hit mapped to
its enclosing `create … function`, that function's `set search_path` clause, and
whether a later migration `create or replace`s it with a corrected path.

## Complete pgcrypto call-site inventory

Exactly **5 call sites**, in **3 distinct functions**:

| # | file:line | pgcrypto call | enclosing function | function's `set search_path` |
|---|---|---|---|---|
| 1 | `20260523000000_qr_token_hash_and_atomic_redeem.sql:58` | `digest(p_token,'sha256')` | `public.peek_qr_share_token(text)` (def @44) | `set search_path = public` (@48) |
| 2 | `20260523000000_qr_token_hash_and_atomic_redeem.sql:84` | `digest(p_token,'sha256')` | `public.redeem_qr_share_token(text,uuid)` (def @72) | `set search_path = public` (@76) |
| 3 | `20260527000000_qr_digest_search_path_fix.sql:44` | `digest(p_token,'sha256')` | `public.peek_qr_share_token(text)` (def @30) | `set search_path = public, extensions` (@34) |
| 4 | `20260527000000_qr_digest_search_path_fix.sql:67` | `digest(p_token,'sha256')` | `public.redeem_qr_share_token(text,uuid)` (def @55) | `set search_path = public, extensions` (@59) |
| 5 | `20260517100000_advisor_key_purchases_coupons_contact.sql:557` | `gen_random_bytes(16)` | `public.fulfill_access_key_purchase(text,integer,text,text)` (def @353) | `set search_path = public` (@362) |

## Live-definition resolution (last `create or replace` wins)

- **`peek_qr_share_token`** — defs: `20260522000000:45` (no pgcrypto — plaintext
  token match), `20260523000000:44` (`public`, digest — vulnerable as written),
  **`20260527000000:30` (`public, extensions` — FIXED, this is the live def).**
- **`redeem_qr_share_token`** — defs: `20260523000000:72` (`public`, digest —
  vulnerable as written), **`20260527000000:55` (`public, extensions` — FIXED,
  live def).**
- **`fulfill_access_key_purchase`** — **ONE def only**: `20260517100000:353`.
  Never `create or replace`d again. `set search_path = public` (@362), calls
  `gen_random_bytes(16)` unqualified (@557, key-generation loop). **LIVE and
  NOT fixed.**

## Definitive corrective-migration scope

**Exactly one function** requires the corrective migration:

> **`public.fulfill_access_key_purchase(text, integer, text, text)`**
> — `supabase/migrations/20260517100000_advisor_key_purchases_coupons_contact.sql`
> — definition line **353**, `set search_path = public` line **362**
> — unqualified `gen_random_bytes(16)` line **557**

**Excluded (already correct), per task instruction and confirmed here:**
the QR pair `peek_qr_share_token` / `redeem_qr_share_token` — superseded by
`20260527000000` with `set search_path = public, extensions`. The vulnerable
`20260523000000` definitions are dead (later migration always lands after, and
the no-ledger hand-apply convention re-applies the latest create-or-replace).
No corrective action there.

No other migration calls any pgcrypto function. There is no preview/fulfill
*pair*: in `20260517100000`, `validate_coupon_for_purchase` (@237) and
`fulfill_access_key_purchase` (@353) are the purchase pair, but only `fulfill`
touches pgcrypto (`validate_coupon_for_purchase` body 237–352 has zero pgcrypto
calls). `get_my_advisor_contact` (@583) and `handle_new_user` (@642) in the same
migration call no pgcrypto.

## Conflict surfaced (do not silently reconcile) — affects corrective design + needs a user runtime check

Two authority docs disagree on **where pgcrypto actually lives on prod**, which
determines whether call site #5 is a *live break* or *latent-only*:

- **`LEARNINGS.md` `[correction]`**: "pgcrypto lives in the `public` schema in
  this deployment, NOT `extensions`… call pgcrypto fns unqualified inside
  functions that `set search_path = public`; never schema-qualify with
  `extensions.`" → under this, `fulfill_access_key_purchase` **works on prod
  today** (latent risk only if pgcrypto is ever moved).
- **`20260527000000` header comment**: "pgcrypto lives in `extensions` on prod,
  so digest() is NOT on the functions' [path]" → under this, the QR break was
  real, and `fulfill_access_key_purchase` is **currently broken on prod** (every
  key-purchase fulfillment would raise `function gen_random_bytes(integer) does
  not exist`).
- **`INVARIANTS.md`** sides with resilience: peek/redeem use
  `set search_path = public, extensions`; "resolves regardless of pgcrypto
  schema… do NOT hard-qualify."

**Recommended corrective shape (safe under either truth, honors the
no-hard-qualify convention):** re-`create or replace`
`fulfill_access_key_purchase` changing **only** `set search_path = public` →
`set search_path = public, extensions` (the exact proven `20260527000000`
pattern). Keep `gen_random_bytes` unqualified. Idempotent (create-or-replace),
no behavior change, no schema change.

**User runtime check (operator/user action — no agent prod access):** the
authoritative disambiguation is, on the **prod** DB:
`select extnamespace::regnamespace from pg_extension where extname='pgcrypto';`
This decides whether the corrective migration is **urgent** (pgcrypto in
`extensions` ⇒ key purchasing is broken now) or **hardening** (pgcrypto in
`public` ⇒ latent). It does not change the recommended corrective shape, only
its priority.
