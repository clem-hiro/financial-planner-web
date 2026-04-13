/**
 * Illustrative helpers for back-solving original / outstanding principal.
 * Singapore LTV rules vary by flat type, tenure, loan tenure, and citizenship—
 * defaults here are planning shortcuts only; always match your LO/HDB docs.
 */
export type HousingLoanEstimateLenderKind = "hdb" | "bank" | "other";

/** Typical planning defaults: max loan as % of purchase (adjust in UI). */
export const DEFAULT_MAX_LOAN_PERCENT_OF_PRICE: Record<
  HousingLoanEstimateLenderKind,
  number
> = {
  /** Often cited ballpark for HDB concessionary-style financing; confirm with HDB. */
  hdb: 80,
  /** Common MAS LTV cap for first residential loan (illustrative). */
  bank: 75,
  other: 75,
};

export type HousingLoanEstimateOk = {
  originalLoanPrincipal: number;
  outstandingPrincipal: number;
  /** When derived from price − loan. */
  impliedTotalDeposit?: number;
};

export type HousingLoanEstimateErr = { error: string };

function clampNonNegative(n: number): number {
  return n < 0 ? 0 : n;
}

export function estimateFromPriceAndTotalDeposit(input: {
  purchasePrice: number;
  /** Everything you paid upfront that is not part of the loan (cash + CPF, etc.). */
  totalDepositPaid: number;
  /** Cumulative principal repaid since drawdown (from statements). */
  cumulativePrincipalRepaid: number;
}): HousingLoanEstimateOk | HousingLoanEstimateErr {
  const { purchasePrice, totalDepositPaid, cumulativePrincipalRepaid } = input;
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { error: "Purchase price must be positive" };
  }
  if (!Number.isFinite(totalDepositPaid) || totalDepositPaid < 0) {
    return { error: "Deposit must be ≥ 0" };
  }
  if (totalDepositPaid > purchasePrice) {
    return { error: "Deposit cannot exceed purchase price" };
  }
  if (
    !Number.isFinite(cumulativePrincipalRepaid) ||
    cumulativePrincipalRepaid < 0
  ) {
    return { error: "Principal repaid must be ≥ 0" };
  }
  const originalLoanPrincipal = purchasePrice - totalDepositPaid;
  if (originalLoanPrincipal <= 0) {
    return { error: "Implied loan must be positive (reduce deposit or check price)" };
  }
  const outstandingPrincipal = clampNonNegative(
    originalLoanPrincipal - cumulativePrincipalRepaid
  );
  return {
    originalLoanPrincipal,
    outstandingPrincipal,
    impliedTotalDeposit: totalDepositPaid,
  };
}

export function estimateFromPriceAndLoanPercentOfPrice(input: {
  purchasePrice: number;
  /** e.g. 80 for 80% of purchase financed. */
  loanPercentOfPrice: number;
  cumulativePrincipalRepaid: number;
}): HousingLoanEstimateOk | HousingLoanEstimateErr {
  const { purchasePrice, loanPercentOfPrice, cumulativePrincipalRepaid } = input;
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { error: "Purchase price must be positive" };
  }
  if (
    !Number.isFinite(loanPercentOfPrice) ||
    loanPercentOfPrice <= 0 ||
    loanPercentOfPrice > 100
  ) {
    return { error: "Loan % of price must be between 0 and 100" };
  }
  if (
    !Number.isFinite(cumulativePrincipalRepaid) ||
    cumulativePrincipalRepaid < 0
  ) {
    return { error: "Principal repaid must be ≥ 0" };
  }
  const originalLoanPrincipal = (purchasePrice * loanPercentOfPrice) / 100;
  const impliedTotalDeposit = purchasePrice - originalLoanPrincipal;
  const outstandingPrincipal = clampNonNegative(
    originalLoanPrincipal - cumulativePrincipalRepaid
  );
  return {
    originalLoanPrincipal,
    outstandingPrincipal,
    impliedTotalDeposit,
  };
}

export function estimateFromOriginalLoanAndPrincipalRepaid(input: {
  originalLoanPrincipal: number;
  cumulativePrincipalRepaid: number;
}): HousingLoanEstimateOk | HousingLoanEstimateErr {
  const { originalLoanPrincipal, cumulativePrincipalRepaid } = input;
  if (!Number.isFinite(originalLoanPrincipal) || originalLoanPrincipal <= 0) {
    return { error: "Original loan must be positive" };
  }
  if (
    !Number.isFinite(cumulativePrincipalRepaid) ||
    cumulativePrincipalRepaid < 0
  ) {
    return { error: "Principal repaid must be ≥ 0" };
  }
  if (cumulativePrincipalRepaid > originalLoanPrincipal + 1e-6) {
    return { error: "Principal repaid cannot exceed original loan" };
  }
  return {
    originalLoanPrincipal,
    outstandingPrincipal: clampNonNegative(
      originalLoanPrincipal - cumulativePrincipalRepaid
    ),
  };
}

export function exceedsTypicalMaxLoan(
  purchasePrice: number,
  impliedLoan: number,
  lender: HousingLoanEstimateLenderKind
): boolean {
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return false;
  if (!Number.isFinite(impliedLoan) || impliedLoan <= 0) return false;
  const cap = DEFAULT_MAX_LOAN_PERCENT_OF_PRICE[lender] / 100;
  return impliedLoan > purchasePrice * cap + 1e-6;
}
