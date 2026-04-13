import { formatYearMonth } from "@/lib/dates";

export type VehicleStatus = "active" | "planned";

export type VehicleValuationInput = {
  vehicleStatus: VehicleStatus;
  /**
   * When set (e.g. motorcycle), gross asset = this amount — typical listing / market
   * check; overrides PARF/COE and other gross paths until cleared.
   */
  currentMarketValue: number | null;
  /** First registration `YYYY-MM`; null for planned / unknown. */
  firstRegistrationYm: string | null;
  onTheRoadPaid: number;
  /** ARF amount that attracts PARF rebate (from invoice); null → 0 PARF. */
  arfForParf: number | null;
  /** Open-market / body component at purchase; null → OTR minus ARF. */
  bodyOpenMarketAtPurchase: number | null;
  bodyDepreciationYears: number;
  /** COE expiry YYYY-MM (optional; also end month for purchase→terminal schedule). */
  coeExpiryYm: string | null;
  /**
   * Expected total cash back at **COE expiry** (rebates + body you treat as fixed at
   * expiry). With `firstRegistrationYm` + `onTheRoadPaid` + `coeExpiryYm`, gross
   * asset = straight line from OTR at purchase month down to this at COE month.
   */
  terminalRecoveryAtCoeExpiry: number | null;
  /**
   * PARF rebate if deregistered today (e.g. OneMotoring). When this or
   * `coeIfDeregisteredToday` is non-null, gross asset = sum of those (nulls count as 0).
   */
  parfIfDeregisteredToday: number | null;
  coeIfDeregisteredToday: number | null;
  /**
   * Scrap / exporter body value not included in LTA’s PARF line; dealer “PARF + body”
   * quotes often combine PARF with this — enter here instead of inflating PARF.
   */
  bodyScrapIfDeregisteredToday: number | null;
  loanBalanceStored: number;
  loanMonthlyPayment: number;
  loanMonthsRemaining: number | null;
  /** Loan last payment month YYYY-MM — months to PV derived vs `asOf`. */
  loanEndYm: string | null;
  /** Nominal annual; null uses default for PV estimate. */
  loanAnnualNominalRate: number | null;
  /** When true, use `loanBalanceStored` instead of PV from instalment + term. */
  loanPreferStoredBalance: boolean;
  /**
   * When true (and not preferring stored balance), outstanding loan =
   * `loanMonthlyPayment × remaining months` — no interest / PV discount.
   * Dealer “cash back” / rebates stay on the **gross** side (PARF+COE / terminal).
   */
  loanSimpleRemainingEstimate?: boolean;
};

const DEFAULT_CAR_LOAN_ANNUAL = 0.0278;

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

/** Months from first registration month through `asOf` calendar month. */
export function completedMonthsSinceReg(
  firstRegistrationYm: string,
  asOf: Date
): number {
  return monthsBetweenYearMonths(firstRegistrationYm, formatYearMonth(asOf));
}

/**
 * True when user supplied at least one OneMotoring-style deregistration amount
 * (PARF and/or COE “if deregistered today”).
 */
export function usesDeregistrationAnchors(input: VehicleValuationInput): boolean {
  return (
    input.parfIfDeregisteredToday != null || input.coeIfDeregisteredToday != null
  );
}

/**
 * Gross uses only the ARF+body fallback (no market value, OneMotoring anchors, or
 * purchase/rebate → terminal schedules).
 */
export function usesImplicitArfBodyFallbackOnly(
  input: VehicleValuationInput
): boolean {
  if (input.vehicleStatus !== "active") return false;
  return (
    !usesMarketValueGross(input) &&
    !usesRebateRemainingToTerminal(input) &&
    !usesPurchaseToCoeTerminalSchedule(input) &&
    !usesDeregistrationAnchors(input)
  );
}

/**
 * Implicit path with **no ARF for PARF** (typical motorcycles): we do not assume
 * LTA-style PARF or residual “cash back” at COE. When first registration and COE
 * expiry are set, gross is tapered linearly to **zero** by COE month so
 * `vehicleNetProceedsAtCoeMonthEnd` does not invent sale cash you would not receive.
 */
export function usesNoParfBasisImplicitWithCoeTaper(
  input: VehicleValuationInput
): boolean {
  if (!usesImplicitArfBodyFallbackOnly(input)) return false;
  const arf =
    input.arfForParf != null && Number.isFinite(input.arfForParf)
      ? Math.max(0, input.arfForParf)
      : 0;
  if (arf > 0) return false;
  const reg = input.firstRegistrationYm;
  const end = input.coeExpiryYm;
  return (
    reg != null &&
    /^\d{4}-\d{2}$/.test(reg) &&
    end != null &&
    /^\d{4}-\d{2}$/.test(end) &&
    monthsBetweenYearMonths(reg, end) > 0
  );
}

/** Gross asset = `currentMarketValue` (motorcycles, etc.). */
export function usesMarketValueGross(input: VehicleValuationInput): boolean {
  if (input.vehicleStatus !== "active") return false;
  const v = input.currentMarketValue;
  return v != null && Number.isFinite(v) && v >= 0;
}

/**
 * Straight-line gross from **OTR at first registration** to **terminal recovery**
 * at **COE expiry** month (inclusive of elapsed calendar months).
 */
export function usesPurchaseToCoeTerminalSchedule(
  input: VehicleValuationInput
): boolean {
  if (input.vehicleStatus !== "active") return false;
  const t = input.terminalRecoveryAtCoeExpiry;
  if (t == null || !Number.isFinite(t) || t < 0) return false;
  const reg = input.firstRegistrationYm;
  const end = input.coeExpiryYm;
  if (reg == null || !/^\d{4}-\d{2}$/.test(reg)) return false;
  if (end == null || !/^\d{4}-\d{2}$/.test(end)) return false;
  if (input.onTheRoadPaid <= 0) return false;
  if (monthsBetweenYearMonths(reg, end) <= 0) return false;
  return true;
}

/**
 * True when gross asset should ramp from current PARF+COE (+ scrap) toward a fixed
 * terminal at COE expiry, scaled by **remaining months** vs the full window from
 * first registration to COE expiry (instalment does not affect this).
 */
export function usesRebateRemainingToTerminal(
  input: VehicleValuationInput
): boolean {
  if (input.vehicleStatus !== "active") return false;
  const t = input.terminalRecoveryAtCoeExpiry;
  if (t == null || !Number.isFinite(t) || t < 0) return false;
  if (!usesDeregistrationAnchors(input)) return false;
  const reg = input.firstRegistrationYm;
  const end = input.coeExpiryYm;
  if (reg == null || !/^\d{4}-\d{2}$/.test(reg)) return false;
  if (end == null || !/^\d{4}-\d{2}$/.test(end)) return false;
  return monthsBetweenYearMonths(reg, end) > 0;
}

/**
 * Linear from **S** = PARF+COE+scrap “today” at the **current** calendar month
 * position, to **T** = terminal at **COE expiry**: `T + (S − T) × (R / W)` where
 * `W` = months(first reg → COE expiry), `R` = months(current month → COE expiry)
 * (capped at `W`). Each month `R` drops by 1 so the gross steps toward `T`.
 */
export function vehicleGrossFromRebatesRemainingToTerminal(
  input: VehicleValuationInput,
  asOf: Date
): number {
  const T = Math.max(0, input.terminalRecoveryAtCoeExpiry!);
  const S = vehicleGrossAssetFromDeregistrationAnchors(input);
  const reg = input.firstRegistrationYm!;
  const end = input.coeExpiryYm!;
  const W = monthsBetweenYearMonths(reg, end);
  if (W <= 0) return S;
  const cur = formatYearMonth(asOf);
  let R = monthsBetweenYearMonths(cur, end);
  R = Math.min(R, W);
  return T + (S - T) * (R / W);
}

export function vehicleGrossFromPurchaseToTerminalLinear(
  input: VehicleValuationInput,
  asOf: Date
): number {
  const purchaseYm = input.firstRegistrationYm as string;
  const endYm = input.coeExpiryYm as string;
  const terminal = Math.max(0, input.terminalRecoveryAtCoeExpiry as number);
  const purchase = Math.max(0, input.onTheRoadPaid);
  const totalMonths = monthsBetweenYearMonths(purchaseYm, endYm);
  const curYm = formatYearMonth(asOf);
  const elapsed = monthsBetweenYearMonths(purchaseYm, curYm);
  if (totalMonths <= 0) return purchase;
  const frac = Math.min(1, Math.max(0, elapsed / totalMonths));
  return purchase + (terminal - purchase) * frac;
}

/**
 * Gross asset from LTA-style inputs: PARF (today) + COE (today); null side treated as 0.
 */
export function vehicleGrossAssetFromDeregistrationAnchors(
  input: VehicleValuationInput
): number {
  const p =
    input.parfIfDeregisteredToday != null &&
    Number.isFinite(input.parfIfDeregisteredToday)
      ? Math.max(0, input.parfIfDeregisteredToday)
      : 0;
  const c =
    input.coeIfDeregisteredToday != null &&
    Number.isFinite(input.coeIfDeregisteredToday)
      ? Math.max(0, input.coeIfDeregisteredToday)
      : 0;
  const b =
    input.bodyScrapIfDeregisteredToday != null &&
    Number.isFinite(input.bodyScrapIfDeregisteredToday)
      ? Math.max(0, input.bodyScrapIfDeregisteredToday)
      : 0;
  return p + c + b;
}

/**
 * Illustrative PARF rebate: ARF × max(0, 1 − 0.1 × full years since registration),
 * capped at 10 years (common simplified SG description). Not an LTA binding quote.
 */
export function parfRebateEstimateIllustrative(
  arfForParf: number,
  firstRegistrationYm: string | null,
  asOf: Date
): number {
  const arf = Math.max(0, arfForParf);
  if (arf <= 0 || firstRegistrationYm == null) return 0;
  const months = completedMonthsSinceReg(firstRegistrationYm, asOf);
  const fullYears = Math.min(10, Math.floor(months / 12));
  return Math.max(0, arf * (1 - 0.1 * fullYears));
}

export function bodyAtPurchaseResolved(input: VehicleValuationInput): number {
  const otr = Math.max(0, input.onTheRoadPaid);
  const arf = input.arfForParf != null ? Math.max(0, input.arfForParf) : 0;
  if (input.bodyOpenMarketAtPurchase != null) {
    return Math.max(0, input.bodyOpenMarketAtPurchase);
  }
  return Math.max(0, otr - arf);
}

/**
 * How many years we straight-line the **body** over when you do not use
 * OneMotoring PARF+COE anchors — a rough “open market value” decay, not LTA rules.
 */
export function bodyValueEstimate(
  input: VehicleValuationInput,
  asOf: Date
): number {
  if (input.vehicleStatus !== "active") return 0;
  if (input.firstRegistrationYm == null) return 0;
  const base = bodyAtPurchaseResolved(input);
  if (base <= 0) return 0;
  const months = completedMonthsSinceReg(input.firstRegistrationYm, asOf);
  const years = input.bodyDepreciationYears;
  const totalMonths = years * 12;
  const frac = Math.min(1, months / totalMonths);
  return Math.max(0, base * (1 - frac));
}

/** Months left on loan: prefer **loan end month** vs today, else manual count. */
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
 * Remaining loan balance for net equity:
 * - **Statement mode** (`loanPreferStoredBalance`): use typed `loan_balance` only.
 * - **Otherwise**: use **PV** from instalment + remaining months + rate, or if
 *   `loanSimpleRemainingEstimate`, use **instalment × months** (no discount). Typed
 *   balance is **not** used as fallback when instalment is set. If instalment is set
 *   but months cannot be resolved, returns **0**. If instalment is **not** set,
 *   typed balance is still used for balance-only rows.
 */
export function effectiveLoanBalance(
  input: VehicleValuationInput,
  asOf: Date = new Date()
): number {
  const stored = Math.max(0, input.loanBalanceStored);
  if (input.loanPreferStoredBalance) {
    return stored;
  }
  const pmt = Math.max(0, input.loanMonthlyPayment);
  const n = loanMonthsRemainingResolved(input, asOf);
  if (n != null && n > 0 && pmt > 0) {
    if (input.loanSimpleRemainingEstimate === true) {
      return Math.max(0, pmt * n);
    }
    const annual = input.loanAnnualNominalRate ?? DEFAULT_CAR_LOAN_ANNUAL;
    const rm = annual / 12;
    if (rm <= 1e-9) return Math.max(0, pmt * n);
    return Math.max(
      0,
      (pmt * (1 - Math.pow(1 + rm, -n))) / rm
    );
  }
  if (pmt > 0) {
    return 0;
  }
  return stored;
}

export function vehicleGrossAssetEstimate(
  input: VehicleValuationInput,
  asOf: Date
): number {
  if (input.vehicleStatus !== "active") return 0;
  if (usesMarketValueGross(input)) {
    return Math.max(0, input.currentMarketValue as number);
  }
  if (usesRebateRemainingToTerminal(input)) {
    return vehicleGrossFromRebatesRemainingToTerminal(input, asOf);
  }
  if (usesPurchaseToCoeTerminalSchedule(input)) {
    return vehicleGrossFromPurchaseToTerminalLinear(input, asOf);
  }
  if (usesDeregistrationAnchors(input)) {
    return vehicleGrossAssetFromDeregistrationAnchors(input);
  }
  const parf = parfRebateEstimateIllustrative(
    input.arfForParf ?? 0,
    input.firstRegistrationYm,
    asOf
  );
  const body = bodyValueEstimate(input, asOf);
  const raw = parf + body;
  if (usesNoParfBasisImplicitWithCoeTaper(input)) {
    const reg = input.firstRegistrationYm as string;
    const end = input.coeExpiryYm as string;
    const W = monthsBetweenYearMonths(reg, end);
    const curYm = formatYearMonth(asOf);
    const elapsed = Math.min(W, monthsBetweenYearMonths(reg, curYm));
    const t = Math.min(1, Math.max(0, elapsed / W));
    return Math.max(0, raw * (1 - t));
  }
  return raw;
}

export function vehicleNetEquity(
  input: VehicleValuationInput,
  asOf: Date
): number {
  if (input.vehicleStatus !== "active") return 0;
  const asset = vehicleGrossAssetEstimate(input, asOf);
  const loan = effectiveLoanBalance(input, asOf);
  return asset - loan;
}

/** Last instant of `YYYY-MM` (local), for valuation at COE month-end. */
function endOfYearMonthDate(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0, 12, 0, 0, 0);
}

/**
 * Net equity at **end of COE expiry month** — treated as cash received when the
 * vehicle is no longer on the vehicle line (first month strictly after `coeExpiryYm`).
 *
 * **Current market / listing** gross is illustrative (typical motorcycles): the
 * asset drops off after COE without assuming you bank that amount — otherwise net
 * worth would get a phantom “sale” cash bump. Use PARF+COE / terminal / OTR paths
 * when you want modeled cash-in at COE.
 *
 * For implicit valuation with **no ARF / PARF basis** and a known COE month, gross
 * is already tapered to zero there, so this stays at **loan payoff only** (usually 0).
 */
export function vehicleNetProceedsAtCoeMonthEnd(
  input: VehicleValuationInput
): number {
  if (input.vehicleStatus !== "active") return 0;
  if (input.coeExpiryYm == null || !/^\d{4}-\d{2}$/.test(input.coeExpiryYm)) {
    return 0;
  }
  if (usesMarketValueGross(input)) {
    return 0;
  }
  return vehicleNetEquity(input, endOfYearMonthDate(input.coeExpiryYm));
}

/**
 * Vehicle still on the balance sheet (non-zero path) at `asOf`. After COE month,
 * returns 0 — proceeds move to cash via `cumulativeVehicleProceedsToCash`.
 */
export function vehicleNetListedBeforeLiquidation(
  input: VehicleValuationInput,
  asOf: Date
): number {
  if (input.vehicleStatus !== "active") return 0;
  const coe = input.coeExpiryYm;
  if (coe != null && /^\d{4}-\d{2}$/.test(coe)) {
    const asYm = formatYearMonth(asOf);
    if (asYm > coe) return 0;
  }
  return vehicleNetEquity(input, asOf);
}

/**
 * Sum of one-time sale proceeds for every **active** vehicle whose COE month is
 * strictly before `asOf`’s calendar month (each vehicle counted once).
 */
export function cumulativeVehicleProceedsToCash(
  inputs: VehicleValuationInput[],
  asOf: Date
): number {
  const asYm = formatYearMonth(asOf);
  let total = 0;
  for (const input of inputs) {
    if (input.vehicleStatus !== "active") continue;
    const coe = input.coeExpiryYm;
    if (coe == null || !/^\d{4}-\d{2}$/.test(coe)) continue;
    if (asYm > coe) total += vehicleNetProceedsAtCoeMonthEnd(input);
  }
  return total;
}
