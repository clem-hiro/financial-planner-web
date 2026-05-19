import { describe, expect, it } from "vitest";
import {
  annualBonusFromGrossAndMonths,
  estimateOnboardingTakeHomeMonthly,
  inferBonusMonthPreset,
} from "@/domain/finance/onboarding-income";

describe("onboarding-income", () => {
  it("estimates take-home below gross for typical salary", () => {
    const takeHome = estimateOnboardingTakeHomeMonthly(5000, "2026-05");
    expect(takeHome).not.toBeNull();
    expect(takeHome!).toBeLessThan(5000);
    expect(takeHome!).toBeGreaterThan(3500);
  });

  it("derives annual bonus from gross and months", () => {
    expect(annualBonusFromGrossAndMonths(5000, 2)).toBe(10000);
  });

  it("infers preset from stored months", () => {
    expect(inferBonusMonthPreset(10000, 5000, 2).preset).toBe("2");
  });

  it("falls back to custom for non-matching legacy bonus", () => {
    expect(inferBonusMonthPreset(7777, 5000, null).preset).toBe("custom");
  });
});
