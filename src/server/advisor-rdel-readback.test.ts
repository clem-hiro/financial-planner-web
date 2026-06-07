import { describe, expect, it, vi } from "vitest";

// security-Medium: the R-DEL delete actions read the target entity back to
// build the change row. consent-Phase-2 dropped the advisor's direct SELECT
// RLS, so a direct .from() returns "not found" for a legitimately-linked
// advisor and silently breaks the feature. These exercise the REAL read-back
// (advisor_read_goals / advisor_read_budget_lines DEFINER RPC, NOT mocked):
// a linked+consented advisor must successfully record the delete change.

type Row = Record<string, unknown>;

function makeFake(seed: Record<string, Row[]>) {
  const store: Record<string, Row[]> = {};
  for (const [t, r] of Object.entries(seed)) store[t] = r.map((x) => ({ ...x }));
  let seq = 0;
  function builder(table: string) {
    store[table] ??= [];
    const filters: Array<[string, unknown]> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let patch: Row | null = null;
    let ret = false;
    const match = (r: Row) => filters.every(([c, v]) => r[c] === v);
    function run(): { data: Row | Row[] | null; error: null } {
      if (op === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload as Row]).map(
          (r) => ({ id: `db-${++seq}`, ...r })
        );
        store[table].push(...rows);
        return { data: ret ? rows[0] : null, error: null };
      }
      if (op === "update") {
        const u: Row[] = [];
        for (const r of store[table])
          if (match(r)) {
            Object.assign(r, patch);
            u.push(r);
          }
        return { data: ret ? u[0] : null, error: null };
      }
      if (op === "delete") {
        store[table] = store[table].filter((r) => !match(r));
        return { data: null, error: null };
      }
      return { data: store[table].filter(match), error: null };
    }
    const chain: Record<string, unknown> = {
      select() {
        if (op === "insert" || op === "update") ret = true;
        return chain;
      },
      insert(v: Row | Row[]) {
        op = "insert";
        payload = v;
        return chain;
      },
      update(v: Row) {
        op = "update";
        patch = v;
        return chain;
      },
      delete() {
        op = "delete";
        return chain;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return chain;
      },
      is(c: string, v: unknown) {
        filters.push([c, v]);
        return chain;
      },
      order() {
        return chain;
      },
      maybeSingle() {
        const { data } = run();
        return Promise.resolve({
          data: Array.isArray(data) ? (data[0] ?? null) : data,
          error: null,
        });
      },
      single() {
        const { data } = run();
        return Promise.resolve({
          data: Array.isArray(data) ? data[0] : data,
          error: null,
        });
      },
      then(res: (r: { data: unknown; error: null }) => unknown) {
        return Promise.resolve(run()).then(res);
      },
    };
    return chain;
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "adv" } } }) },
    from: (t: string) => builder(t),
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "create_advisor_draft_proposal") {
        store.advisor_proposals ??= [];
        let p = store.advisor_proposals.find(
          (r) => r.client_user_id === args.p_client && r.status === "draft"
        );
        if (!p) {
          p = {
            id: `prop-${++seq}`,
            advisor_user_id: "adv",
            client_user_id: args.p_client,
            status: "draft",
          };
          store.advisor_proposals.push(p);
        }
        return { data: p, error: null };
      }
      // REAL consent-gated read-backs (not mocked away).
      if (name === "advisor_read_goals") {
        return {
          data: (store.financial_goals ?? []).filter(
            (r) => r.user_id === args.p_client
          ),
          error: null,
        };
      }
      if (name === "advisor_read_budget_lines") {
        return {
          data: (store.financial_budget_lines ?? []).filter(
            (r) => r.user_id === args.p_client
          ),
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
  return { client, store };
}

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/profile-role", () => ({ isAdvisor: () => true }));
vi.mock("@/data/repositories/profiles", () => ({
  getProfileById: async () => ({ id: "adv", profile_type: "advisor" }),
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getClientProfileForAdvisor: async () => ({ id: "client-1" }),
}));
vi.mock("@/server/advisor-consent", () => ({
  assertConsent: async () => ({ ok: true }),
}));
const fakeRef: { current: ReturnType<typeof makeFake>["client"] | null } = {
  current: null,
};
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeRef.current,
}));

const { deleteAdvisorClientGoalAction, deleteAdvisorClientBudgetLineAction } =
  await import("@/server/advisor-client-actions");

function fd(e: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, v);
  return f;
}

describe("R-DEL read-back routes through consent-gated DEFINER (security-Medium)", () => {
  it("linked+consented advisor delete-goal records a conflict-guarded delete change", async () => {
    const f = makeFake({
      financial_goals: [
        {
          id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          user_id: "client-1",
          title: "House",
          updated_at: "gv1",
        },
      ],
      advisor_proposals: [],
      advisor_proposal_changes: [],
    });
    fakeRef.current = f.client;

    const res = await deleteAdvisorClientGoalAction(
      { error: null },
      fd({
        client_id: "client-1",
        goal_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      })
    );

    expect(res.error).toBeNull();
    expect(res.proposalRecorded).toBe(true);
    expect(f.store.advisor_proposal_changes).toHaveLength(1);
    const row = f.store.advisor_proposal_changes[0];
    expect(row.change_op).toBe("delete");
    expect(row.base_version).toBe("gv1");
    expect(row.entity_id).toBe("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
  });

  it("linked+consented advisor delete-budget-line records a conflict-guarded delete change", async () => {
    const f = makeFake({
      financial_budget_lines: [
        {
          id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
          user_id: "client-1",
          category: "food",
          updated_at: "bv1",
        },
      ],
      advisor_proposals: [],
      advisor_proposal_changes: [],
    });
    fakeRef.current = f.client;

    const res = await deleteAdvisorClientBudgetLineAction(
      { error: null },
      fd({
        client_id: "client-1",
        id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      })
    );

    expect(res.error).toBeNull();
    expect(f.store.advisor_proposal_changes[0].change_op).toBe("delete");
    expect(f.store.advisor_proposal_changes[0].base_version).toBe("bv1");
  });
});
