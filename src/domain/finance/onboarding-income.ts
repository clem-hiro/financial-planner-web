import type { SgCpfAgeBand } from "@/domain/finance/sg-cpf";
import { monthlyEmployeeCpfTakeHomeSg } from "@/domain/finance/sg-cpf";

/** Default CPF age band for onboarding estimates when birth date is unknown. */
export const ONBOARDING_DEFAULT_CPF_BAND: SgCpfAgeBand = "below_55";

export type BonusMonthPresetId =
  | "none"
  | "1"
  | "2"
  | "3"
  | "4plus"
  | "custom";

export const BONUS_MONTH_PRESETS: {
  id: BonusMonthPresetId;
  label: string;
  months: number | null;
}[] = [
  { id: "none", label: "None", months: 0 },
  { id: "1", label: "1 month", months: 1 },
  { id: "2", label: "2 months", months: 2 },
  { id: "3", label: "3 months", months: 3 },
  { id: "4plus", label: "4+ months", months: 4 },
  { id: "custom", label: "Custom", months: null },
];

/**
 * Estimated monthly take-home from gross salary using SG employee CPF (salary only).
 * Used for onboarding preview; full profile CPF uses the same domain helpers.
 */
export function estimateOnboardingTakeHomeMonthly(
  grossMonthly: number,
  cpfYearMonth: string,
  ageBand: SgCpfAgeBand = ONBOARDING_DEFAULT_CPF_BAND
): number | null {
  if (!Number.isFinite(grossMonthly) || grossMonthly <= 0) return null;
  if (!/^\d{4}-\d{2}$/.test(cpfYearMonth)) return null;
  const { takeHome } = monthlyEmployeeCpfTakeHomeSg(
    grossMonthly,
    cpfYearMonth,
    ageBand
  );
  return takeHome > 0 ? takeHome : null;
}

/** annual_bonus_amount = gross_monthly_income × bonus months (preset paths). */
export function annualBonusFromGrossAndMonths(
  grossMonthly: number,
  months: number
): number | null {
  if (!Number.isFinite(grossMonthly) || grossMonthly <= 0) return null;
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.round(grossMonthly * months * 100) / 100;
}

/**
 * Infer bonus-month preset from stored annual bonus and gross (legacy rows without
 * `annual_bonus_months`).
 */
export function inferBonusMonthPreset(
  annualBonus: number | null,
  grossMonthly: number | null,
  storedMonths: number | null
): { preset: BonusMonthPresetId; customAmount: string } {
  if (storedMonths != null && Number.isFinite(storedMonths)) {
    if (storedMonths <= 0) return { preset: "none", customAmount: "" };
    const rounded = Math.round(storedMonths);
    if (rounded === 1) return { preset: "1", customAmount: "" };
    if (rounded === 2) return { preset: "2", customAmount: "" };
    if (rounded === 3) return { preset: "3", customAmount: "" };
    if (rounded >= 4) return { preset: "4plus", customAmount: "" };
  }

  const bonus = annualBonus ?? 0;
  if (bonus <= 0) return { preset: "none", customAmount: "" };
  if (grossMonthly != null && grossMonthly > 0) {
    const ratio = bonus / grossMonthly;
    const near = (n: number) => Math.abs(ratio - n) < 0.05;
    if (near(1)) return { preset: "1", customAmount: "" };
    if (near(2)) return { preset: "2", customAmount: "" };
    if (near(3)) return { preset: "3", customAmount: "" };
    if (ratio >= 3.95) return { preset: "4plus", customAmount: "" };
  }
  return {
    preset: "custom",
    customAmount: String(bonus),
  };
}
