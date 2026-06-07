import { describe, expect, it } from "vitest";
import {
  formatOnboardingBonusCaption,
  profileHasOnboardingIncomeLink,
} from "@/features/onboarding/onboarding-profile-hints";

describe("onboarding-profile-hints", () => {
  it("shows income link when onboarding completed and gross is set", () => {
    expect(
      profileHasOnboardingIncomeLink({
        onboardingCompletedAt: "2026-01-01T00:00:00Z",
        grossMonthly: 5000,
        takeHomeMonthly: null,
        annualBonus: null,
      })
    ).toBe(true);
  });

  it("hides income link when onboarding not completed", () => {
    expect(
      profileHasOnboardingIncomeLink({
        onboardingCompletedAt: null,
        grossMonthly: 5000,
        takeHomeMonthly: null,
        annualBonus: null,
      })
    ).toBe(false);
  });

  it("formats bonus preset caption", () => {
    expect(formatOnboardingBonusCaption(2, 10_000)).toBe(
      "2 months of gross salary (onboarding)"
    );
    expect(formatOnboardingBonusCaption(null, 10_000)).toBe(
      "custom annual bonus from onboarding"
    );
  });
});
