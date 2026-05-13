import { addMonthsToYearMonth } from "@/lib/dates";
import { yearMonthSchema } from "@/lib/validation";
import type { HousingLoanRow } from "@/data/supabase/types";
import { estimateFinancingNeed } from "@/domain/finance/property-financing-plan";

/** HDB concessionary loan — common planning figure; confirm with your LO. */
export const HDB_CONCESSIONARY_RATE_ANNUAL = 0.026;

/** Illustrative bank fixed rate when you don’t enter your own (not a quote). */
export const DEFAULT_BANK_MORTGAGE_RATE_ANNUAL = 0.032;

/** Map quick-add / UI preset field to OA fraction of each instalment (rest is cash). */
export function oaInstalmentShareFromPreset(raw: string): number {
  const t = raw.trim();
  if (t === "split50" || t === "half") return 0.5;
  if (t === "cash100" || t === "cash") return 0;
  return 1;
}

export function annualRateForQuickLender(
  lender: HousingLoanRow["lender_type"],
  bankAnnualRate: number | null
): number {
  if (lender === "hdb") return HDB_CONCESSIONARY_RATE_ANNUAL;
  if (lender === "bank") {
    return bankAnnualRate != null && Number.isFinite(bankAnnualRate)
      ? bankAnnualRate
      : DEFAULT_BANK_MORTGAGE_RATE_ANNUAL;
  }
  return bankAnnualRate != null && Number.isFinite(bankAnnualRate)
    ? bankAnnualRate
    : DEFAULT_BANK_MORTGAGE_RATE_ANNUAL;
}

export type QuickHousingLoanDerived =
  | {
      ok: true;
      label: string;
      principal: number;
      annual_nominal_rate: number;
      term_months: number;
      completion_month: string;
      first_payment_month: string;
      downpayment_from_oa: number;
      fees_from_oa: number;
      oa_share_of_payment: number;
      max_oa_per_month: null;
      lender_type: HousingLoanRow["lender_type"];
      original_loan_principal: number;
      principal_repaid_before_schedule: number;
    }
  | { ok: false; error: string };

/**
 * Map purchase, deposit, tenor, and lender into a row compatible with
 * `insertHousingLoan` / CPF projection (fixed-rate amortization).
 */
export function deriveQuickHousingLoanRow(input: {
  label: string;
  purchasePrice: number;
  depositTotal: number;
  depositFromOa: number;
  feesFromOa: number;
  loanTermYears: number;
  firstPaymentMonth: string;
  lenderType: HousingLoanRow["lender_type"];
  /** Decimal annual, e.g. 0.034; only used when lender is bank/other. */
  bankAnnualRate: number | null;
  oaShareOfPayment: number;
  /**
   * Estimated residential BSD (SGD). Defaults to 0 — legacy behaviour is
   * financed amount = purchase − deposit only.
   */
  buyersStampDuty?: number;
  /** When true, financed amount subtracts `buyersStampDuty` from purchase after deposit. */
  includeBuyersStampDutyInLoan?: boolean;
}): QuickHousingLoanDerived {
  const {
    label,
    purchasePrice,
    depositTotal,
    depositFromOa,
    feesFromOa,
    loanTermYears,
    firstPaymentMonth,
    lenderType,
    bankAnnualRate,
    oaShareOfPayment,
    buyersStampDuty = 0,
    includeBuyersStampDutyInLoan = false,
  } = input;

  if (!yearMonthSchema.safeParse(firstPaymentMonth).success) {
    return { ok: false, error: "First payment month must be YYYY-MM" };
  }
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { ok: false, error: "Purchase price must be positive" };
  }
  if (!Number.isFinite(depositTotal) || depositTotal < 0) {
    return { ok: false, error: "Deposit must be ≥ 0" };
  }
  if (depositTotal > purchasePrice) {
    return { ok: false, error: "Deposit cannot exceed purchase price" };
  }
  if (!Number.isFinite(depositFromOa) || depositFromOa < 0) {
    return { ok: false, error: "Deposit from OA must be ≥ 0" };
  }
  if (depositFromOa > depositTotal + 1e-6) {
    return { ok: false, error: "OA deposit cannot exceed total deposit" };
  }
  if (!Number.isFinite(feesFromOa) || feesFromOa < 0) {
    return { ok: false, error: "Fees from OA must be ≥ 0" };
  }
  if (!Number.isFinite(loanTermYears) || loanTermYears <= 0 || loanTermYears > 50) {
    return { ok: false, error: "Loan length must be 1–50 years" };
  }
  const term_months = Math.min(600, Math.max(1, Math.round(loanTermYears * 12)));
  const financing = estimateFinancingNeed({
    purchasePrice,
    cashDownpayment: depositTotal,
    buyersStampDuty,
    includeBuyersStampDutyInLoan,
  });
  if (!financing.ok) {
    return { ok: false, error: financing.error };
  }
  const loan = financing.loanPrincipal;
  if (
    !Number.isFinite(oaShareOfPayment) ||
    oaShareOfPayment < 0 ||
    oaShareOfPayment > 1
  ) {
    return { ok: false, error: "OA instalment share must be between 0 and 1" };
  }

  const annual_nominal_rate = annualRateForQuickLender(lenderType, bankAnnualRate);
  const lump = depositFromOa + feesFromOa;
  const completion_month =
    lump > 0
      ? addMonthsToYearMonth(firstPaymentMonth, -1)
      : firstPaymentMonth;

  return {
    ok: true,
    label: label.trim() || "Home loan",
    principal: loan,
    annual_nominal_rate,
    term_months,
    completion_month,
    first_payment_month: firstPaymentMonth,
    downpayment_from_oa: depositFromOa,
    fees_from_oa: feesFromOa,
    oa_share_of_payment: oaShareOfPayment,
    max_oa_per_month: null,
    lender_type: lenderType,
    original_loan_principal: loan,
    principal_repaid_before_schedule: 0,
  };
}
