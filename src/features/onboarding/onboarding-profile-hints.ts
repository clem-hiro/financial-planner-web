/**
 * Copy helpers for linking onboarding captures to Setup Profile / Goals surfaces.
 */

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
