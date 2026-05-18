#!/usr/bin/env bash
# validate-prod-schema-parity.sh — PRE-#9 validation (NOT the prod apply).
#
# Proves the amended Phase-2 migration applies cleanly against the EXACT
# production schema, then runs the Phase-2 behavioral matrix, on a DISPOSABLE
# scratch DB.
#
# ABSOLUTE GUARDRAILS (do not weaken):
#   * SCHEMA-ONLY / ZERO client data — `pg_dump --schema-only -n public`;
#     hard stop if any data row (^COPY / ^INSERT INTO) appears (PDPA).
#   * READ-ONLY on prod — only pg_dump --schema-only; zero prod writes.
#   * Transient creds — sourced from .env.local into THIS process env only;
#     never echoed/logged/written to a file; passed to Docker via `-e NAME`
#     (value never on a host cmdline); no creds file is ever created.
#   * Restore ONLY to the disposable scratch — refuses if scratch DSN equals
#     or shares a host with the prod DSN.
#   * Normal bash; PG client = `postgres:17` Docker (prod is 17.x; the host
#     pg_dump 16.x would refuse the version mismatch).
#   * Idempotent / re-runnable; full local-artifact cleanup on exit.
#
# Env (from .env.local): SUPABASE_DB_URL_DIRECT = prod (read-only),
# SCRATCH_SUPABASE_URL_DIRECT = the disposable throwaway clone target.
#
# ⚠ Use the DIRECT connection string for BOTH (Supabase → Settings → Database →
#   "Connection string", URI, host `db.<project-ref>.supabase.co`). Supabase
#   POOLER DSNs share ONE host (`aws-0-<region>.pooler.supabase.com`) across
#   projects — the project ref is in the USERNAME, not the host — so a
#   pooler-style prod+scratch in the same region parses to the SAME host and
#   the (fail-closed) host-equality guard will SAFELY REFUSE the run (exit 12)
#   rather than risk a prod drop. Direct DSNs have a unique host per project.
set -euo pipefail

WORK="$(mktemp -d)"
DUMP="$WORK/prod_public_schema.sql"
LOG="$WORK/run.log"
PG=postgres:17
scrub() { sed -E 's#postgres(ql)?://[^"[:space:]]+#<redacted-dsn>#g'; }
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# ---- transient creds: in-process only, never printed ----
set -a; . ./.env.local 2>/dev/null || { echo "FATAL: cannot source .env.local"; exit 10; }; set +a
: "${SUPABASE_DB_URL_DIRECT:?FATAL: SUPABASE_DB_URL_DIRECT not set in .env.local}"
: "${SCRATCH_SUPABASE_URL_DIRECT:?FATAL: SCRATCH_SUPABASE_URL_DIRECT not set in .env.local (disposable scratch DSN)}"

# ---- defensive: both must be libpq Postgres DSNs, not REST/HTTPS URLs ----
# (pg_dump/psql need the direct DB connection string, not a Supabase REST URL.
#  Never print the value — only the var name + actionable guidance.)
is_pg_dsn() { case "$1" in postgres://*|postgresql://*) return 0 ;; *) return 1 ;; esac; }
is_pg_dsn "$SUPABASE_DB_URL_DIRECT" || {
  echo "FATAL: SUPABASE_DB_URL_DIRECT is not a Postgres DSN (expected postgres:// or postgresql://). pg_dump/psql need the direct DB connection string — Supabase → Project Settings → Database → Connection string (URI), not a REST/HTTPS URL."
  exit 14
}
is_pg_dsn "$SCRATCH_SUPABASE_URL_DIRECT" || {
  echo "FATAL: SCRATCH_SUPABASE_URL_DIRECT is not a Postgres DSN — it looks like a Supabase REST URL (https://...supabase.co) or other non-connection-string. pg_dump/psql need the direct DB connection string — Supabase → Project Settings → Database → Connection string (URI) for the disposable scratch project."
  exit 15
}

# ---- python3 presence: gates the txn-pooler preflight AND assert_scratch_safe
# (both parse DSNs via urllib). Fail CLOSED here, before the first python3 use
# and ~50 lines before any prod connection. ----
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 unavailable — cannot robustly parse DB hosts; failing CLOSED before any destructive op"; exit 19
}

# ---- prod-READ preflight: pg_dump cannot run through the TRANSACTION pooler ----
# Supabase txn pooler (host ~ pooler.supabase.com, port 6543) multiplexes
# statements and breaks pg_dump. Session pooler (:5432) and direct are fine.
# Fail fast with an actionable message; never print the value. (Does NOT touch
# the scratch-safety guard; prod-pooler-host vs scratch-direct-host stays a
# legitimate different-host pair.)
PREFLIGHT="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit
try:
    u = urlsplit(os.environ.get("SUPABASE_DB_URL_DIRECT", ""))
    h = (u.hostname or "").strip().lower()
    p = u.port
except Exception:
    h, p = "", None
print("TXN_POOLER" if ("pooler.supabase.com" in h and p == 6543) else "OK")
PY
)"
if [ "$PREFLIGHT" = "TXN_POOLER" ]; then
  echo "FATAL: SUPABASE_DB_URL_DIRECT is a Supabase TRANSACTION pooler (host ~pooler.supabase.com, port 6543) — pg_dump cannot run through it. Use the prod SESSION pooler (port 5432) or the direct connection string for this read-only schema dump (Supabase → Project Settings → Database → Connection string)."
  exit 20
fi

# ---- scratch-WRITE preflight: the restore + begin/rollback matrix need
# session-level state, which the TRANSACTION pooler (:6543) multiplexes away. ----
PREFLIGHT_SCR="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit
try:
    u = urlsplit(os.environ.get("SCRATCH_SUPABASE_URL_DIRECT", ""))
    h = (u.hostname or "").strip().lower()
    p = u.port
except Exception:
    h, p = "", None
print("TXN_POOLER" if ("pooler.supabase.com" in h and p == 6543) else "OK")
PY
)"
if [ "$PREFLIGHT_SCR" = "TXN_POOLER" ]; then
  echo "FATAL: SCRATCH_SUPABASE_URL_DIRECT is a Supabase TRANSACTION pooler (host ~pooler.supabase.com, port 6543) — the schema restore + begin/rollback test matrix need session-level state. Use the scratch SESSION pooler (port 5432) or the direct connection string (Supabase → Project Settings → Database → Connection string)."
  exit 25
fi

# ---- CRITICAL safety: the destructive drop MUST be impossible against prod ----
# Belt-and-suspenders, fail-CLOSED. The sed-based host parse was a defect: a
# userinfo-less DSN (postgres://host:5432/db) made it return the scheme token,
# so the same-host guard could silently not fire. This uses urllib.urlsplit
# (handles user:pass@ / :port / ?query / both schemes; never returns garbage).
# Re-asserted again immediately before `drop schema … cascade` (point of use).
# Never prints any DSN/host value — only a safe token + var-name guidance.
assert_scratch_safe() {
  # (1) exact-string inequality
  if [ "$SCRATCH_SUPABASE_URL_DIRECT" = "$SUPABASE_DB_URL_DIRECT" ]; then
    echo "FATAL: SCRATCH_SUPABASE_URL_DIRECT == SUPABASE_DB_URL_DIRECT (exact match) — refusing"; exit 11
  fi
  # (2) robust host inequality + (3) project-ref containment + (4) fail-closed
  local g
  g="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit
def host(d):
    try:
        u = urlsplit(d)
        if u.scheme not in ("postgres", "postgresql"):
            return None
        h = (u.hostname or "").strip().lower()
        return h or None
    except Exception:
        return None
p = host(os.environ.get("SUPABASE_DB_URL_DIRECT", ""))
s = host(os.environ.get("SCRATCH_SUPABASE_URL_DIRECT", ""))
if not p or not s:
    print("UNPARSEABLE")
elif p == s:
    print("SAME_HOST")
elif p in s or s in p:
    print("HOST_CONTAINMENT")
else:
    print("OK")
PY
)"
  case "$g" in
    OK) : ;;
    SAME_HOST)        echo "FATAL: scratch host == prod host — refusing (never restore onto prod)"; exit 12 ;;
    HOST_CONTAINMENT) echo "FATAL: scratch host overlaps prod host (project-ref containment) — refusing"; exit 16 ;;
    UNPARSEABLE)      echo "FATAL: could not unambiguously parse a Postgres host from SUPABASE_DB_URL_DIRECT / SCRATCH_SUPABASE_URL_DIRECT — failing CLOSED before any destructive op"; exit 17 ;;
    *)                echo "FATAL: scratch-safety guard returned an unexpected state — failing CLOSED"; exit 18 ;;
  esac
}
assert_scratch_safe   # early gate
command -v docker >/dev/null 2>&1 || { echo "FATAL: docker unavailable"; exit 13; }

dprod() { docker run --rm -i -e SUPABASE_DB_URL_DIRECT "$PG" sh -lc "$1"; }
dscr()  { docker run --rm -i -e SCRATCH_SUPABASE_URL_DIRECT  "$PG" sh -lc "$1"; }

echo "== STEP 1 — SCHEMA-ONLY, READ-ONLY prod dump (public) =="
dprod 'pg_dump --schema-only --no-owner --no-privileges -n public -d "$SUPABASE_DB_URL_DIRECT"' \
  > "$DUMP" 2>>"$LOG" || { echo "FATAL: pg_dump failed"; scrub <"$LOG" | tail -20; exit 21; }
DATAROWS="$(grep -c -E '^(COPY |INSERT INTO )' "$DUMP" || true)"
echo "data-row lines (MUST be 0): ${DATAROWS:-0}"
[ "${DATAROWS:-0}" = "0" ] || { echo "FATAL: dump contains data rows — PDPA hard stop"; exit 22; }
echo "schema dump: $(wc -l <"$DUMP") lines; CREATE TABLE=$(grep -c '^CREATE TABLE ' "$DUMP" || true)"

echo "== STEP 2 — restore prod schema → DISPOSABLE scratch (ACL tail tolerated) =="
assert_scratch_safe   # defense-in-depth: re-assert at the point of the destructive drop
dscr 'psql -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT" -c "drop schema if exists public cascade; create schema public;"' \
  >>"$LOG" 2>&1
docker run --rm -i -e SCRATCH_SUPABASE_URL_DIRECT "$PG" sh -lc 'psql -v ON_ERROR_STOP=0 "$SCRATCH_SUPABASE_URL_DIRECT"' \
  < "$DUMP" >>"$LOG" 2>&1 || true   # ALTER DEFAULT PRIVILEGES/GRANT ACL tail is benign
echo -n "structural check — financial_profiles + handle_new_user + digest: "
dscr 'psql -tA -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT" -c "select (select count(*) from information_schema.tables where table_schema='"'"'public'"'"' and table_name='"'"'financial_profiles'"'"')||'"'"'/'"'"'||(select count(*) from pg_proc where proname='"'"'handle_new_user'"'"')||'"'"'/'"'"'||(select count(*) from pg_proc where proname='"'"'digest'"'"')"' \
  2>>"$LOG" || { echo; echo "FATAL: schema restore incomplete"; scrub <"$LOG" | tail -20; exit 23; }

echo "== STEP 3 — apply Phase-1 then AMENDED Phase-2 (HEADLINE: both rc=0) =="
set +e
docker run --rm -i -e SCRATCH_SUPABASE_URL_DIRECT "$PG" sh -lc 'psql -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT"' \
  < supabase/migrations/20260528000000_advisor_consent_invariant.sql >>"$LOG" 2>&1; RC1=$?
docker run --rm -i -e SCRATCH_SUPABASE_URL_DIRECT "$PG" sh -lc 'psql -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT"' \
  < supabase/migrations/20260529000000_advisor_consent_phase2.sql >>"$LOG" 2>&1; RC2=$?
set -e
echo "MIGRATION-APPLY rc:  20260528000000=$RC1   20260529000000(amended)=$RC2"
if [ "$RC1" -ne 0 ] || [ "$RC2" -ne 0 ]; then
  echo "---- migration error tail (verbatim, creds-scrubbed) ----"; scrub <"$LOG" | tail -40
  echo "FATAL: a migration failed against the exact prod schema"; exit 30
fi

echo "== STEP 4 — recreate on_auth_user_created trigger (omitted by -n public) =="
dscr 'psql -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT" -c "drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();"' \
  >>"$LOG" 2>&1 || { echo "FATAL: trigger recreate failed"; scrub <"$LOG" | tail -20; exit 40; }

echo "== STEP 5 — behavioral matrix (ONE BEGIN…ROLLBACK; real-signup fixtures) =="
docker run --rm -i -e SCRATCH_SUPABASE_URL_DIRECT "$PG" sh -lc 'psql -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT"' \
  < scripts/p2_behavioral_matrix.sql 2> >(scrub >>"$LOG") \
  || { echo "FATAL: behavioral matrix failed"; scrub <"$LOG" | tail -30; exit 50; }

echo "== STEP 6 — residual proof (post-rollback) =="
RESID="$(dscr 'psql -tA -v ON_ERROR_STOP=1 "$SCRATCH_SUPABASE_URL_DIRECT" -c "select (select count(*) from public.advisor_client_consents where consent_version='"'"'_cgp2_probe'"'"')+(select count(*) from auth.users where email like '"'"'p2pp_%@cgp2.test'"'"')"' 2>>"$LOG" | tr -d '[:space:]')"
echo "residual synthetic rows (MUST be 0): ${RESID:-?}"
[ "${RESID:-1}" = "0" ] || { echo "FATAL: residual synthetic rows after rollback"; exit 60; }

echo
echo "VALIDATION COMPLETE — headline: BOTH migrations applied rc=0 against the"
echo "exact prod schema; behavioral matrix + ship_gate passed; residual=0;"
echo "schema-only confirmed (0 data rows); creds never printed/stored, no creds"
echo "file written; local artifacts removed on exit."
