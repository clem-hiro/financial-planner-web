import { beforeEach, describe, expect, it, vi } from "vitest";

// Consent-first trust boundary (P-ORDER). The advisor proposal create/save and
// draft-submit server actions MUST reject when the client has not granted
// active consent — server-side, with the advisor resolved from the session
// (auth.getUser), never from client-supplied form input. UI gating is
// secondary. No DB/API harness in-repo, so this is verified at the highest
// observable layer: the action itself with the data layer mocked.

const m = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "session-advisor" } } })),
  advisorCanReadClient: vi.fn(async () => true),
  recordAdvisorProposalChanges: vi.fn(async () => ({
    proposalId: "p1",
    changeCount: 1,
  })),
  submitProposal: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/planning-revalidate", () => ({
  revalidateSetupAndPlanning: () => {},
  revalidatePlanningWorkspace: () => {},
}));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: m.getUser },
  }),
}));
vi.mock("@/lib/profile-role", () => ({
  isAdvisor: () => true,
  isClient: () => false,
}));
vi.mock("@/data/repositories/profiles", () => ({
  getProfileById: async () => ({ id: "session-advisor", profile_type: "advisor" }),
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getClientProfileForAdvisor: async () => ({ id: "client-1" }),
  advisorCanReadClient: m.advisorCanReadClient,
}));
vi.mock("@/data/repositories/goals", () => ({
  getFinancialGoalById: async () => ({
    id: "goal-1",
    title: "Retirement",
    monthly_contribution: 300,
  }),
  // Action now routes the read-back through the consent-gated DEFINER RPC.
  advisorReadGoals: async () => [
    { id: "goal-1", title: "Retirement", monthly_contribution: 300 },
  ],
}));
vi.mock("@/server/advisor-proposal-recording", () => ({
  recordAdvisorProposalChanges: m.recordAdvisorProposalChanges,
}));
vi.mock("@/data/repositories/advisor-proposals", () => ({
  getProposalById: async () => ({
    id: "p1",
    advisor_user_id: "session-advisor",
    client_user_id: "client-1",
    status: "draft",
  }),
  submitProposal: m.submitProposal,
  listChangesForProposal: async () => [],
  upsertSectionNote: async () => undefined,
  deleteProposalChangesBySection: async () => undefined,
  deleteProposalChangesByEntity: async () => undefined,
  resolveProposal: async () => undefined,
}));
vi.mock("@/domain/advisor-proposals/apply-changes", () => ({
  applyAcceptedProposalChanges: async () => ({ conflicts: [] }),
}));
vi.mock("@/data/repositories/inbox-notifications", () => ({
  markAsReadByDedupeKey: async () => undefined,
}));

const { patchAdvisorClientGoalMonthlyContributionAction } = await import(
  "@/server/advisor-client-actions"
);
const { submitAdvisorProposalAction } = await import(
  "@/server/advisor-proposal-actions"
);

function goalForm(extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("client_id", "client-1");
  fd.set("goal_id", "goal-1");
  fd.set("monthly_contribution", "500");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  m.getUser.mockClear();
  m.advisorCanReadClient.mockClear();
  m.recordAdvisorProposalChanges.mockClear();
  m.submitProposal.mockClear();
  m.advisorCanReadClient.mockResolvedValue(true);
  m.getUser.mockResolvedValue({ data: { user: { id: "session-advisor" } } });
});

describe("proposal create/save — consent-first server-side gate", () => {
  it("rejects and writes nothing when consent is absent", async () => {
    m.advisorCanReadClient.mockResolvedValueOnce(false);
    const res = await patchAdvisorClientGoalMonthlyContributionAction(
      { error: null },
      goalForm()
    );
    expect(res.error).toMatch(/has not granted consent/i);
    expect(m.recordAdvisorProposalChanges).not.toHaveBeenCalled();
  });

  it("proceeds when consent is present", async () => {
    const res = await patchAdvisorClientGoalMonthlyContributionAction(
      { error: null },
      goalForm()
    );
    expect(res.error).toBeNull();
    expect(m.recordAdvisorProposalChanges).toHaveBeenCalledTimes(1);
  });

  it("resolves the advisor from the session, ignoring a client-supplied advisor id", async () => {
    await patchAdvisorClientGoalMonthlyContributionAction(
      { error: null },
      goalForm({ advisor_user_id: "attacker-forged-advisor" })
    );
    expect(m.getUser).toHaveBeenCalled();
    // 2nd positional arg to recordAdvisorProposalChanges is the advisor id —
    // it must be the session user, never the forged form value.
    const advisorArg = (
      m.recordAdvisorProposalChanges.mock.calls[0] as unknown[]
    )[1];
    expect(advisorArg).toBe("session-advisor");
    expect(advisorArg).not.toBe("attacker-forged-advisor");
  });
});

describe("proposal draft-submit — consent-first server-side gate", () => {
  it("rejects submit when consent is absent", async () => {
    m.advisorCanReadClient.mockResolvedValueOnce(false);
    const fd = new FormData();
    fd.set("proposal_id", "p1");
    const res = await submitAdvisorProposalAction({ error: null }, fd);
    expect(res.error).toMatch(/has not granted consent/i);
    expect(m.submitProposal).not.toHaveBeenCalled();
  });
});
