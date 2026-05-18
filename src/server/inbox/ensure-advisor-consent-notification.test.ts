import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/data/repositories/inbox-notifications", () => ({
  upsertByDedupeKey: vi.fn(async () => undefined),
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getMyConsentStatusForAdvisor: vi.fn(
    async (): Promise<"active" | "withdrawn" | "none"> => "none"
  ),
}));

import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import { getMyConsentStatusForAdvisor } from "@/data/repositories/advisor-clients";
import { ensureAndCheckClientConsentPrompt } from "./ensure-advisor-consent-notification";

const supabase = {} as unknown as SupabaseClient;
const linkedClient = {
  id: "client-1",
  profile_type: "client",
  advisor_user_id: "advisor-1",
};

beforeEach(() => {
  vi.mocked(upsertByDedupeKey).mockClear();
  vi.mocked(upsertByDedupeKey).mockImplementation(async () => undefined);
  vi.mocked(getMyConsentStatusForAdvisor).mockClear();
  vi.mocked(getMyConsentStatusForAdvisor).mockResolvedValue("none");
});

describe("ensureAndCheckClientConsentPrompt — short-circuits (zero DB hops)", () => {
  it("null profile ⇒ false, no status read, no upsert", async () => {
    expect(await ensureAndCheckClientConsentPrompt(supabase, null)).toBe(false);
    expect(getMyConsentStatusForAdvisor).not.toHaveBeenCalled();
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("non-client (advisor) ⇒ false, no DB", async () => {
    const r = await ensureAndCheckClientConsentPrompt(supabase, {
      id: "a1",
      profile_type: "advisor",
      advisor_user_id: null,
    });
    expect(r).toBe(false);
    expect(getMyConsentStatusForAdvisor).not.toHaveBeenCalled();
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("client with no linked advisor ⇒ false, no DB", async () => {
    const r = await ensureAndCheckClientConsentPrompt(supabase, {
      id: "client-1",
      profile_type: "client",
      advisor_user_id: "",
    });
    expect(r).toBe(false);
    expect(getMyConsentStatusForAdvisor).not.toHaveBeenCalled();
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });
});

describe("ensureAndCheckClientConsentPrompt — linked client", () => {
  it("active consent ⇒ false, NO prompt upserted", async () => {
    vi.mocked(getMyConsentStatusForAdvisor).mockResolvedValueOnce("active");
    const r = await ensureAndCheckClientConsentPrompt(supabase, linkedClient);
    expect(r).toBe(false);
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("never granted (none) ⇒ true + prompt upserted (deduped per advisor)", async () => {
    vi.mocked(getMyConsentStatusForAdvisor).mockResolvedValueOnce("none");
    const r = await ensureAndCheckClientConsentPrompt(supabase, linkedClient);
    expect(r).toBe(true);
    expect(upsertByDedupeKey).toHaveBeenCalledWith(
      supabase,
      "client-1",
      expect.objectContaining({
        kind: "advisor_consent_request",
        dedupe_key: "advisor_consent_request:advisor-1",
        cta_href: "/more#privacy-advisor-access",
      })
    );
  });

  it("withdrawn ⇒ true + prompt re-upserted (re-consent)", async () => {
    vi.mocked(getMyConsentStatusForAdvisor).mockResolvedValueOnce("withdrawn");
    const r = await ensureAndCheckClientConsentPrompt(supabase, linkedClient);
    expect(r).toBe(true);
    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
  });

  it("swallows an upsert failure and never throws (still returns true)", async () => {
    vi.mocked(getMyConsentStatusForAdvisor).mockResolvedValueOnce("none");
    vi.mocked(upsertByDedupeKey).mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      ensureAndCheckClientConsentPrompt(supabase, linkedClient)
    ).resolves.toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
