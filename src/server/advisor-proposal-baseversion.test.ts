import { describe, expect, it, vi } from "vitest";

// REAL producer-path proof of B4 base_version capture (NOT synthetic
// injection). Flow exercised end-to-end: the advisor action ->
// recordAdvisorProposalChanges -> upsertProposalChange -> persisted change
// row, then a simulated client interim edit -> applyAcceptedProposalChanges
// must surface a conflict and write nothing. Only the auth/consent trust
// boundary is mocked; the record + accept logic is real.

type Row = Record<string, unknown>;

function makeFake(seed: Record<string, Row[]>) {
  const store: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(seed)) store[t] = rows.map((r) => ({ ...r }));
  let idSeq = 0;
  const coerce = (table: string, r: Row): Row => {
    if (table === "financial_budget_lines" && r.amount != null) {
      return { ...r, amount: String(r.amount) };
    }
    return { ...r };
  };

  function builder(table: string) {
    store[table] ??= [];
    const filters: Array<[string, unknown]> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let patch: Row | null = null;
    let returning = false;
    const matches = (r: Row) => filters.every(([c, v]) => r[c] === v);
    function run(): { data: Row | Row[] | null; error: null } {
      if (op === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload as Row]).map(
          (r) => ({ id: `db-${++idSeq}`, ...r })
        );
        store[table].push(...rows);
        return { data: returning ? coerce(table, rows[0]) : null, error: null };
      }
      if (op === "update") {
        const u: Row[] = [];
        for (const r of store[table])
          if (matches(r)) {
            Object.assign(r, patch);
            u.push(r);
          }
        return { data: returning ? coerce(table, u[0]) : null, error: null };
      }
      if (op === "delete") {
        store[table] = store[table].filter((r) => !matches(r));
        return { data: null, error: null };
      }
      return {
        data: store[table].filter(matches).map((r) => coerce(table, r)),
        error: null,
      };
    }
    const chain: Record<string, unknown> = {
      select() {
        if (op === "insert" || op === "update") returning = true;
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
      then(resolve: (r: { data: unknown; error: null }) => unknown) {
        return Promise.resolve(run()).then(resolve);
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
        const existing = store.advisor_proposals.find(
          (p) => p.client_user_id === args.p_client && p.status === "draft"
        );
        if (existing) return { data: existing, error: null };
        const row = {
          id: `prop-${++idSeq}`,
          advisor_user_id: "adv",
          client_user_id: args.p_client,
          status: "draft",
        };
        store.advisor_proposals.push(row);
        return { data: row, error: null };
      }
      if (name === "advisor_read_budget_lines") {
        // Consent-gated DEFINER read-back the action now routes through.
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

const { patchAdvisorClientBudgetLineAmountAction } = await import(
  "@/server/advisor-client-actions"
);
const { applyAcceptedProposalChanges } = await import(
  "@/domain/advisor-proposals/apply-changes"
);

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("B4 base_version — REAL producer path (record via action, then accept)", () => {
  it("action captures the entity's updated_at as base_version; interim edit → conflict + zero writes", async () => {
    // Phase 1 — advisor records a budget-amount suggestion at version v1.
    const p1 = makeFake({
      financial_budget_lines: [
        {
          id: "bl1",
          user_id: "client-1",
          category: "food",
          cadence: "monthly",
          amount: "800",
          calendar_year: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "v1",
        },
      ],
      advisor_proposals: [],
      advisor_proposal_changes: [],
    });
    fakeRef.current = p1.client;

    const res = await patchAdvisorClientBudgetLineAmountAction(
      { error: null },
      fd({ client_id: "client-1", id: "bl1", amount: "950" })
    );
    expect(res.error).toBeNull();

    const recorded = p1.store.advisor_proposal_changes;
    expect(recorded).toHaveLength(1);
    // The bug was base_version always null -> B4 inert. Assert it is captured.
    expect(recorded[0].base_version).toBe("v1");
    expect(recorded[0].change_op).toBe("update");
    expect(recorded[0].entity_id).toBe("bl1");

    // Phase 2 — client edited the budget line in the interim (v1 -> v2);
    // accept must surface a conflict and write nothing.
    const p2 = makeFake({
      financial_profiles: [],
      financial_investments: [],
      financial_budget_lines: [
        {
          id: "bl1",
          user_id: "client-1",
          category: "food",
          cadence: "monthly",
          amount: "800",
          calendar_year: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "v2-client-edited",
        },
      ],
      financial_goals: [],
    });

    const accept = await applyAcceptedProposalChanges(
      p2.client as never,
      "client-1",
      recorded as never
    );

    expect(accept.conflicts).toHaveLength(1);
    expect(accept.conflicts[0].entityId).toBe("bl1");
    expect(p2.store.financial_budget_lines[0].amount).toBe("800"); // untouched
  });
});
