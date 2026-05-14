import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/data/repositories/inbox-notifications", () => ({
  upsertByDedupeKey: vi.fn(async () => undefined),
}));

import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import { ensureSalaryReviewNotification } from "./ensure-salary-review-notification";

const supabase = {} as unknown as SupabaseClient;

const baseProfile = {
  id: "user-uuid",
  salary_increment_month: 4,
  last_salary_review_at: null,
};

beforeEach(() => {
  vi.mocked(upsertByDedupeKey).mockClear();
  vi.mocked(upsertByDedupeKey).mockImplementation(async () => undefined);
});

describe("ensureSalaryReviewNotification — gate", () => {
  it("no-ops in January when salary_increment_month = 4 (below threshold)", async () => {
    await ensureSalaryReviewNotification(
      supabase,
      baseProfile,
      new Date(2026, 0, 15) // Jan 15
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("fires in April at the threshold (currentMonth = salary_increment_month)", async () => {
    await ensureSalaryReviewNotification(
      supabase,
      baseProfile,
      new Date(2026, 3, 1) // Apr 1
    );
    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
    expect(upsertByDedupeKey).toHaveBeenCalledWith(
      supabase,
      "user-uuid",
      expect.objectContaining({
        kind: "salary_review_due",
        dedupe_key: "salary_review_due:2026",
        title: "Confirm your new salary",
        cta_label: "Update salary",
        cta_href: "/setup?tab=profile&from=salary-review#salary",
      })
    );
  });

  it("no-ops in August after an April acknowledgement this year", async () => {
    const profile = {
      ...baseProfile,
      last_salary_review_at: "2026-04-15T12:00:00Z",
    };
    await ensureSalaryReviewNotification(
      supabase,
      profile,
      new Date(2026, 7, 10) // Aug 10
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });

  it("fires in August when last acknowledgement is from a prior year", async () => {
    const profile = {
      ...baseProfile,
      last_salary_review_at: "2025-04-15T12:00:00Z",
    };
    await ensureSalaryReviewNotification(
      supabase,
      profile,
      new Date(2026, 7, 10) // Aug 10
    );
    expect(upsertByDedupeKey).toHaveBeenCalledTimes(1);
  });

  it("no-ops when salary_increment_month is null (opt-out)", async () => {
    const profile = { ...baseProfile, salary_increment_month: null };
    await ensureSalaryReviewNotification(
      supabase,
      profile,
      new Date(2026, 7, 10) // Aug 10
    );
    expect(upsertByDedupeKey).not.toHaveBeenCalled();
  });
});

describe("ensureSalaryReviewNotification — failure handling", () => {
  it("swallows upsert errors and never throws into layout render", async () => {
    vi.mocked(upsertByDedupeKey).mockRejectedValueOnce(new Error("simulated DB failure"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      ensureSalaryReviewNotification(
        supabase,
        baseProfile,
        new Date(2026, 3, 15) // Apr 15
      )
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
