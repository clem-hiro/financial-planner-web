import { beforeEach, describe, expect, it, vi } from "vitest";

// P7a-SMOKE (Task #13) — full advisor↔client proposal lifecycle exercised
// through REAL repo/domain/action code against an in-memory fake Supabase.
// ONLY the auth/consent trust boundary is mocked (createSupabaseServerClient
// auth, isAdvisor/isClient, getClientProfileForAdvisor, assertConsent). The
// fake `.rpc` emulates each SQL function's DOCUMENTED contract — it does NOT
// prove the SQL bodies' FOR UPDATE serialization / row-count asserts; that is
// genuinely P7b real-DB (explicitly out of this layer, see the matrix).

type Row = Record<string, unknown>;

const NUM_COLS: Record<string, string[]> = {
  financial_budget_lines: ["amount"],
  financial_goals: [
    "target_amount",
    "current_amount",
    "monthly_contribution",
    "expected_annual_return",
  ],
  financial_investments: [
    "current_value",
    "monthly_contribution",
    "expected_annual_return",
    "investment_income_rate_annual",
    "contribution_duration_years",
    "withdrawal_annual",
    "withdrawal_monthly",
    "withdrawal_start_years",
  ],
  financial_profiles: ["monthly_income", "savings_target_monthly"],
};

function makeFake() {
  const store: Record<string, Row[]> = {
    financial_profiles: [
      {
        id: "client-1",
        profile_type: "client",
        advisor_user_id: "adv",
        display_name: "Old Name",
        monthly_income: "5000",
        savings_target_monthly: "1000",
        updated_at: "pv1",
      },
    ],
    financial_investments: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "client-1",
        name: "Brokerage",
        current_value: "10000",
        monthly_contribution: "500",
        expected_annual_return: "0.06",
        investment_income_rate_annual: "0",
        contribution_type: "until_retirement",
        contribution_duration_years: null,
        contribution_growth_annual: "0",
        withdrawal_annual: "0",
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
        created_at: "2025-01-01",
        updated_at: "iv1",
      },
    ],
    financial_budget_lines: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "client-1",
        category: "food",
        cadence: "monthly",
        amount: "800",
        calendar_year: null,
        created_at: "2025-01-01",
        updated_at: "bv1",
      },
    ],
    financial_goals: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: "client-1",
        title: "House",
        target_amount: "100000",
        target_date: null,
        linked_investment_id: null,
        current_amount: "5000",
        monthly_contribution: "300",
        expected_annual_return: "0.04",
        created_at: "2025-01-01",
        updated_at: "gv1",
      },
    ],
    advisor_proposals: [],
    advisor_proposal_changes: [],
    advisor_proposal_section_notes: [],
    financial_inbox_notifications: [],
  };
  let seq = 0;
  const uid = { current: "adv" };
  const coerce = (t: string, r: Row): Row => {
    const out = { ...r };
    for (const c of NUM_COLS[t] ?? [])
      if (out[c] != null) out[c] = String(out[c]);
    return out;
  };

  function builder(table: string) {
    store[table] ??= [];
    const f: Array<[string, unknown, "eq" | "is" | "neq"]> = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let patch: Row | null = null;
    let ret = false;
    const match = (r: Row) =>
      f.every(([c, v, k]) =>
        k === "neq" ? r[c] !== v : r[c] === v
      );
    function run() {
      if (op === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload as Row]).map(
          (r) => ({ id: `db-${++seq}`, created_at: "2025-06-01", ...r })
        );
        store[table].push(...rows);
        return { data: ret ? coerce(table, rows[0]) : null, error: null };
      }
      if (op === "update") {
        const u: Row[] = [];
        for (const r of store[table])
          if (match(r)) {
            Object.assign(r, patch);
            u.push(r);
          }
        return {
          data: ret ? u.map((r) => coerce(table, r)) : null,
          error: null,
        };
      }
      if (op === "delete") {
        store[table] = store[table].filter((r) => !match(r));
        return { data: null, error: null };
      }
      return {
        data: store[table].filter(match).map((r) => coerce(table, r)),
        error: null,
      };
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
        f.push([c, v, "eq"]);
        return chain;
      },
      is(c: string, v: unknown) {
        f.push([c, v, "is"]);
        return chain;
      },
      neq(c: string, v: unknown) {
        f.push([c, v, "neq"]);
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
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

  const proposalById = (id: unknown) =>
    store.advisor_proposals.find((p) => p.id === id);

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: uid.current } } }) },
    from: (t: string) => builder(t),
    rpc: async (name: string, a: Record<string, unknown>) => {
      if (name === "create_advisor_draft_proposal") {
        let p = store.advisor_proposals.find(
          (r) => r.client_user_id === a.p_client && r.status === "draft"
        );
        if (!p) {
          p = {
            id: `prop-${++seq}`,
            advisor_user_id: "adv",
            client_user_id: a.p_client,
            status: "draft",
          };
          store.advisor_proposals.push(p);
        }
        return { data: p, error: null };
      }
      if (name === "submit_advisor_proposal") {
        const p = proposalById(a.p_proposal_id);
        if (!p || p.status !== "draft")
          return { data: null, error: { message: "not draft" } };
        p.status = "pending";
        p.submitted_at = "2025-06-01";
        store.financial_inbox_notifications.push({
          id: `nb-${++seq}`,
          user_id: p.client_user_id,
          kind: "advisor_proposal",
          dedupe_key: `advisor_proposal:${p.id}`,
          cta_href: `/review/proposal/${p.id}`,
        });
        return { data: null, error: null };
      }
      if (name === "withdraw_advisor_proposal") {
        const p = proposalById(a.p_proposal_id);
        if (p && (p.status === "draft" || p.status === "pending")) {
          p.status = "withdrawn";
          p.resolved_at = "2025-06-01";
          store.financial_inbox_notifications =
            store.financial_inbox_notifications.filter(
              (n) =>
                !(
                  n.user_id === p.client_user_id &&
                  n.dedupe_key === `advisor_proposal:${p.id}`
                )
            );
        }
        return { data: null, error: null };
      }
      if (name === "claim_advisor_proposal_for_accept") {
        const p = proposalById(a.p_proposal_id);
        if (!p || p.status !== "pending")
          return {
            data: null,
            error: { message: "not pending (claim lost)" },
          };
        p.status = "accepting";
        return { data: null, error: null };
      }
      if (name === "finalize_advisor_proposal_accept") {
        const p = proposalById(a.p_proposal_id);
        if (!p || p.status !== "accepting")
          return { data: null, error: { message: "not accepting" } };
        p.status = "accepted";
        p.resolved_at = "2025-06-01";
        return { data: null, error: null };
      }
      if (name === "advisor_read_profile")
        return {
          data: store.financial_profiles.filter((r) => r.id === a.p_client),
          error: null,
        };
      if (name === "advisor_read_investments")
        return {
          data: store.financial_investments
            .filter((r) => r.user_id === a.p_client)
            .map((r) => coerce("financial_investments", r)),
          error: null,
        };
      if (name === "advisor_read_budget_lines")
        return {
          data: store.financial_budget_lines
            .filter((r) => r.user_id === a.p_client)
            .map((r) => coerce("financial_budget_lines", r)),
          error: null,
        };
      if (name === "advisor_read_goals")
        return {
          data: store.financial_goals
            .filter((r) => r.user_id === a.p_client)
            .map((r) => coerce("financial_goals", r)),
          error: null,
        };
      if (name === "advisor_can_read_client")
        return { data: true, error: null };
      return { data: null, error: null };
    },
  };
  return { client, store, uid };
}

let H: ReturnType<typeof makeFake>;
const fakeRef: { current: ReturnType<typeof makeFake>["client"] | null } = {
  current: null,
};

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/planning-revalidate", () => ({
  revalidateSetupAndPlanning: () => {},
}));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => fakeRef.current,
}));
vi.mock("@/lib/profile-role", () => ({
  isAdvisor: () => true,
  isClient: () => true,
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getClientProfileForAdvisor: async () => ({ id: "client-1" }),
}));
vi.mock("@/server/advisor-consent", () => ({
  assertConsent: async () => ({ ok: true }),
}));

const recording = await import("@/server/advisor-proposal-recording");
const repo = await import("@/data/repositories/advisor-proposals");
const actions = await import("@/server/advisor-proposal-actions");
const clientActions = await import("@/server/advisor-client-actions");

function fd(e: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(e)) f.set(k, v);
  return f;
}

beforeEach(() => {
  H = makeFake();
  fakeRef.current = H.client;
});

describe("P7a-SMOKE — proposal lifecycle (real code, fake Supabase)", () => {
  it("createDraftProposal (RPC) is idempotent — same draft id twice", async () => {
    H.uid.current = "adv";
    const a = await repo.getOrCreateDraftProposal(
      H.client as never,
      "adv",
      "client-1"
    );
    const b = await repo.getOrCreateDraftProposal(
      H.client as never,
      "adv",
      "client-1"
    );
    expect(a.id).toBe(b.id);
    expect(a.status).toBe("draft");
    expect(
      H.store.advisor_proposals.filter((p) => p.status === "draft")
    ).toHaveLength(1);
  });

  it("recordChange profile UPDATE captures change_op=update + base_version, draft_entity_key null", async () => {
    H.uid.current = "adv";
    const r = await clientActions.patchAdvisorClientProfileAction(
      { error: null },
      fd({ client_id: "client-1", display_name: "New Name" })
    );
    expect(r.error).toBeNull();
    const ch = H.store.advisor_proposal_changes.find(
      (c) => c.field_key === "display_name"
    );
    expect(ch?.change_op).toBe("update");
    expect(ch?.base_version).toBe("pv1");
    expect(ch?.draft_entity_key).toBeNull();
  });

  it("recordChange investment CREATE: change_op=create, base_version null, draft_entity_key set", async () => {
    H.uid.current = "adv";
    const r = await clientActions.createAdvisorClientInvestmentAction(
      { error: null },
      fd({
        client_id: "client-1",
        name: "Robo",
        current_value: "2000",
        monthly_contribution: "250",
        expected_annual_return: "0.07",
      })
    );
    expect(r.error).toBeNull();
    const rows = H.store.advisor_proposal_changes.filter(
      (c) => c.entity_type === "investment"
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const c of rows) {
      expect(c.change_op).toBe("create");
      expect(c.base_version).toBeNull();
      expect(c.draft_entity_key).toBeTruthy();
      expect(c.entity_id).toBeNull();
    }
  });

  it("recordChange budget_line/goal DELETE: change_op=delete + base_version captured", async () => {
    H.uid.current = "adv";
    await clientActions.deleteAdvisorClientBudgetLineAction(
      { error: null },
      fd({ client_id: "client-1", id: "22222222-2222-4222-8222-222222222222" })
    );
    await clientActions.deleteAdvisorClientGoalAction(
      { error: null },
      fd({ client_id: "client-1", goal_id: "33333333-3333-4333-8333-333333333333" })
    );
    const bl = H.store.advisor_proposal_changes.find(
      (c) => c.entity_type === "budget_line"
    );
    const gl = H.store.advisor_proposal_changes.find(
      (c) => c.entity_type === "goal"
    );
    expect(bl?.change_op).toBe("delete");
    expect(bl?.base_version).toBe("bv1");
    expect(gl?.change_op).toBe("delete");
    expect(gl?.base_version).toBe("gv1");
  });

  it("submit: draft→pending + client inbox notification row created", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const draft = H.store.advisor_proposals[0];
    const res = await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(draft.id), advisor_note: "pls review" })
    );
    expect(res.error).toBeNull();
    expect(draft.status).toBe("pending");
    expect(
      H.store.financial_inbox_notifications.find(
        (n) => n.dedupe_key === `advisor_proposal:${draft.id}`
      )
    ).toBeTruthy();
  });

  it("withdraw: pending→withdrawn + inbox CTA deleted", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const draft = H.store.advisor_proposals[0];
    await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(draft.id) })
    );
    expect(draft.status).toBe("pending");
    const res = await actions.withdrawAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(draft.id) })
    );
    expect(res.error).toBeNull();
    expect(draft.status).toBe("withdrawn");
    expect(
      H.store.financial_inbox_notifications.filter(
        (n) => n.dedupe_key === `advisor_proposal:${draft.id}`
      )
    ).toHaveLength(0);
  });

  it("accept HAPPY: detect-clean→claim→apply→finalize→accepted; canonical updated to expected values", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const p = H.store.advisor_proposals[0];
    await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    H.uid.current = "client-1"; // client accepts
    const res = await actions.acceptAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    expect(res.error).toBeNull();
    expect(p.status).toBe("accepted");
    // canonical budget line mutated to the proposed value
    expect(H.store.financial_budget_lines[0].amount).toBe(950);
  });

  it("accept CLAIM-LOST (proposal withdrawn pre-claim): zero canonical writes, loud error", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const p = H.store.advisor_proposals[0];
    await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    p.status = "withdrawn"; // race: withdrawn before the client's claim
    H.uid.current = "client-1";
    const res = await actions.acceptAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    // pre-claim status guard returns the "no longer open" message; either way
    // canonical data must be UNTOUCHED.
    expect(res.error).toBeTruthy();
    expect(H.store.financial_budget_lines[0].amount).toBe("800");
  });

  it("accept CONFLICT pre-flight (baseline moved): stays pending, zero writes", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const p = H.store.advisor_proposals[0];
    await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    H.store.financial_budget_lines[0].updated_at = "bv2-CLIENT-EDITED";
    H.uid.current = "client-1";
    const res = await actions.acceptAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    expect(res.conflicts?.length).toBe(1);
    expect(p.status).toBe("pending"); // not claimed, not parked
    expect(H.store.financial_budget_lines[0].amount).toBe("800");
  });

  it("reject: pending→rejected, canonical unchanged", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const p = H.store.advisor_proposals[0];
    await actions.submitAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    H.uid.current = "client-1";
    const res = await actions.rejectAdvisorProposalAction(
      { error: null },
      fd({ proposal_id: String(p.id) })
    );
    expect(res.error).toBeNull();
    expect(p.status).toBe("rejected");
    expect(H.store.financial_budget_lines[0].amount).toBe("800");
  });

  it("listProposalsForClient excludes drafts; listProposalsForAdvisorClient includes them", async () => {
    H.uid.current = "adv";
    await recording.recordAdvisorProposalChanges(H.client as never, "adv", "client-1", [
      {
        entityType: "budget_line",
        entityId: "22222222-2222-4222-8222-222222222222",
        fieldKey: "amount",
        oldValue: "800",
        newValue: 950,
        baseVersion: "bv1",
      },
    ]);
    const draft = H.store.advisor_proposals[0];
    const advList = await repo.listProposalsForAdvisorClient(
      H.client as never,
      "adv",
      "client-1"
    );
    const cliList = await repo.listProposalsForClient(
      H.client as never,
      "client-1"
    );
    expect(advList.some((p) => p.id === draft.id)).toBe(true); // advisor sees draft
    expect(cliList.some((p) => p.id === draft.id)).toBe(false); // client does not
  });
});
