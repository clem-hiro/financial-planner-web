/** Currency amounts in major units (e.g. dollars), not cents. */
export type Money = number;

export type InvestmentSnapshot = {
  currentValue: Money;
  monthlyContribution: Money;
  /** Decimal annual return, e.g. 0.07 for 7%. */
  expectedAnnualReturn: number;
  /** Decimal annual contribution step-up, e.g. 0.03 for 3%. */
  contributionGrowthAnnual?: number;
  /** Planned monthly withdrawal once drawdown starts. */
  monthlyWithdrawal?: Money;
};

export type NetWorthInput = {
  investmentValues: Money[];
  cashBalances?: Money[];
  liabilities?: Money[];
  /** CPF OA+SA+MA (+ optional CPFIS notional) when tracked separately from cash. */
  cpfTotal?: Money;
};

export type SavingsRateInput = {
  monthlyIncome: Money;
  monthlyExpenses: Money;
  /**
   * Sum of planned monthly goal contributions (Setup → Goals). Treated like
   * committed outflows from take-home for the rate. Default 0.
   */
  monthlyPlannedGoalContributions?: Money;
};

export type ProjectFutureValueParams = {
  currentValue: Money;
  monthlyContribution: Money;
  annualReturn: number;
  /** Number of months; payments at end of each month. */
  months: number;
  /**
   * Months from the start of the horizon during which contributions apply (then growth only).
   * Omitted or null = contributions for the full `months` window (legacy behavior).
   */
  contributionMonthsLimit?: number | null;
  /** Zero-based month when contributions begin (e.g. future premium start). */
  contributionStartMonth?: number | null;
  /** Annual step-up applied to monthly contributions, e.g. 0.03 for 3%. */
  contributionGrowthAnnual?: number | null;
  /** Monthly withdrawal applied after `withdrawalStartMonth`. */
  monthlyWithdrawal?: Money | null;
  /** Zero-based month offset when withdrawals start. Omitted = no withdrawal. */
  withdrawalStartMonth?: number | null;
};

export type TimeToGoalParams = {
  currentValue: Money;
  monthlyContribution: Money;
  annualReturn: number;
  targetAmount: Money;
  /** Optional cap on contribution months (same semantics as `ProjectFutureValueParams`). */
  contributionMonthsLimit?: number | null;
  contributionStartMonth?: number | null;
  contributionGrowthAnnual?: number | null;
  monthlyWithdrawal?: Money | null;
  withdrawalStartMonth?: number | null;
};

export type TimeToGoalResult = {
  months: number;
};
