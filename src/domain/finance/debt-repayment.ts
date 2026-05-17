import type { LiabilityRow } from "@/data/supabase/types";
import { addMonthsToYearMonth } from "@/lib/dates";
import { isValidYearMonth } from "./budget";

/** Stored `financial_liabilities.category` values. */
export const DEBT_CATEGORIES = [
  "property",
  "vehicle",
  "personal",
  "credit_card",
  "renovation",
  "education",
  "other",
] as const;

export type DebtCategory = (typeof DEBT_CATEGORIES)[number];

export const LOAN_TYPES = ["amortized", "flat_rate", "revolving"] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export type LiabilityForPlanning = {
  id?: string;
  name: string;
  balance: number;
  category: DebtCategory | null;
  loanType: LoanType | null;
  interestRateAnnual: number | null;
  remainingTenureMonths: number | null;
  monthlyRepayment: number | null;
  repaymentOverride: boolean;
  startDate: string | null;
  notes?: string | null;
};

export const DEBT_REPAYMENTS_CATEGORY_PREFIX = "debt repayments";

/** Budget category for a liability-linked repayment line (unique per debt name). */
export function debtBudgetCategoryName(debtName: string): string {
  const trimmed = debtName.trim();
  return trimmed
    ? `${DEBT_REPAYMENTS_CATEGORY_PREFIX} — ${trimmed}`
    : DEBT_REPAYMENTS_CATEGORY_PREFIX;
}

export function isDebtBudgetCategory(category: string): boolean {
  return normalizeDebtCategoryKey(category).startsWith(
    DEBT_REPAYMENTS_CATEGORY_PREFIX
  );
}

function normalizeDebtCategoryKey(s: string): string {
  return s.trim().toLowerCase();
}

export function defaultLoanTypeForCategory(
  category: DebtCategory | null | undefined
): LoanType {
  switch (category) {
    case "property":
    case "personal":
    case "renovation":
    case "education":
      return "amortized";
    case "vehicle":
      return "flat_rate";
    case "credit_card":
    case "other":
    default:
      return "revolving";
  }
}

/**
 * Level-payment amortizing loan (reducing balance). Returns null when inputs
 * are insufficient.
 */
export function estimateAmortizedMonthlyPayment(
  principal: number,
  annualNominalRate: number,
  termMonths: number
): number | null {
  if (principal <= 0 || termMonths <= 0) return null;
  const r = annualNominalRate / 12;
  const n = termMonths;
  let pmt: number;
  if (r === 0) {
    pmt = principal / n;
  } else {
    const pow = (1 + r) ** n;
    pmt = (principal * r * pow) / (pow - 1);
  }
  return roundMoney(pmt);
}

/**
 * Flat-rate loan: total interest = principal × rate × years; level monthly.
 */
export function estimateFlatRateMonthlyPayment(
  principal: number,
  annualNominalRate: number,
  termMonths: number
): number | null {
  if (principal <= 0 || termMonths <= 0) return null;
  const years = termMonths / 12;
  const totalInterest = principal * annualNominalRate * years;
  const totalRepayment = principal + totalInterest;
  return roundMoney(totalRepayment / termMonths);
}

export function estimateMonthlyRepayment(input: {
  balance: number;
  loanType: LoanType;
  interestRateAnnual: number | null;
  remainingTenureMonths: number | null;
}): number | null {
  const { balance, loanType, interestRateAnnual, remainingTenureMonths } = input;
  if (balance <= 0) return null;
  if (loanType === "revolving") return null;
  if (
    remainingTenureMonths == null ||
    remainingTenureMonths <= 0 ||
    interestRateAnnual == null ||
    !Number.isFinite(interestRateAnnual)
  ) {
    return null;
  }
  const rate = Math.max(0, interestRateAnnual);
  if (loanType === "flat_rate") {
    return estimateFlatRateMonthlyPayment(balance, rate, remainingTenureMonths);
  }
  return estimateAmortizedMonthlyPayment(balance, rate, remainingTenureMonths);
}

/** User-facing or stored repayment used in budget / projections. */
export function effectiveMonthlyRepayment(liability: LiabilityForPlanning): number {
  if (liability.monthlyRepayment != null && liability.monthlyRepayment > 0) {
    return liability.monthlyRepayment;
  }
  const loanType =
    liability.loanType ?? defaultLoanTypeForCategory(liability.category);
  const estimated = estimateMonthlyRepayment({
    balance: liability.balance,
    loanType,
    interestRateAnnual: liability.interestRateAnnual,
    remainingTenureMonths: liability.remainingTenureMonths,
  });
  return estimated != null && estimated > 0 ? estimated : 0;
}

/** First budget month for repayments (`YYYY-MM`). */
export function debtRepaymentStartYearMonth(
  liability: LiabilityForPlanning,
  fallbackYearMonth: string
): string {
  if (liability.startDate && /^\d{4}-\d{2}-\d{2}$/.test(liability.startDate)) {
    return liability.startDate.slice(0, 7);
  }
  return fallbackYearMonth;
}

/**
 * Last month (inclusive) with repayment, when tenure is known. Null = open-ended
 * (e.g. revolving / manual credit card).
 */
export function debtRepaymentEndYearMonth(
  liability: LiabilityForPlanning,
  startYearMonth: string
): string | null {
  const tenure = liability.remainingTenureMonths;
  if (tenure == null || tenure <= 0 || !isValidYearMonth(startYearMonth)) {
    return null;
  }
  return addMonthsToYearMonth(startYearMonth, tenure - 1);
}

export function debtRepaymentAppliesInMonth(
  liability: LiabilityForPlanning,
  viewingYearMonth: string,
  referenceYearMonth: string
): boolean {
  const repayment = effectiveMonthlyRepayment(liability);
  if (repayment <= 0) return false;
  if (!isValidYearMonth(viewingYearMonth)) return false;
  const startYm = debtRepaymentStartYearMonth(liability, referenceYearMonth);
  if (viewingYearMonth < startYm) return false;
  const endYm = debtRepaymentEndYearMonth(liability, startYm);
  if (endYm != null && viewingYearMonth > endYm) return false;
  return true;
}

export function sumDebtRepaymentsInMonth(
  liabilities: LiabilityForPlanning[],
  viewingYearMonth: string,
  referenceYearMonth: string
): number {
  return liabilities.reduce((sum, l) => {
    if (!debtRepaymentAppliesInMonth(l, viewingYearMonth, referenceYearMonth)) {
      return sum;
    }
    return sum + effectiveMonthlyRepayment(l);
  }, 0);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function dec(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Map DB row → planning domain (safe for client and server). */
export function liabilityRowToPlanning(row: LiabilityRow): LiabilityForPlanning {
  return {
    id: row.id,
    name: row.name,
    balance: dec(row.balance),
    category: row.category ?? null,
    loanType: row.loan_type ?? null,
    interestRateAnnual:
      row.interest_rate_annual != null &&
      String(row.interest_rate_annual).trim() !== ""
        ? dec(row.interest_rate_annual)
        : null,
    remainingTenureMonths: row.remaining_tenure_months ?? null,
    monthlyRepayment:
      row.monthly_repayment != null && String(row.monthly_repayment).trim() !== ""
        ? dec(row.monthly_repayment)
        : null,
    repaymentOverride: row.repayment_override === true,
    startDate: row.start_date ?? null,
    notes: row.notes ?? null,
  };
}
