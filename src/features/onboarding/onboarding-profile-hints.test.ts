import { describe, expect, it } from "vitest";
import {
  formatOnboardingBonusCaption,
  onboardingStepToStore,
  onboardingUiStepFromStored,
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

  it("maps stored onboarding steps to three UI steps", () => {
    expect(onboardingUiStepFromStored(null)).toBe(1);
    expect(onboardingUiStepFromStored(1)).toBe(1);
    expect(onboardingUiStepFromStored(2)).toBe(2);
    expect(onboardingUiStepFromStored(3)).toBe(2);
    expect(onboardingUiStepFromStored(4)).toBe(3);
  });

  it("persists UI steps with legacy lifestyle step skipped", () => {
    expect(onboardingStepToStore(1)).toBe(1);
    expect(onboardingStepToStore(2)).toBe(3);
    expect(onboardingStepToStore(3)).toBe(4);
  });
});
