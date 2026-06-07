import { describe, expect, it, vi } from "vitest";

// Compose-time per-user name guard: an advisor must not stage a new entity
// whose name collides (case-insensitive, trimmed) with the client's existing
// entities OR another pending new entity in the same draft. Mirrors the DB
// unique index; gives a friendly block before accept-time.

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
      if (name === "advisor_read_investments") {
        return {
          data: (store.financial_investments ?? []).filter(
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

const { createAdvisorClientInvestmentAction } = await import(
  "@/server/advisor-client-actions"
);

function fd(e: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, v);
  return f;
}

const newInvestmentForm = (name: string) =>
  fd({
    client_id: "client-1",
    name,
    current_value: "1000",
    monthly_contribution: "100",
    expected_annual_return: "0.05",
  });

describe("compose-time name uniqueness (advisor proposals)", () => {
  it("blocks a new investment colliding (diff case) with an existing client one", async () => {
    const f = makeFake({
      financial_investments: [
        { id: "i1", user_id: "client-1", name: "ILP2" },
      ],
      advisor_proposals: [],
      advisor_proposal_changes: [],
    });
    fakeRef.current = f.client;

    const res = await createAdvisorClientInvestmentAction(
      { error: null },
      newInvestmentForm("ilp2")
    );

    expect(res.error).toBeTruthy();
    expect(res.error).toContain("investment");
    // Nothing staged — the collision short-circuits before recording.
    expect(f.store.advisor_proposal_changes ?? []).toHaveLength(0);
  });

  it("blocks a new investment colliding with another pending new one in the same draft", async () => {
    const f = makeFake({
      financial_investments: [],
      advisor_proposals: [
        {
          id: "prop-1",
          advisor_user_id: "adv",
          client_user_id: "client-1",
          status: "draft",
        },
      ],
      advisor_proposal_changes: [
        {
          id: "pc1",
          proposal_id: "prop-1",
          entity_type: "investment",
          change_op: "create",
          field_key: "name",
          new_value: "ILP2",
          draft_entity_key: "k-existing",
        },
      ],
    });
    fakeRef.current = f.client;

    const res = await createAdvisorClientInvestmentAction(
      { error: null },
      newInvestmentForm("  ilp2 ")
    );

    expect(res.error).toBeTruthy();
    expect(res.error).toContain("investment");
    // Only the pre-existing pending change remains; nothing new appended.
    expect(f.store.advisor_proposal_changes).toHaveLength(1);
  });

  it("allows a genuinely distinct new investment name", async () => {
    const f = makeFake({
      financial_investments: [
        { id: "i1", user_id: "client-1", name: "ILP2" },
      ],
      advisor_proposals: [],
      advisor_proposal_changes: [],
    });
    fakeRef.current = f.client;

    const res = await createAdvisorClientInvestmentAction(
      { error: null },
      newInvestmentForm("ILP3")
    );

    expect(res.error).toBeNull();
    expect(res.proposalRecorded).toBe(true);
    expect(f.store.advisor_proposal_changes.length).toBeGreaterThan(0);
  });
});
