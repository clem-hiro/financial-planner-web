import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdvisorDashboardData } from "./advisor-dashboard";

type ClientSeed = {
  id: string;
  display_name: string | null;
  onboarding_required: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
};

/**
 * Minimal fake that serves the roster ONLY through the Phase-2 SECURITY DEFINER
 * RPCs (`advisor_client_list_metrics` / `advisor_client_list_count`) and the
 * keyCounts read. A direct `.from("financial_profiles")` select THROWS — that
 * is the regression guard for this bug: post-Phase-2 the RLS policy backing
 * that select was dropped, so the dashboard must never reach it again.
 *
 * `advisor_client_list_metrics` honours p_limit/p_offset against the seed and
 * stamps `total_count` = full roster size on every row (mirrors the real
 * `count(*) over ()`), so totalClients can never be a truncated page length.
 */
function fakeSupabase(opts: {
  clients: ClientSeed[];
  keyStatuses: string[];
}): {
  client: SupabaseClient;
  state: { financialProfilesReads: number; metricsRpcCalls: number };
} {
  const state = { financialProfilesReads: 0, metricsRpcCalls: 0 };
  const sorted = [...opts.clients].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );

  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "advisor_client_list_metrics") {
        state.metricsRpcCalls += 1;
        const limit = Number(args.p_limit);
        const offset = Number(args.p_offset ?? 0);
        const page = sorted.slice(offset, offset + limit).map((c) => ({
          id: c.id,
          display_name: c.display_name,
          profile_type: "client",
          onboarding_required: c.onboarding_required,
          onboarding_completed_at: c.onboarding_completed_at,
          created_at: c.created_at,
          monthly_income: null,
          savings_target_monthly: null,
          fixed_expenses_monthly: null,
          monthly_gross_salary: null,
          last_expense_spent_at: null,
          expense_count: "0",
          total_count: String(sorted.length),
        }));
        return Promise.resolve({ data: page, error: null });
      }
      if (fn === "advisor_client_list_count") {
        return Promise.resolve({ data: sorted.length, error: null });
      }
      throw new Error(`unexpected rpc: ${fn}`);
    },
    from(table: string) {
      if (table === "financial_profiles") {
        state.financialProfilesReads += 1;
        throw new Error(
          "RLS-denied direct financial_profiles select — Phase-2 dropped this policy"
        );
      }
      if (table === "advisor_client_consents") {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => Promise.resolve({ data: [], error: null }),
        };
        return builder;
      }
      if (table === "advisor_access_keys") {
        const builder = {
          select: () => builder,
          eq: () =>
            Promise.resolve({
              data: opts.keyStatuses.map((status) => ({ status })),
              error: null,
            }),
        };
        return builder;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return { client, state };
}

function seed(
  id: string,
  onboarding: "done" | "pending" | "none",
  created_at: string
): ClientSeed {
  return {
    id,
    display_name: `Client ${id}`,
    onboarding_required: onboarding === "pending",
    onboarding_completed_at: onboarding === "done" ? "2026-02-01T00:00:00Z" : null,
    created_at,
  };
}

describe("getAdvisorDashboardData", () => {
  it("sources the roster via the SECURITY DEFINER RPC, never a direct financial_profiles select", async () => {
    const { client, state } = fakeSupabase({
      clients: [
        seed("a", "done", "2026-01-03T00:00:00Z"),
        seed("b", "pending", "2026-01-02T00:00:00Z"),
        seed("c", "none", "2026-01-01T00:00:00Z"),
      ],
      keyStatuses: ["claimed", "claimed", "available"],
    });
    const data = await getAdvisorDashboardData(client, "adv");

    expect(state.financialProfilesReads).toBe(0);
    // Cross-cutting invariant: dashboard total == authoritative RPC roster
    // count (count(*) over ()), identical to what /advisor/clients sees.
    expect(data.totalClients).toBe(3);
    expect(data.clientsOnboarded).toBe(1);
    expect(data.clientsPendingOnboarding).toBe(1);
    expect(data.keyCounts.claimed).toBe(2);
    expect(data.keyCounts.available).toBe(1);
  });

  it("recentlyJoinedClients = newest-first top 8, identity columns only (no financial leak)", async () => {
    const clients = Array.from({ length: 12 }, (_, i) =>
      seed(
        `c${i}`,
        "none",
        `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`
      )
    );
    const { client } = fakeSupabase({ clients, keyStatuses: [] });
    const data = await getAdvisorDashboardData(client, "adv");

    expect(data.recentlyJoinedClients).toHaveLength(8);
    // Newest created_at first.
    expect(data.recentlyJoinedClients[0].id).toBe("c11");
    expect(data.recentlyJoinedClients[7].id).toBe("c4");
    for (const r of data.recentlyJoinedClients) {
      expect(Object.keys(r).sort()).toEqual(
        [
          "created_at",
          "display_name",
          "id",
          "onboarding_completed_at",
          "onboarding_required",
          "profile_type",
        ].sort()
      );
    }
  });

  // The >200 trade-off resolution (agreed approach): totalClients stays the
  // authoritative count at any scale, while onboarded/pending are scoped to the
  // first 200-row page via a SINGLE metrics call — no unbounded paging.
  // Seed: 250 clients, strictly-decreasing created_at so sort(created_desc) ==
  // index order (id-000 newest). First 200 (i<200): 120 done / 50 pending / 30
  // none. Last 50 (i>=200): all done — and must NOT be counted (off-page).
  it("totalClients is authoritative at >200; onboarded/pending scoped to one 200-row page (single RPC call)", async () => {
    const base = Date.parse("2026-06-01T00:00:00.000Z");
    const clients: ClientSeed[] = [];
    for (let i = 0; i < 250; i += 1) {
      const onboarding =
        i < 120 ? "done" : i < 170 ? "pending" : i < 200 ? "none" : "done";
      clients.push({
        id: `id-${String(i).padStart(3, "0")}`,
        display_name: `Client ${i}`,
        onboarding_required: onboarding === "pending",
        onboarding_completed_at:
          onboarding === "done" ? "2026-02-01T00:00:00Z" : null,
        created_at: new Date(base - i * 60_000).toISOString(),
      });
    }
    const { client, state } = fakeSupabase({ clients, keyStatuses: ["claimed"] });
    const data = await getAdvisorDashboardData(client, "adv");

    expect(data.totalClients).toBe(250); // authoritative, not page length
    expect(data.clientsOnboarded).toBe(120); // first-page only, not 170
    expect(data.clientsPendingOnboarding).toBe(50);
    expect(data.recentlyJoinedClients).toHaveLength(8);
    expect(data.recentlyJoinedClients[0].id).toBe("id-000"); // newest
    expect(state.metricsRpcCalls).toBe(1); // no unbounded paging
  });

  it("no linked clients ⇒ zero totals, empty roster (authoritative count RPC, no direct select)", async () => {
    const { client, state } = fakeSupabase({
      clients: [],
      keyStatuses: ["claimed"],
    });
    const data = await getAdvisorDashboardData(client, "adv");

    expect(state.financialProfilesReads).toBe(0);
    expect(data.totalClients).toBe(0);
    expect(data.clientsOnboarded).toBe(0);
    expect(data.clientsPendingOnboarding).toBe(0);
    expect(data.recentlyJoinedClients).toEqual([]);
    expect(data.keyCounts.claimed).toBe(1);
  });
});
