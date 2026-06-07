import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countPendingProposalsForClient } from "./advisor-proposals";

type Row = { client_user_id: string; status: string };

/** Minimal head-count fake: applies the chained `.eq()` filters and returns the
 * matching row count, mirroring PostgREST `{ count: "exact", head: true }`. */
function fakeSupabase(rows: Row[]): SupabaseClient {
  return {
    from() {
      const filters: Array<[string, unknown]> = [];
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return chain;
        },
        then: (resolve: (r: { count: number; error: null }) => unknown) => {
          const count = rows.filter((r) =>
            filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v)
          ).length;
          return Promise.resolve(resolve({ count, error: null }));
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("countPendingProposalsForClient", () => {
  it("returns 0 when no pending proposals", async () => {
    const supabase = fakeSupabase([
      { client_user_id: "c1", status: "accepted" },
      { client_user_id: "c1", status: "withdrawn" },
    ]);
    expect(await countPendingProposalsForClient(supabase, "c1")).toBe(0);
  });

  it("returns 1 for a single pending proposal", async () => {
    const supabase = fakeSupabase([
      { client_user_id: "c1", status: "pending" },
      { client_user_id: "c1", status: "accepted" },
    ]);
    expect(await countPendingProposalsForClient(supabase, "c1")).toBe(1);
  });

  it("counts many pending, excluding other statuses and other clients", async () => {
    const supabase = fakeSupabase([
      { client_user_id: "c1", status: "pending" },
      { client_user_id: "c1", status: "pending" },
      { client_user_id: "c1", status: "pending" },
      { client_user_id: "c1", status: "rejected" },
      { client_user_id: "c2", status: "pending" }, // different client
    ]);
    expect(await countPendingProposalsForClient(supabase, "c1")).toBe(3);
  });
});
