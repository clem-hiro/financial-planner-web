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
