import { describe, expect, it } from "vitest";
import {
  onboardingStepToStore,
  onboardingUiStepFromStored,
} from "@/features/onboarding/onboarding-profile-hints";

describe("onboarding-profile-hints", () => {
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
