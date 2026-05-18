import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_PURPOSE,
  CONSENT_SUPPORTING_LINE,
  CONSENT_TEXT,
  CONSENT_VERSION,
  renderConsentText,
} from "@/server/advisor-consent";

// P0-H1 consent write producer + read-only consent gate. Trust boundary: the
// CLIENT writes their OWN append-only consent event; client_user_id = session
// uid, advisor from the profile linkage, version/purpose from server
// constants, consent_text = the RENDERED disclosure (real adviser name,
// server-resolved — never form input), created_at/seq DB-assigned (C1).

const ADVISER = "Jane Tan";

const m = vi.hoisted(() => ({
  getUser: vi.fn(
    async (): Promise<{ data: { user: { id: string } | null } }> => ({
      data: { user: { id: "client-session" } },
    })
  ),
  insert: vi.fn(async () => ({ error: null as unknown })),
  getProfileById: vi.fn(
    async (): Promise<{
      id: string;
      profile_type: string;
      advisor_user_id: string | null;
    }> => ({
      id: "client-session",
      profile_type: "client",
      advisor_user_id: "advisor-1",
    })
  ),
  markRead: vi.fn(async () => undefined),
  getAdvisorContact: vi.fn(
    async (): Promise<{ advisor_name: string | null }> => ({
      advisor_name: "Jane Tan",
    })
  ),
  getConsentStatus: vi.fn(
    async (): Promise<"active" | "withdrawn" | "none"> => "none"
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/planning-revalidate", () => ({
  revalidateSetupAndPlanning: () => {},
  revalidatePlanningWorkspace: () => {},
}));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: m.getUser },
    from: (t: string) => {
      if (t !== "advisor_client_consents") {
        throw new Error(`unexpected table: ${t}`);
      }
      return { insert: m.insert };
    },
  }),
}));
vi.mock("@/data/repositories/profiles", () => ({
  getProfileById: m.getProfileById,
}));
vi.mock("@/data/repositories/inbox-notifications", () => ({
  markAsReadByDedupeKey: m.markRead,
}));
vi.mock("@/data/repositories/coupons", () => ({
  getMyAdvisorContact: m.getAdvisorContact,
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getMyConsentStatusForAdvisor: m.getConsentStatus,
}));
vi.mock("@/lib/profile-role", () => ({
  isClient: (p: { profile_type?: string } | null) =>
    p?.profile_type === "client",
}));

const { recordAdvisorConsentAction, getAdvisorConsentGateAction } =
  await import("@/server/client-consent-actions");

function fd(extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}
const payloadOf = () =>
  (m.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;

beforeEach(() => {
  m.getUser.mockReset();
  m.insert.mockReset();
  m.getProfileById.mockReset();
  m.markRead.mockReset();
  m.getAdvisorContact.mockReset();
  m.getConsentStatus.mockReset();
  m.getUser.mockResolvedValue({ data: { user: { id: "client-session" } } });
  m.insert.mockResolvedValue({ error: null });
  m.getProfileById.mockResolvedValue({
    id: "client-session",
    profile_type: "client",
    advisor_user_id: "advisor-1",
  });
  m.markRead.mockResolvedValue(undefined);
  m.getAdvisorContact.mockResolvedValue({ advisor_name: ADVISER });
  m.getConsentStatus.mockResolvedValue("none");
});

describe("renderConsentText — server-only interpolation", () => {
  it("replaces every {adviserName} with the resolved name", () => {
    const out = renderConsentText(ADVISER);
    expect(out).toContain(ADVISER);
    expect(out).not.toContain("{adviserName}");
    expect(out).toBe(CONSENT_TEXT.replaceAll("{adviserName}", ADVISER));
  });

  it("CONSENT_TEXT is a template carrying exactly one interpolation token", () => {
    expect(CONSENT_TEXT).toContain("{adviserName}");
  });
});

describe("recordAdvisorConsentAction — validation & auth", () => {
  it("rejects an invalid status and writes nothing", async () => {
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "revoke-all" })
    );
    expect(res.error).toMatch(/invalid consent action/i);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("rejects when not signed in", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res.error).toMatch(/sign in required/i);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("rejects a non-client (advisor cannot write consent)", async () => {
    m.getProfileById.mockResolvedValueOnce({
      id: "client-session",
      profile_type: "advisor",
      advisor_user_id: null,
    });
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res.error).toMatch(/not allowed/i);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("rejects a client with no linked advisor", async () => {
    m.getProfileById.mockResolvedValueOnce({
      id: "client-session",
      profile_type: "client",
      advisor_user_id: null,
    });
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res.error).toMatch(/no linked advisor/i);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("surfaces a DB insert failure without throwing", async () => {
    m.insert.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res.error).toMatch(/could not record consent/i);
  });
});

describe("recordAdvisorConsentAction — append-only & trust boundary", () => {
  it("grant: inserts session client + linked advisor + RENDERED copy; granted_at set", async () => {
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res).toEqual({ error: null, status: "granted" });
    expect(m.insert).toHaveBeenCalledTimes(1);
    const p = payloadOf();
    expect(p.client_user_id).toBe("client-session");
    expect(p.advisor_user_id).toBe("advisor-1");
    expect(p.status).toBe("granted");
    expect(p.consent_version).toBe(CONSENT_VERSION);
    expect(p.purpose).toBe(CONSENT_PURPOSE);
    // G1c: the recorded copy is the RENDERED disclosure with the real name.
    expect(p.consent_text).toBe(renderConsentText(ADVISER));
    expect(p.consent_text).toContain(ADVISER);
    expect(p.consent_text).not.toContain("{adviserName}");
    expect(typeof p.granted_at).toBe("string");
    expect(p.withdrawn_at).toBeNull();
    expect(p).not.toHaveProperty("created_at");
    expect(p).not.toHaveProperty("seq");
    expect(m.markRead).toHaveBeenCalledWith(
      expect.anything(),
      "client-session",
      "advisor_consent_request:advisor-1"
    );
  });

  it("ignores forged form fields; records the server-rendered copy, not the forged text", async () => {
    await recordAdvisorConsentAction(
      { error: null },
      fd({
        status: "granted",
        client_user_id: "attacker",
        advisor_user_id: "attacker-advisor",
        consent_text: "EVIL — advisor may sell my data",
        consent_version: "evil",
        purpose: "evil",
        seq: "999999",
        created_at: "2000-01-01T00:00:00Z",
      })
    );
    const p = payloadOf();
    expect(p.client_user_id).toBe("client-session");
    expect(p.advisor_user_id).toBe("advisor-1");
    expect(p.consent_text).toBe(renderConsentText(ADVISER));
    expect(p.consent_text).not.toContain("EVIL");
    expect(p.consent_version).toBe(CONSENT_VERSION);
    expect(p.purpose).toBe(CONSENT_PURPOSE);
    expect(p).not.toHaveProperty("seq");
    expect(p).not.toHaveProperty("created_at");
  });

  it("withdraw: withdrawn_at set, granted_at null, no inbox clear", async () => {
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "withdrawn" })
    );
    expect(res).toEqual({ error: null, status: "withdrawn" });
    const p = payloadOf();
    expect(p.status).toBe("withdrawn");
    expect(typeof p.withdrawn_at).toBe("string");
    expect(p.granted_at).toBeNull();
    expect(p).not.toHaveProperty("created_at");
    expect(p).not.toHaveProperty("seq");
    expect(m.markRead).not.toHaveBeenCalled();
  });
});

describe("recordAdvisorConsentAction — adviser-name resolution edge cases", () => {
  it("grant with unresolvable adviser name: blocks (legal attributability), no insert", async () => {
    m.getAdvisorContact.mockResolvedValueOnce({ advisor_name: null });
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "granted" })
    );
    expect(res.error).toMatch(/advisor details are unavailable/i);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("grant proceeds even if the contact RPC throws is impossible — but withdraw NEVER blocks", async () => {
    // Safety: a name-resolution hiccup must never trap a client into consent.
    m.getAdvisorContact.mockRejectedValueOnce(new Error("rpc down"));
    const res = await recordAdvisorConsentAction(
      { error: null },
      fd({ status: "withdrawn" })
    );
    expect(res).toEqual({ error: null, status: "withdrawn" });
    const p = payloadOf();
    expect(p.status).toBe("withdrawn");
    // Fallback neutral phrase, never the raw template token.
    expect(p.consent_text).toBe(
      renderConsentText("your linked financial adviser")
    );
    expect(p.consent_text).not.toContain("{adviserName}");
  });
});

describe("getAdvisorConsentGateAction — read-only gate probe", () => {
  it("returns idle when not signed in (no throw)", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: null } });
    const gate = await getAdvisorConsentGateAction();
    expect(gate).toEqual({
      status: "none",
      consentText: null,
      supportingLine: CONSENT_SUPPORTING_LINE,
    });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("returns idle for a non-client", async () => {
    m.getProfileById.mockResolvedValueOnce({
      id: "client-session",
      profile_type: "advisor",
      advisor_user_id: null,
    });
    const gate = await getAdvisorConsentGateAction();
    expect(gate.status).toBe("none");
    expect(gate.consentText).toBeNull();
  });

  it("returns idle for a client with no linked advisor", async () => {
    m.getProfileById.mockResolvedValueOnce({
      id: "client-session",
      profile_type: "client",
      advisor_user_id: null,
    });
    const gate = await getAdvisorConsentGateAction();
    expect(gate.status).toBe("none");
    expect(gate.consentText).toBeNull();
  });

  it("active consent → status active, consentText null (dialog not shown), name RPC skipped", async () => {
    m.getConsentStatus.mockResolvedValueOnce("active");
    const gate = await getAdvisorConsentGateAction();
    expect(gate.status).toBe("active");
    expect(gate.consentText).toBeNull();
    expect(gate.supportingLine).toBe(CONSENT_SUPPORTING_LINE);
    // Optimization: the name RPC is skipped on the already-consented path.
    expect(m.getAdvisorContact).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("not consented → status + RENDERED consentText (real name) for the dialog", async () => {
    m.getConsentStatus.mockResolvedValueOnce("withdrawn");
    const gate = await getAdvisorConsentGateAction();
    expect(gate.status).toBe("withdrawn");
    expect(gate.consentText).toBe(renderConsentText(ADVISER));
    expect(gate.consentText).not.toContain("{adviserName}");
    expect(gate.supportingLine).toBe(CONSENT_SUPPORTING_LINE);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("not consented but adviser name unresolvable → consentText null (UI shows fallback, not a broken dialog)", async () => {
    m.getConsentStatus.mockResolvedValueOnce("none");
    m.getAdvisorContact.mockResolvedValueOnce({ advisor_name: null });
    const gate = await getAdvisorConsentGateAction();
    expect(gate.status).toBe("none");
    expect(gate.consentText).toBeNull();
  });
});
