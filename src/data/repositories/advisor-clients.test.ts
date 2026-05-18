import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeConsentStatuses,
  getMyConsentStatusForAdvisor,
  listAdvisorClientsWorkspace,
} from "./advisor-clients";

type Row = Record<string, unknown>;

function ev(
  client_user_id: string,
  status: string,
  created_at: string,
  seq: number
) {
  return { client_user_id, status, created_at, seq };
}

/**
 * Realistic DB-shaped row: a real `advisor_client_consents` row carries BOTH a
 * random `gen_random_uuid()` `id` and the monotonic `seq`. The reducer must
 * tie-break on `seq` and ignore `id` entirely.
 */
function row(
  client_user_id: string,
  status: string,
  created_at: string,
  seq: number,
  id: string
) {
  return { client_user_id, status, created_at, seq, id };
}

type ConsentRow = Parameters<typeof computeConsentStatuses>[0][number];

/**
 * Models PostgREST surfacing an int8 `seq` as a JSON STRING (the bigint
 * string-compare trap). The runtime value is a string though the static type
 * is `number` — exactly the production hazard the reducer must coerce past.
 */
function strSeqRow(
  client_user_id: string,
  status: string,
  created_at: string,
  seq: string,
  id: string
): ConsentRow {
  return {
    client_user_id,
    status,
    created_at,
    seq,
    id,
  } as unknown as ConsentRow;
}

describe("computeConsentStatuses — latest-event-wins", () => {
  it("granted ⇒ active", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
    ]);
    expect(m.get("c1")).toBe("active");
  });

  it("withdrawn after granted (newer created_at) ⇒ withdrawn", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
      ev("c1", "withdrawn", "2026-05-02T00:00:00Z", 2),
    ]);
    expect(m.get("c1")).toBe("withdrawn");
  });

  it("re-granted after withdrawn (newer created_at) ⇒ active", () => {
    const m = computeConsentStatuses([
      ev("c1", "withdrawn", "2026-05-02T00:00:00Z", 2),
      ev("c1", "granted", "2026-05-03T00:00:00Z", 3),
      ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
    ]);
    expect(m.get("c1")).toBe("active");
  });

  // C1 parity guard. Same-tick grant+withdraw with realistic random-uuid ids:
  // the WITHDRAWN event is later (seq 4242) but its uuid sorts BELOW the
  // earlier GRANTED event's uuid. The retired `id desc` tie-break would pick
  // "granted" — a withdrawn client whose advisor keeps access (the dangerous
  // direction). `seq desc` (byte-identical to advisor_can_read_client's
  // `order by c.created_at desc, c.seq desc`) resolves it to "withdrawn".
  // The string-sortable id-1/id-2 fixture structurally could not catch this.
  it("same created_at ⇒ higher seq wins, even when a random-uuid id tie-break would flip it (C1)", () => {
    const m = computeConsentStatuses([
      row("c1", "granted", "2026-05-01T00:00:00Z", 4241,
        "ffffffff-ffff-4fff-bfff-ffffffffffff"),
      row("c1", "withdrawn", "2026-05-01T00:00:00Z", 4242,
        "00000000-0000-4000-8000-000000000000"),
    ]);
    expect(m.get("c1")).toBe("withdrawn");
  });

  // Inverse: a same-tick withdraw→re-grant where the granted event is later
  // (higher seq) but has the lower uuid — must resolve to "active".
  it("same created_at ⇒ later re-grant wins by seq despite lower uuid (C1)", () => {
    const m = computeConsentStatuses([
      row("c1", "withdrawn", "2026-05-01T00:00:00Z", 7,
        "ffffffff-ffff-4fff-bfff-ffffffffffff"),
      row("c1", "granted", "2026-05-01T00:00:00Z", 8,
        "00000000-0000-4000-8000-000000000000"),
    ]);
    expect(m.get("c1")).toBe("active");
  });

  // C1 #1 — bigint string-compare trap, asserted directly. PostgREST may
  // surface int8 `seq` as a string. Lexical "9" > "10" is TRUE, which would
  // keep the earlier GRANTED event after a same-tick withdraw (advisor
  // retains access — the dangerous direction). The reducer must coerce
  // numerically (Number()) so the later WITHDRAWN (seq 10) wins.
  it("string-typed seq compares numerically not lexically — '10' beats '9' (C1)", () => {
    const m = computeConsentStatuses([
      strSeqRow("c1", "granted", "2026-05-01T00:00:00Z", "9",
        "ffffffff-ffff-4fff-bfff-ffffffffffff"),
      strSeqRow("c1", "withdrawn", "2026-05-01T00:00:00Z", "10",
        "00000000-0000-4000-8000-000000000000"),
    ]);
    expect(m.get("c1")).toBe("withdrawn");
  });

  it("no rows ⇒ absent from map (caller defaults to none)", () => {
    const m = computeConsentStatuses([]);
    expect(m.has("c1")).toBe(false);
    expect(m.get("c1") ?? "none").toBe("none");
  });

  it("clients are independent", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
      ev("c2", "withdrawn", "2026-05-01T00:00:00Z", 2),
    ]);
    expect(m.get("c1")).toBe("active");
    expect(m.get("c2")).toBe("withdrawn");
  });
});

/**
 * Minimal fake implementing ONLY the chains listAdvisorClientsWorkspace uses
 * on the RPC-success path: `.rpc("advisor_client_list_metrics")` and
 * `.from("advisor_client_consents").select().eq().in()`. Mirrors the
 * profiles.test.ts norm — focused, not a shared harness.
 */
function fakeSupabase(opts: {
  metrics: Row[];
  consent: { data: Row[] | null; error: unknown };
}): SupabaseClient {
  return {
    rpc(fn: string) {
      if (fn === "advisor_client_list_metrics") {
        return Promise.resolve({ data: opts.metrics, error: null });
      }
      if (fn === "advisor_client_list_count") {
        return Promise.resolve({ data: opts.metrics.length, error: null });
      }
      throw new Error(`unexpected rpc: ${fn}`);
    },
    from(table: string) {
      if (table !== "advisor_client_consents") {
        throw new Error(`unexpected table: ${table}`);
      }
      // Model PostgREST column projection: a returned row carries ONLY the
      // columns the caller asked for. If the production `.select(...)` ever
      // drops `seq`, projected rows lose it, the reducer cannot tie-break,
      // and the same-tick wiring test below flips — select-column drift is
      // caught through the real call path, not just the pure reducer.
      let cols: string[] = [];
      const builder = {
        select: (sel: string) => {
          cols = sel.split(",").map((c) => c.trim());
          return builder;
        },
        eq: () => builder,
        in: () =>
          Promise.resolve(
            opts.consent.data == null
              ? opts.consent
              : {
                  data: opts.consent.data.map((r) =>
                    Object.fromEntries(
                      cols.map((c) => [c, (r as Row)[c]])
                    )
                  ),
                  error: opts.consent.error,
                }
          ),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const metricsRow = (id: string): Row => ({
  id,
  display_name: `Client ${id}`,
  profile_type: "client",
  onboarding_required: false,
  onboarding_completed_at: null,
  created_at: "2026-01-01T00:00:00Z",
  monthly_income: null,
  savings_target_monthly: null,
  fixed_expenses_monthly: null,
  monthly_gross_salary: null,
  last_expense_spent_at: null,
  expense_count: "0",
  total_count: "2",
});

describe("listAdvisorClientsWorkspace — consent column wiring", () => {
  it("decorates each row with its latest-event-wins consent status", async () => {
    const supabase = fakeSupabase({
      metrics: [metricsRow("c1"), metricsRow("c2")],
      consent: {
        data: [
          ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
          ev("c1", "withdrawn", "2026-05-02T00:00:00Z", 2),
          ev("c2", "granted", "2026-05-01T00:00:00Z", 3),
        ],
        error: null,
      },
    });
    const { rows } = await listAdvisorClientsWorkspace(supabase, "adv", {});
    expect(rows.find((r) => r.id === "c1")?.consent_status).toBe("withdrawn");
    expect(rows.find((r) => r.id === "c2")?.consent_status).toBe("active");
  });

  // C1 #2 — select-column drift guard through the REAL path. Same-tick
  // (equal created_at) grant→withdraw, string seq (PostgREST int8), uuid
  // ids inversely sorted. Correct answer (numeric seq desc) = withdrawn.
  // If `.select(...)` omits `seq`: projected rows lose it → reducer keeps
  // the first row (granted) → "active" → this assertion fails. If the
  // reducer compares lexically: "9" > "10" → granted kept → fails too.
  it("same-tick tie-break resolves numerically via the real select path (C1 drift guard)", async () => {
    const supabase = fakeSupabase({
      metrics: [metricsRow("c1")],
      consent: {
        data: [
          strSeqRow("c1", "granted", "2026-05-01T00:00:00Z", "9",
            "ffffffff-ffff-4fff-bfff-ffffffffffff"),
          strSeqRow("c1", "withdrawn", "2026-05-01T00:00:00Z", "10",
            "00000000-0000-4000-8000-000000000000"),
        ],
        error: null,
      },
    });
    const { rows } = await listAdvisorClientsWorkspace(supabase, "adv", {});
    expect(rows.find((r) => r.id === "c1")?.consent_status).toBe("withdrawn");
  });

  it("consent-query error ⇒ all rows fail safe to none (roster still renders)", async () => {
    const supabase = fakeSupabase({
      metrics: [metricsRow("c1"), metricsRow("c2")],
      consent: { data: null, error: { message: "boom" } },
    });
    const { rows } = await listAdvisorClientsWorkspace(supabase, "adv", {});
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.consent_status === "none")).toBe(true);
  });

  it("no consent rows ⇒ none", async () => {
    const supabase = fakeSupabase({
      metrics: [metricsRow("c1")],
      consent: { data: [], error: null },
    });
    const { rows } = await listAdvisorClientsWorkspace(supabase, "adv", {});
    expect(rows[0].consent_status).toBe("none");
  });
});

// The client's own consent status toward their advisor — reuses the
// C1-correct computeConsentStatuses reducer (single source).
function fakeConsentQuery(result: {
  data: Row[] | null;
  error: unknown;
}): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  return {
    from(table: string) {
      if (table !== "advisor_client_consents") {
        throw new Error(`unexpected table: ${table}`);
      }
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("getMyConsentStatusForAdvisor — client self-view", () => {
  it("latest granted ⇒ active", async () => {
    const s = fakeConsentQuery({
      data: [ev("c1", "granted", "2026-05-01T00:00:00Z", 1)],
      error: null,
    });
    expect(await getMyConsentStatusForAdvisor(s, "c1", "adv")).toBe("active");
  });

  it("withdrawn after granted ⇒ withdrawn", async () => {
    const s = fakeConsentQuery({
      data: [
        ev("c1", "granted", "2026-05-01T00:00:00Z", 1),
        ev("c1", "withdrawn", "2026-05-02T00:00:00Z", 2),
      ],
      error: null,
    });
    expect(await getMyConsentStatusForAdvisor(s, "c1", "adv")).toBe(
      "withdrawn"
    );
  });

  it("same-tick grant→withdraw ⇒ withdrawn (C1 seq tie-break reused)", async () => {
    const s = fakeConsentQuery({
      data: [
        ev("c1", "granted", "2026-05-01T00:00:00Z", 41),
        ev("c1", "withdrawn", "2026-05-01T00:00:00Z", 42),
      ],
      error: null,
    });
    expect(await getMyConsentStatusForAdvisor(s, "c1", "adv")).toBe(
      "withdrawn"
    );
  });

  it("no rows ⇒ none", async () => {
    const s = fakeConsentQuery({ data: [], error: null });
    expect(await getMyConsentStatusForAdvisor(s, "c1", "adv")).toBe("none");
  });

  it("query error ⇒ none (fail-safe: re-prompt, never false active)", async () => {
    const s = fakeConsentQuery({ data: null, error: { message: "boom" } });
    expect(await getMyConsentStatusForAdvisor(s, "c1", "adv")).toBe("none");
  });
});
