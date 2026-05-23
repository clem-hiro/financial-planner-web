import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/data/repositories/inbox-notifications", () => ({
  upsertByDedupeKey: vi.fn(async () => undefined),
}));

import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import { CPF_RULES_VERSION } from "@/domain/finance/cpf-rules-review";
import { ensureCpfRulesReviewNotification } from "./ensure-cpf-rules-review-notification";

const supabase = {} as unknown as SupabaseClient;

const baseProfile = {
  id: "user-uuid",
  last_cpf_rules_review_at: null,
  last_cpf_rules_review_version: null,
};

beforeEach(() => {
  vi.mocked(upsertByDedupeKey).mockClear();
  vi.mocked(upsertByDedupeKey).mockImplementation(async () => undefined);
});

describe("ensureCpfRulesReviewNotification — gate", () => {
  it("fires when CPF rules have never been reviewed", async () => {
    await ensureCpfRulesReviewNotification(
      supabase,
      baseProfile,
      new Date("2026-05-21T00:00:00Z")
    );

    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
    expect(upsertByDedupeKey).toHaveBeenCalledWith(
      supabase,
      "user-uuid",
      expect.objectContaining({
        kind: "cpf_rules_review_due",
        dedupe_key: `cpf_rules_review_due:${CPF_RULES_VERSION}:2026`,
        title: "Review CPF rules assumptions",
        cta_label: "Review CPF assumptions",
        cta_href: "/setup?tab=cpf&from=cpf-rules-review#cpf-rules-review",
      })
    );
  });

  it("no-ops before November when the current version was reviewed", async () => {
    await ensureCpfRulesReviewNotification(
      supabase,
      {
        ...baseProfile,
        last_cpf_rules_review_at: "2026-05-21T00:00:00Z",
        last_cpf_rules_review_version: CPF_RULES_VERSION,
      },
      new Date("2026-10-31T00:00:00Z")
    );

    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("fires in November when the current version was reviewed before the annual window", async () => {
    await ensureCpfRulesReviewNotification(
      supabase,
      {
        ...baseProfile,
        last_cpf_rules_review_at: "2026-05-21T00:00:00Z",
        last_cpf_rules_review_version: CPF_RULES_VERSION,
      },
      new Date("2026-11-01T00:00:00Z")
    );

    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
  });
});

describe("ensureCpfRulesReviewNotification — failure handling", () => {
  it("swallows upsert errors and never throws into layout render", async () => {
    vi.mocked(upsertByDedupeKey).mockRejectedValueOnce(new Error("db"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      ensureCpfRulesReviewNotification(
        supabase,
        baseProfile,
        new Date("2026-05-21T00:00:00Z")
      )
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
