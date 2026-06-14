/**
 * Copy helpers for linking onboarding captures to Setup Profile / Goals surfaces.
 */

/** UI shows three steps; stored `onboarding_step` still uses 1 → 3 → 4 (legacy step 2 skipped). */
export const ONBOARDING_UI_STEP_COUNT = 3;

/** Maps stored onboarding step (legacy 4-step or current) to wizard UI step 1–3. */
export function onboardingUiStepFromStored(
  stored: number | null | undefined
): number {
  const raw = stored ?? 1;
  if (raw <= 1) return 1;
  if (raw === 2 || raw === 3) return 2;
  return ONBOARDING_UI_STEP_COUNT;
}

/** Persists wizard UI step to profile `onboarding_step`. */
export function onboardingStepToStore(uiStep: number): number {
  if (uiStep <= 1) return 1;
  if (uiStep === 2) return 3;
  return 4;
}

/** True when onboarding finished and income-related profile fields are populated. */
export function profileHasOnboardingIncomeLink(input: {
  onboardingCompletedAt: string | null;
  grossMonthly: number | null;
  takeHomeMonthly: number | null;
  annualBonus: number | null;
}): boolean {
  if (input.onboardingCompletedAt == null) return false;
  return (
    (input.grossMonthly != null && input.grossMonthly > 0) ||
    (input.takeHomeMonthly != null && input.takeHomeMonthly > 0) ||
    (input.annualBonus != null && input.annualBonus > 0)
  );
}

/** Human-readable bonus preset caption for Profile Income & CPF sync banner. */
export function formatOnboardingBonusCaption(
  annualBonusMonths: number | null,
  annualBonus: number | null
): string | null {
  if (annualBonus == null || annualBonus <= 0) return null;
  if (annualBonusMonths == null) return "custom annual bonus from onboarding";
  if (annualBonusMonths <= 0) return null;
  if (annualBonusMonths >= 4) return "4+ months of gross salary (onboarding)";
  const n = Math.round(annualBonusMonths);
  return `${n} month${n === 1 ? "" : "s"} of gross salary (onboarding)`;
}
