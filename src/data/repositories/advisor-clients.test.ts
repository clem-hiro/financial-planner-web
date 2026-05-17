import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeConsentStatuses,
  listAdvisorClientsWorkspace,
} from "./advisor-clients";

type Row = Record<string, unknown>;

function ev(
  client_user_id: string,
  status: string,
  created_at: string,
  id: string
) {
  return { client_user_id, status, created_at, id };
}

describe("computeConsentStatuses — latest-event-wins", () => {
  it("granted ⇒ active", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", "a"),
    ]);
    expect(m.get("c1")).toBe("active");
  });

  it("withdrawn after granted (newer created_at) ⇒ withdrawn", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", "a"),
      ev("c1", "withdrawn", "2026-05-02T00:00:00Z", "b"),
    ]);
    expect(m.get("c1")).toBe("withdrawn");
  });

  it("re-granted after withdrawn (newer created_at) ⇒ active", () => {
    const m = computeConsentStatuses([
      ev("c1", "withdrawn", "2026-05-02T00:00:00Z", "b"),
      ev("c1", "granted", "2026-05-03T00:00:00Z", "c"),
      ev("c1", "granted", "2026-05-01T00:00:00Z", "a"),
    ]);
    expect(m.get("c1")).toBe("active");
  });

  it("same created_at ⇒ higher id wins (tie-break, matches advisor_can_read_client)", () => {
    const m = computeConsentStatuses([
      ev("c1", "granted", "2026-05-01T00:00:00Z", "id-1"),
      ev("c1", "withdrawn", "2026-05-01T00:00:00Z", "id-2"),
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
      ev("c1", "granted", "2026-05-01T00:00:00Z", "a"),
      ev("c2", "withdrawn", "2026-05-01T00:00:00Z", "b"),
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
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => Promise.resolve(opts.consent),
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
          ev("c1", "granted", "2026-05-01T00:00:00Z", "a"),
          ev("c1", "withdrawn", "2026-05-02T00:00:00Z", "b"),
          ev("c2", "granted", "2026-05-01T00:00:00Z", "c"),
        ],
        error: null,
      },
    });
    const { rows } = await listAdvisorClientsWorkspace(supabase, "adv", {});
    expect(rows.find((r) => r.id === "c1")?.consent_status).toBe("withdrawn");
    expect(rows.find((r) => r.id === "c2")?.consent_status).toBe("active");
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
