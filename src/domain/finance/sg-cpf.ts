import { addMonthsToYearMonth } from "@/lib/dates";

/**
 * Singapore employee CPF on monthly ordinary wages (OW).
 * OW ceiling schedule and Jan 2026 employee rates from CPFB (cpf.gov.sg).
 *
 * Annual combined wage ceiling: total OW + AW subject to CPF in a calendar year
 * is capped (see ANNUAL_WAGE_CEILING_SG). AW ceiling for the year =
 * that cap minus total OW subject to CPF for the year (CPFB).
 *
 * This module prorates monthly OW subject when a flat monthly OW (after the
 * monthly OW ceiling) would project above the annual cap (OW-only, same every month).
 * Not modeled: SPR graduated rates, $500–$750 tier, varying salary by month,
 * exact AW timing, or year-end CPF adjustments.
 */

export type SgCpfAgeBand =
  | "below_55"
  | "above_55_to_60"
  | "above_60_to_65"
  | "above_65_to_70"
  | "above_70";

/** Max combined OW + AW wages subject to CPF in a calendar year (CPFB). */
export const ANNUAL_WAGE_CEILING_SG = 102_000 as const;

/**
 * Max total CPF (employee + employer combined) in a calendar year (CPFB).
 * Not used in employee take-home estimates here.
 */
export const ANNUAL_MAX_TOTAL_CPF_CONTRIBUTION_SG = 37_740 as const;

/** Monthly OW subject derived from the annual cap if spread evenly (102k / 12). */
export const MONTHLY_OW_FROM_ANNUAL_CAP_SG =
  ANNUAL_WAGE_CEILING_SG / 12;

/** Employee % of OW (wages > $750/mo), from 1 Jan 2026. */
const EMPLOYEE_RATE: Record<SgCpfAgeBand, number> = {
  below_55: 0.2,
  above_55_to_60: 0.18,
  above_60_to_65: 0.125,
  above_65_to_70: 0.075,
  above_70: 0.05,
};

/**
 * CPF Ordinary Wage ceiling for a calendar month (`YYYY-MM`).
 * Schedule: $6k → $6.3k (Sep 2023) → $6.8k (2024) → $7.4k (2025) → $8k (2026).
 */
export function ordinaryWageCeilingSg(yearMonth: string): number {
  if (yearMonth < "2023-09") return 6000;
  if (yearMonth < "2024-01") return 6300;
  if (yearMonth < "2025-01") return 6800;
  if (yearMonth < "2026-01") return 7400;
  return 8000;
}

export function employeeCpfRateSg(ageBand: SgCpfAgeBand): number {
  return EMPLOYEE_RATE[ageBand];
}

/**
 * Remaining headroom for Additional Wages (bonuses, etc.) subject to CPF
 * after total Ordinary Wages subject to CPF in the calendar year so far.
 * AW ceiling = $102,000 − total OW subject for the year (CPFB).
 */
export function additionalWageCeilingRemaining(
  totalOwSubjectToDateForCalendarYear: number
): number {
  const ytd = Math.max(0, totalOwSubjectToDateForCalendarYear);
  return Math.max(0, ANNUAL_WAGE_CEILING_SG - ytd);
}

export type MonthlyCpfBreakdown = {
  grossMonthly: number;
  /** OW after only the monthly OW ceiling (`min(gross, monthly ceiling)`). */
  ordinaryWagesAfterMonthlyCeiling: number;
  /** OW amount employee CPF is calculated on this month (after annual cap proration if any). */
  ordinaryWagesSubject: number;
  ordinaryWageCeiling: number;
  /** True when monthly OW was reduced so 12× steady OW would not exceed the annual cap. */
  annualCapProratesMonthlyOw: boolean;
  employeeRate: number;
  employeeCpfContribution: number;
  takeHome: number;
};

export type AnnualCpfBreakdownWithBonus = {
  grossMonthly: number;
  grossAnnualBonus: number;
  ordinaryWageCeiling: number;
  ordinaryWagesSubjectAnnual: number;
  additionalWagesSubjectAnnual: number;
  annualWageCapApplied: boolean;
  employeeRate: number;
  employeeCpfOnOwAnnual: number;
  employeeCpfOnAwAnnual: number;
  employeeCpfContributionAnnual: number;
  takeHomeAnnual: number;
  /**
   * Legacy smoothed figure: (annual salary + bonus gross − annual employee CPF) ÷ 12.
   * Prefer `takeHomeFromSalaryMonthly` for monthly budgeting and
   * `takeHomeFromBonusNetAnnual` for lump-sum cash savings.
   */
  takeHomeMonthlyEquivalent: number;
  /** Monthly take-home from salary only (employee CPF on OW for this month). */
  takeHomeFromSalaryMonthly: number;
  /** One year’s bonus cash after employee CPF on AW (lump; not spread into monthly income). */
  takeHomeFromBonusNetAnnual: number;
};

const SG_CPF_AGE_BANDS: readonly SgCpfAgeBand[] = [
  "below_55",
  "above_55_to_60",
  "above_60_to_65",
  "above_65_to_70",
  "above_70",
] as const;

export function isSgCpfAgeBand(s: string | null): s is SgCpfAgeBand {
  return s != null && (SG_CPF_AGE_BANDS as readonly string[]).includes(s);
}

/** Matches default in `buildCpfMonthlyProjectionSeries` (bonus paid once per calendar year). */
export const DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH = 12 as const;

/**
 * Counts how many times `payoutMonth` (1–12) occurs in the first `horizonMonths`
 * consecutive calendar months starting from `startYearMonth` (`YYYY-MM`).
 */
export function countAnnualBonusPayoutsInHorizon(
  startYearMonth: string,
  horizonMonths: number,
  payoutMonth1To12: number = DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH
): number {
  if (horizonMonths <= 0 || !/^\d{4}-\d{2}$/.test(startYearMonth)) return 0;
  const payout = Math.max(1, Math.min(12, Math.trunc(payoutMonth1To12)));
  let n = 0;
  for (let i = 0; i < horizonMonths; i++) {
    const ym = addMonthsToYearMonth(startYearMonth, i);
    if (Number(ym.slice(5, 7)) === payout) n += 1;
  }
  return n;
}

function ordinaryWagesSubjectForMonth(
  grossMonthly: number,
  monthlyOwCeiling: number
): {
  afterMonthlyCeiling: number;
  subject: number;
  annualCapProratesMonthlyOw: boolean;
} {
  const afterMonthlyCeiling = Math.min(
    Math.max(0, grossMonthly),
    monthlyOwCeiling
  );
  const annualProjection = 12 * afterMonthlyCeiling;
  if (annualProjection <= ANNUAL_WAGE_CEILING_SG) {
    return {
      afterMonthlyCeiling,
      subject: afterMonthlyCeiling,
      annualCapProratesMonthlyOw: false,
    };
  }
  const subject = Math.min(
    afterMonthlyCeiling,
    MONTHLY_OW_FROM_ANNUAL_CAP_SG
  );
  return {
    afterMonthlyCeiling,
    subject,
    annualCapProratesMonthlyOw: subject < afterMonthlyCeiling,
  };
}

/**
 * Employee CPF = rate × OW subject for gross > $750; OW subject applies
 * monthly OW ceiling, then annual $102k proration for steady OW-only pay.
 * Take-home = gross − employee CPF.
 */
export function monthlyEmployeeCpfTakeHomeSg(
  grossMonthly: number,
  yearMonth: string,
  ageBand: SgCpfAgeBand
): MonthlyCpfBreakdown {
  const ceiling = ordinaryWageCeilingSg(yearMonth);
  const rate = employeeCpfRateSg(ageBand);
  const { afterMonthlyCeiling, subject, annualCapProratesMonthlyOw } =
    ordinaryWagesSubjectForMonth(grossMonthly, ceiling);
  const contribution = grossMonthly > 750 ? subject * rate : 0;
  const takeHome = grossMonthly - contribution;
  return {
    grossMonthly,
    ordinaryWagesAfterMonthlyCeiling: afterMonthlyCeiling,
    ordinaryWagesSubject: subject,
    ordinaryWageCeiling: ceiling,
    annualCapProratesMonthlyOw,
    employeeRate: rate,
    employeeCpfContribution: Math.round(contribution * 100) / 100,
    takeHome: Math.round(takeHome * 100) / 100,
  };
}

/**
 * Annualized employee CPF for a steady monthly gross salary plus annual bonus.
 * OW is bounded by monthly OW ceiling and annual wage cap; AW (bonus) is then
 * bounded by the remaining annual headroom.
 */
export function annualEmployeeCpfTakeHomeWithBonusSg(
  grossMonthly: number,
  grossAnnualBonus: number,
  yearMonth: string,
  ageBand: SgCpfAgeBand
): AnnualCpfBreakdownWithBonus {
  const monthlyGross = Math.max(0, grossMonthly);
  const annualBonus = Math.max(0, grossAnnualBonus);
  const ordinaryWageCeiling = ordinaryWageCeilingSg(yearMonth);
  const owSubjectPerMonth = Math.min(monthlyGross, ordinaryWageCeiling);
  const ordinaryWagesSubjectAnnual = Math.min(
    ANNUAL_WAGE_CEILING_SG,
    owSubjectPerMonth * 12
  );
  const additionalWagesSubjectAnnual = Math.min(
    annualBonus,
    additionalWageCeilingRemaining(ordinaryWagesSubjectAnnual)
  );
  const annualWageCapApplied =
    ordinaryWagesSubjectAnnual < owSubjectPerMonth * 12 ||
    additionalWagesSubjectAnnual < annualBonus;

  const employeeRate = employeeCpfRateSg(ageBand);
  const employeeCpfOnOwAnnual =
    monthlyGross > 750 ? ordinaryWagesSubjectAnnual * employeeRate : 0;
  const employeeCpfOnAwAnnual =
    monthlyGross > 750 ? additionalWagesSubjectAnnual * employeeRate : 0;
  const employeeCpfContributionAnnual = employeeCpfOnOwAnnual + employeeCpfOnAwAnnual;
  const grossAnnual = monthlyGross * 12 + annualBonus;
  const takeHomeAnnual = grossAnnual - employeeCpfContributionAnnual;
  const takeHomeMonthlyEquivalent = takeHomeAnnual / 12;
  const salaryMonthly = monthlyEmployeeCpfTakeHomeSg(
    monthlyGross,
    yearMonth,
    ageBand
  );
  const takeHomeFromSalaryMonthly = salaryMonthly.takeHome;
  const takeHomeFromBonusNetAnnual =
    Math.round((annualBonus - employeeCpfOnAwAnnual) * 100) / 100;

  return {
    grossMonthly: monthlyGross,
    grossAnnualBonus: annualBonus,
    ordinaryWageCeiling,
    ordinaryWagesSubjectAnnual: Math.round(ordinaryWagesSubjectAnnual * 100) / 100,
    additionalWagesSubjectAnnual:
      Math.round(additionalWagesSubjectAnnual * 100) / 100,
    annualWageCapApplied,
    employeeRate,
    employeeCpfOnOwAnnual: Math.round(employeeCpfOnOwAnnual * 100) / 100,
    employeeCpfOnAwAnnual: Math.round(employeeCpfOnAwAnnual * 100) / 100,
    employeeCpfContributionAnnual:
      Math.round(employeeCpfContributionAnnual * 100) / 100,
    takeHomeAnnual: Math.round(takeHomeAnnual * 100) / 100,
    takeHomeMonthlyEquivalent: Math.round(takeHomeMonthlyEquivalent * 100) / 100,
    takeHomeFromSalaryMonthly,
    takeHomeFromBonusNetAnnual,
  };
}
