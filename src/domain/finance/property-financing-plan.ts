/** Guided downpayment preset in UI / API (stored on loan row when applicable). */
export type HousingDownpaymentGuidancePreset = "pct_20" | "pct_25" | "custom";

/** Property archetype for future LTV / grant logic (optional metadata). */
export type HousingPropertyKind = "hdb" | "condo" | "ec" | "landed";

export const DEFAULT_DOWNPAYMENT_GUIDANCE_PRESET: HousingDownpaymentGuidancePreset =
  "pct_25";

export function resolveGuidedCashDownpayment(input: {
  purchasePrice: number;
  preset: HousingDownpaymentGuidancePreset;
  /** Decimal 0–1 when preset is custom and user picks % (e.g. 0.3 = 30%). */
  customPercent: number | null | undefined;
  /** Absolute cash downpayment when preset is custom and user picks amount. */
  customAmount: number | null | undefined;
}):
  | { ok: true; depositTotal: number }
  | { ok: false; error: string } {
  const { purchasePrice, preset, customPercent, customAmount } = input;

  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { ok: false, error: "Purchase price must be positive" };
  }

  if (preset === "pct_20") {
    return { ok: true, depositTotal: purchasePrice * 0.2 };
  }
  if (preset === "pct_25") {
    return { ok: true, depositTotal: purchasePrice * 0.25 };
  }

  const amt =
    customAmount != null && Number.isFinite(customAmount)
      ? customAmount
      : null;
  const pct =
    customPercent != null && Number.isFinite(customPercent)
      ? customPercent
      : null;

  if (amt != null && Number.isFinite(amt)) {
    if (amt < 0) {
      return { ok: false, error: "Downpayment must be ≥ 0" };
    }
    if (amt > purchasePrice + 1e-6) {
      return { ok: false, error: "Downpayment cannot exceed purchase price" };
    }
    return { ok: true, depositTotal: amt };
  }

  if (pct != null) {
    if (pct <= 0 || pct > 1) {
      return { ok: false, error: "Custom downpayment % must be between 0 and 100%" };
    }
    return { ok: true, depositTotal: purchasePrice * pct };
  }

  return {
    ok: false,
    error: "Choose a custom downpayment as % or amount",
  };
}

/** Financing need from purchase, cash downpayment, and optional BSD inclusion. */
export function estimateFinancingNeed(input: {
  purchasePrice: number;
  cashDownpayment: number;
  /** Pre-computed BSD for this purchase (see `computeSingaporeResidentialBuyersStampDuty`). */
  buyersStampDuty: number;
  includeBuyersStampDutyInLoan: boolean;
}):
  | { ok: true; loanPrincipal: number }
  | { ok: false; error: string } {
  const { purchasePrice, cashDownpayment, buyersStampDuty, includeBuyersStampDutyInLoan } =
    input;

  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { ok: false, error: "Purchase price must be positive" };
  }
  if (!Number.isFinite(cashDownpayment) || cashDownpayment < 0) {
    return { ok: false, error: "Downpayment must be ≥ 0" };
  }
  if (cashDownpayment > purchasePrice + 1e-6) {
    return { ok: false, error: "Downpayment cannot exceed purchase price" };
  }
  if (!Number.isFinite(buyersStampDuty) || buyersStampDuty < 0) {
    return { ok: false, error: "Invalid BSD estimate" };
  }

  const loan =
    purchasePrice -
    cashDownpayment -
    (includeBuyersStampDutyInLoan ? buyersStampDuty : 0);

  if (!Number.isFinite(loan) || loan <= 0) {
    return {
      ok: false,
      error:
        "Estimated loan must be positive — lower downpayment, turn off “include BSD in loan”, or check purchase price",
    };
  }

  return { ok: true, loanPrincipal: loan };
}
