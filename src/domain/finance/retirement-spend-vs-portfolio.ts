/** Fixed annual draw on portfolio for v1 “enough?” heuristic (4% rule style). */
export const DEFAULT_RETIREMENT_WITHDRAWAL_ANNUAL_RATE = 0.04;

/** When profile does not set a dividend yield, assume a low dividend equity sleeve. */
export const DEFAULT_RETIREMENT_DIVIDEND_YIELD_ANNUAL = 0.02;

export type RetirementDividendVsSpendResult = {
  /** Yield applied (clamped 0–25%). */
  dividendYieldAnnual: number;
  projectedInvestmentsAtRetirement: number;
  /** Dividend cash flow from investments only: `inv × yield / 12`. */
  monthlyDividendIncome: number;
  /** User's stated goal in today's dollars (unchanged semantics). */
  monthlySpendGoal: number | null;
  /** Goal escalated to retirement-year dollars: `G·(1+gE)^yearsToRetirement`. */
  inflatedMonthlySpendGoal: number | null;
  /**
   * Spending not covered by dividends; model assumes this comes from cash
   * each month (no employment income in retirement in this model).
   */
  monthlyCashSupplementNeeded: number | null;
  /** True when goal is set and dividends alone meet or exceed it. */
  dividendsCoverGoal: boolean | null;
  currentCashTotal: number;
  /**
   * Months current cash could fund the monthly supplement at retirement start,
   * ignoring interest and portfolio change. Null when no supplement.
   */
  cashRunwayMonthsAtSupplement: number | null;
  /**
   * Invested balance needed so that `yield × balance / 12` equals the monthly
   * spend goal (dividend-only funding). Null when no goal or yield is 0.
   */
  requiredInvestedForDividendGoal: number | null;
  /**
   * `projectedInvestmentsAtRetirement − requiredInvestedForDividendGoal`.
   * Positive = ahead of that target; negative = short. Null when not applicable.
   */
  surplusInvestedVsRequired: number | null;
};

/**
 * At retirement: no new contributions modeled here; spending is compared to
 * dividend income on the projected **investment** balance only. Shortfall is
 * expressed as monthly cash to withdraw.
 */
export function analyzeRetirementDividendVsSpend(input: {
  projectedInvestmentsAtRetirement: number;
  goalMonthlySpend: number | null;
  annualDividendYield: number;
  currentCashTotal: number;
  /** Annual expense growth used to inflate the goal. Default 0 = no inflation. */
  expenseGrowthAnnual?: number;
  /** Years from now to retirement. Default 0 ⇒ goal unchanged (backward-compatible). */
  yearsToRetirement?: number;
}): RetirementDividendVsSpendResult {
  const inv = Math.max(0, input.projectedInvestmentsAtRetirement);
  const y = Math.min(0.25, Math.max(0, input.annualDividendYield));
  const monthlyDividendIncome = y > 0 ? (inv * y) / 12 : 0;
  const cash = Math.max(0, input.currentCashTotal);
  const G0 = input.goalMonthlySpend;
  // Math.pow(1, yrs) === 1 exactly, so gE=0 ∨ yrs=0 ⇒ G === G0 byte-identical.
  const G =
    G0 == null || G0 <= 0
      ? G0
      : G0 *
        Math.pow(1 + (input.expenseGrowthAnnual ?? 0), input.yearsToRetirement ?? 0);

  if (G == null || G <= 0) {
    return {
      dividendYieldAnnual: y,
      projectedInvestmentsAtRetirement: inv,
      monthlyDividendIncome,
      monthlySpendGoal: null,
      inflatedMonthlySpendGoal: null,
      monthlyCashSupplementNeeded: null,
      dividendsCoverGoal: null,
      currentCashTotal: cash,
      cashRunwayMonthsAtSupplement: null,
      requiredInvestedForDividendGoal: null,
      surplusInvestedVsRequired: null,
    };
  }

  const monthlyCashSupplementNeeded = Math.max(0, G - monthlyDividendIncome);
  const dividendsCoverGoal = monthlyDividendIncome >= G - 1e-9;

  let requiredInvestedForDividendGoal: number | null = null;
  let surplusInvestedVsRequired: number | null = null;
  if (y > 1e-12) {
    requiredInvestedForDividendGoal = (G * 12) / y;
    surplusInvestedVsRequired = inv - requiredInvestedForDividendGoal;
  }

  let cashRunwayMonthsAtSupplement: number | null = null;
  if (monthlyCashSupplementNeeded > 1e-9) {
    const m = cash / monthlyCashSupplementNeeded;
    cashRunwayMonthsAtSupplement = Number.isFinite(m)
      ? Math.min(m, 1200)
      : null;
  }

  return {
    dividendYieldAnnual: y,
    projectedInvestmentsAtRetirement: inv,
    monthlyDividendIncome,
    monthlySpendGoal: G0,
    inflatedMonthlySpendGoal: G,
    monthlyCashSupplementNeeded,
    dividendsCoverGoal,
    currentCashTotal: cash,
    cashRunwayMonthsAtSupplement,
    requiredInvestedForDividendGoal,
    surplusInvestedVsRequired,
  };
}

export type RetirementSpendVsPortfolioResult = {
  assumedAnnualWithdrawalRate: number;
  impliedSustainableMonthlySpend: number;
  requiredPortfolioForGoal: number | null;
  meetsGoal: boolean | null;
  /** `projectedBalance - requiredPortfolio`; negative means shortfall. */
  surplusVsRequired: number | null;
  /** Goal escalated to retirement-year dollars: `G·(1+gE)^yearsToRetirement`. */
  inflatedMonthlySpendGoal: number | null;
};

/**
 * Compare simplified projected balance at retirement to an optional monthly
 * spend goal using a constant annual withdrawal rate on the balance.
 */
export function analyzeRetirementSpendVsPortfolio(input: {
  projectedBalanceAtRetirement: number;
  goalMonthlySpend: number | null;
  /** Default {@link DEFAULT_RETIREMENT_WITHDRAWAL_ANNUAL_RATE}. */
  annualWithdrawalRate?: number;
  /** Annual expense growth used to inflate the goal. Default 0 = no inflation. */
  expenseGrowthAnnual?: number;
  /** Years from now to retirement. Default 0 ⇒ goal unchanged (backward-compatible). */
  yearsToRetirement?: number;
}): RetirementSpendVsPortfolioResult {
  const rate =
    input.annualWithdrawalRate ?? DEFAULT_RETIREMENT_WITHDRAWAL_ANNUAL_RATE;
  const V = input.projectedBalanceAtRetirement;
  const balanceForDraw = Math.max(0, V);
  const impliedSustainableMonthlySpend =
    rate > 0 ? (balanceForDraw * rate) / 12 : 0;

  const G0 = input.goalMonthlySpend;
  // Math.pow(1, yrs) === 1 exactly, so gE=0 ∨ yrs=0 ⇒ G === G0 byte-identical.
  const G =
    G0 == null || G0 <= 0
      ? G0
      : G0 *
        Math.pow(1 + (input.expenseGrowthAnnual ?? 0), input.yearsToRetirement ?? 0);
  if (G == null || G <= 0 || rate <= 0) {
    return {
      assumedAnnualWithdrawalRate: rate,
      impliedSustainableMonthlySpend,
      requiredPortfolioForGoal: null,
      meetsGoal: null,
      surplusVsRequired: null,
      inflatedMonthlySpendGoal: null,
    };
  }

  const requiredPortfolioForGoal = (G * 12) / rate;
  const meetsGoal = V >= requiredPortfolioForGoal;
  const surplusVsRequired = V - requiredPortfolioForGoal;

  return {
    assumedAnnualWithdrawalRate: rate,
    impliedSustainableMonthlySpend,
    requiredPortfolioForGoal,
    meetsGoal,
    surplusVsRequired,
    inflatedMonthlySpendGoal: G,
  };
}
