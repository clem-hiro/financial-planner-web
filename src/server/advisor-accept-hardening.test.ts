import { beforeEach, describe, expect, it, vi } from "vitest";

// P2-FIX-2 (/unslop) accept-path hardening at the handler-orchestration
// layer (RPC internals are SQL, verified later by the real-DB pass). The
// binding invariant: the C1 claim (pending->'accepting') GATES the entity
// writes — zero writes if the claim lost the withdraw race; a post-claim
// failure parks the proposal in 'accepting' (C2 terminal non-acceptable),
// never a false {error:null}.

const EMPTY_BASE = {
  profile: null,
  investments: [],
  budgetLines: [],
  goals: [],
};

const m = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "client-1" } } })),
  getProfileById: vi.fn(async () => ({
    id: "client-1",
    profile_type: "client",
  })),
  getProposalById: vi.fn(),
  listChangesForProposal: vi.fn(
    async (): Promise<Array<Record<string, unknown>>> => [{ id: "ch1" }]
  ),
  detectAcceptConflicts: vi.fn(),
  applyAcceptedProposalChanges: vi.fn(),
  claimAdvisorProposalForAccept: vi.fn(),
  finalizeAdvisorProposalAccept: vi.fn(),
  notifyAdvisorProposalConflict: vi.fn(),
  markAsReadByDedupeKey: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/planning-revalidate", () => ({
  revalidateSetupAndPlanning: () => {},
}));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: m.getUser } }),
}));
vi.mock("@/lib/profile-role", () => ({
  isClient: () => true,
  isAdvisor: () => false,
}));
vi.mock("@/data/repositories/profiles", () => ({
  getProfileById: m.getProfileById,
}));
vi.mock("@/data/repositories/inbox-notifications", () => ({
  markAsReadByDedupeKey: m.markAsReadByDedupeKey,
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getClientProfileForAdvisor: async () => ({ id: "client-1" }),
}));
vi.mock("@/server/advisor-consent", () => ({
  assertConsent: async () => ({ ok: true }),
}));
vi.mock("@/domain/advisor-proposals/apply-changes", async (importActual) => {
  // detect + apply are stubbed (orchestration test); the pure 23505->conflict
  // mapper uses the REAL impl so the mapping assertion is meaningful.
  const actual = await importActual<
    typeof import("@/domain/advisor-proposals/apply-changes")
  >();
  return {
    detectAcceptConflicts: m.detectAcceptConflicts,
    applyAcceptedProposalChanges: m.applyAcceptedProposalChanges,
    nameConflictFromWriteError: actual.nameConflictFromWriteError,
  };
});
vi.mock("@/data/repositories/advisor-proposals", () => ({
  getProposalById: m.getProposalById,
  listChangesForProposal: m.listChangesForProposal,
  claimAdvisorProposalForAccept: m.claimAdvisorProposalForAccept,
  finalizeAdvisorProposalAccept: m.finalizeAdvisorProposalAccept,
  notifyAdvisorProposalConflict: m.notifyAdvisorProposalConflict,
  resolveProposal: async () => undefined,
  submitProposal: async () => undefined,
  withdrawProposal: async () => undefined,
  upsertSectionNote: async () => undefined,
  deleteProposalChangesBySection: async () => undefined,
  deleteProposalChangesByEntity: async () => undefined,
}));

const { acceptAdvisorProposalAction } = await import(
  "@/server/advisor-proposal-actions"
);

const PENDING = {
  id: "p1",
  client_user_id: "client-1",
  advisor_user_id: "adv",
  status: "pending",
};

function fd() {
  const f = new FormData();
  f.set("proposal_id", "p1");
  return f;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
  m.getProfileById.mockResolvedValue({ id: "client-1", profile_type: "client" });
  m.getProposalById.mockResolvedValue(PENDING);
  m.listChangesForProposal.mockResolvedValue([{ id: "ch1" }]);
  m.detectAcceptConflicts.mockResolvedValue({
    conflicts: [],
    base: EMPTY_BASE,
  });
  m.applyAcceptedProposalChanges.mockResolvedValue({ conflicts: [] });
  m.claimAdvisorProposalForAccept.mockResolvedValue(undefined);
  m.finalizeAdvisorProposalAccept.mockResolvedValue(undefined);
  m.notifyAdvisorProposalConflict.mockResolvedValue(undefined);
  m.markAsReadByDedupeKey.mockResolvedValue(undefined);
});

describe("acceptAdvisorProposalAction — C1 claim-gates-writes / C2 parked", () => {
  it("C1: withdraw won the claim race -> ZERO writes, loud error", async () => {
    m.claimAdvisorProposalForAccept.mockRejectedValue(
      new Error("Proposal is no longer open for review (status=withdrawn)")
    );

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.error).toMatch(/changed while you were reviewing/i);
    // The claim gate fired BEFORE any write — nothing applied, no finalize.
    expect(m.applyAcceptedProposalChanges).not.toHaveBeenCalled();
    expect(m.finalizeAdvisorProposalAccept).not.toHaveBeenCalled();
  });

  it("C2: post-claim write failure -> parked in 'accepting', loud error (never {error:null}), NOT finalized", async () => {
    m.applyAcceptedProposalChanges.mockRejectedValue(
      new Error("budget write blew up mid-accept")
    );

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.error).toBeTruthy();
    expect(res.error).not.toBeNull();
    expect(m.claimAdvisorProposalForAccept).toHaveBeenCalledWith(
      expect.anything(),
      "p1"
    );
    expect(m.finalizeAdvisorProposalAccept).not.toHaveBeenCalled();
  });

  it("C1: finalize raises (concurrent tamper) -> loud error, not a false success", async () => {
    m.finalizeAdvisorProposalAccept.mockRejectedValue(
      new Error("Proposal not in accepting state")
    );

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.error).toBeTruthy();
    expect(m.applyAcceptedProposalChanges).toHaveBeenCalled();
  });

  it("happy path: detect clean -> claim -> write -> finalize -> {error:null}, inbox cleared", async () => {
    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.error).toBeNull();
    expect(m.claimAdvisorProposalForAccept).toHaveBeenCalledWith(
      expect.anything(),
      "p1"
    );
    expect(m.applyAcceptedProposalChanges).toHaveBeenCalledWith(
      expect.anything(),
      "client-1",
      expect.anything(),
      EMPTY_BASE
    );
    expect(m.finalizeAdvisorProposalAccept).toHaveBeenCalledWith(
      expect.anything(),
      "p1"
    );
    expect(m.markAsReadByDedupeKey).toHaveBeenCalled();
  });

  it("conflict pre-flight (pre-claim): stays pending, advisor notified, claim NEVER called", async () => {
    m.detectAcceptConflicts.mockResolvedValue({
      conflicts: [
        { entityType: "budget_line", entityId: "bl1", label: "Amount" },
      ],
      base: EMPTY_BASE,
    });

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.conflicts).toHaveLength(1);
    expect(m.claimAdvisorProposalForAccept).not.toHaveBeenCalled();
    expect(m.applyAcceptedProposalChanges).not.toHaveBeenCalled();
    expect(m.notifyAdvisorProposalConflict).toHaveBeenCalled();
  });

  it("C2 + name race: post-claim 23505 on the unique index -> name_in_use conflict, still parked (finalize NOT called)", async () => {
    m.listChangesForProposal.mockResolvedValue([
      {
        id: "ch1",
        entity_type: "investment",
        field_key: "name",
        new_value: "ilp2",
        change_op: "create",
        draft_entity_key: "k1",
      },
    ]);
    m.applyAcceptedProposalChanges.mockRejectedValue({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "financial_investments_user_name_ci_uq"',
    });

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.conflicts?.[0]?.reason).toBe("name_in_use");
    expect(res.conflicts?.[0]?.label).toBe("ilp2");
    // Claimed then write failed -> parked in 'accepting' (C2): never finalized.
    expect(m.claimAdvisorProposalForAccept).toHaveBeenCalled();
    expect(m.finalizeAdvisorProposalAccept).not.toHaveBeenCalled();
  });

  it("name_in_use conflict: friendly conflict surfaced, proposal NOT parked (claim never called)", async () => {
    m.detectAcceptConflicts.mockResolvedValue({
      conflicts: [
        {
          entityType: "investment",
          entityId: "inv-new",
          label: "ilp2",
          reason: "name_in_use",
        },
      ],
      base: EMPTY_BASE,
    });

    const res = await acceptAdvisorProposalAction({ error: null }, fd());

    expect(res.conflicts?.[0]?.reason).toBe("name_in_use");
    // Pre-claim catch -> never flips to 'accepting', never writes: not broken.
    expect(m.claimAdvisorProposalForAccept).not.toHaveBeenCalled();
    expect(m.applyAcceptedProposalChanges).not.toHaveBeenCalled();
    expect(m.finalizeAdvisorProposalAccept).not.toHaveBeenCalled();
  });
});
