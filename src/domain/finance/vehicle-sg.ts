import { formatYearMonth } from "@/lib/dates";

export type VehicleStatus = "active" | "planned";

/** Loan + status inputs for net worth and the unified debt register. */
export type VehicleValuationInput = {
  vehicleStatus: VehicleStatus;
  loanBalanceStored: number;
  loanMonthlyPayment: number;
  loanMonthsRemaining: number | null;
  /** Loan last payment month YYYY-MM — months remaining derived vs `asOf`. */
  loanEndYm: string | null;
};

/** Months from `startYm` to `endYm` (both `YYYY-MM`), non-negative. */
export function monthsBetweenYearMonths(
  startYm: string,
  endYm: string
): number {
  if (!/^\d{4}-\d{2}$/.test(startYm) || !/^\d{4}-\d{2}$/.test(endYm)) return 0;
  const [ys, ms] = startYm.split("-").map(Number);
  const [ye, me] = endYm.split("-").map(Number);
  const n = (ye - ys) * 12 + (me - ms);
  return Math.max(0, n);
}

/** Months left on loan: prefer loan end month vs today, else manual count. */
export function loanMonthsRemainingResolved(
  input: VehicleValuationInput,
  asOf: Date
): number | null {
  const end = input.loanEndYm;
  if (end != null && /^\d{4}-\d{2}$/.test(end)) {
    const cur = formatYearMonth(asOf);
    if (cur > end) return null;
    const n = monthsBetweenYearMonths(cur, end);
    if (n > 0) return n;
    if (n === 0) return 1;
    return null;
  }
  const manual = input.loanMonthsRemaining;
  if (manual != null && manual > 0) return manual;
  return null;
}

/**
 * Remaining loan balance: typed outstanding when set, else instalment × months left.
 */
export function effectiveLoanBalance(
  input: VehicleValuationInput,
  asOf: Date = new Date()
): number {
  const stored = Math.max(0, input.loanBalanceStored);
  if (stored > 0) return stored;

  const pmt = Math.max(0, input.loanMonthlyPayment);
  const n = loanMonthsRemainingResolved(input, asOf);
  if (n != null && n > 0 && pmt > 0) {
    return Math.max(0, pmt * n);
  }
  return 0;
}

/** Net worth contribution: liability only (no resale / COE modelling). */
export function vehicleNetEquity(
  input: VehicleValuationInput,
  asOf: Date
): number {
  if (input.vehicleStatus !== "active") return 0;
  return -effectiveLoanBalance(input, asOf);
}

export function vehicleNetListedBeforeLiquidation(
  input: VehicleValuationInput,
  asOf: Date
): number {
  return vehicleNetEquity(input, asOf);
}

/** COE / resale proceeds are out of scope — always zero. */
export function vehicleNetProceedsAtCoeMonthEnd(
  _input: VehicleValuationInput
): number {
  return 0;
}

export function cumulativeVehicleProceedsToCash(
  _inputs: VehicleValuationInput[],
  _asOf: Date
): number {
  return 0;
}

/** @deprecated Liability-only model — gross asset is always zero. */
export function vehicleGrossAssetEstimate(
  _input: VehicleValuationInput,
  _asOf: Date
): number {
  return 0;
}
