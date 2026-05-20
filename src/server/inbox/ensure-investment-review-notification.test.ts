import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/data/repositories/inbox-notifications", () => ({
  upsertByDedupeKey: vi.fn(async () => undefined),
}));

import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import { ensureInvestmentReviewNotification } from "./ensure-investment-review-notification";

const supabase = {} as unknown as SupabaseClient;

const baseProfile = {
  id: "user-uuid",
  last_investment_review_at: null,
};

const staleInvestment = {
  id: "inv-1",
  user_id: "user-uuid",
  name: "Brokerage",
  current_value: "10000",
  monthly_contribution: "500",
  expected_annual_return: "0.07",
  updated_at: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
};

const freshInvestment = {
  ...staleInvestment,
  id: "inv-2",
  updated_at: "2026-04-01T00:00:00Z",
};

beforeEach(() => {
  vi.mocked(upsertByDedupeKey).mockClear();
});

describe("ensureInvestmentReviewNotification — gate", () => {
  it("no-ops with no investment accounts", async () => {
    await ensureInvestmentReviewNotification(
      supabase,
      baseProfile,
      [],
      new Date("2026-05-15")
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("no-ops when all accounts were updated recently", async () => {
    await ensureInvestmentReviewNotification(
      supabase,
      baseProfile,
      [freshInvestment],
      new Date("2026-05-15")
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("fires when an account is stale and never acknowledged", async () => {
    await ensureInvestmentReviewNotification(
      supabase,
      baseProfile,
      [staleInvestment],
      new Date("2026-05-15")
    );
    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
    expect(upsertByDedupeKey).toHaveBeenCalledWith(
      supabase,
      "user-uuid",
      expect.objectContaining({
        kind: "investment_review_due",
        dedupe_key: "investment_review_due:2026",
        title: "Review investment assumptions",
        cta_label: "Review investments",
      })
    );
  });

  it("no-ops after a recent acknowledgement even if data is stale", async () => {
    await ensureInvestmentReviewNotification(
      supabase,
      {
        ...baseProfile,
        last_investment_review_at: "2026-01-01T00:00:00Z",
      },
      [staleInvestment],
      new Date("2026-05-15")
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });
});

describe("ensureInvestmentReviewNotification — failure handling", () => {
  it("swallows upsert errors", async () => {
    vi.mocked(upsertByDedupeKey).mockRejectedValueOnce(new Error("db"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      ensureInvestmentReviewNotification(
        supabase,
        baseProfile,
        [staleInvestment],
        new Date("2026-05-15")
      )
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
