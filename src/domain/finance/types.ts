/** Currency amounts in major units (e.g. dollars), not cents. */
export type Money = number;

export type InvestmentSnapshot = {
  currentValue: Money;
  monthlyContribution: Money;
  /** Decimal annual return, e.g. 0.07 for 7%. */
  expectedAnnualReturn: number;
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
   * Sum of planned monthly goal contributions (Goals page). Treated like
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
};

export type TimeToGoalParams = {
  currentValue: Money;
  monthlyContribution: Money;
  annualReturn: number;
  targetAmount: Money;
};

export type TimeToGoalResult = {
  months: number;
};
