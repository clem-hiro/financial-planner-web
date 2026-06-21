export type AgeOutflowBreakdownItem = {
  key: string;
  label: string;
  sourceType: string;
  amount: number;
};

/** One row of the combined asset / net-worth-by-age path (chart + table). */
export type AgeAssetBreakdownPoint = {
  age: number;
  /** Net after debts: investments + cash + cpf + vehicles − liabilities. */
  value: number;
  phase?: "pre_retirement" | "post_retirement";
  /** Cash-accessible inflows for the chart-facing sample year / phase. */
  cashAccessibleInflow?: number;
  /** Outflows for the chart-facing sample year / phase. */
  requiredOutflow?: number;
  requiredLivingOutflow?: number;
  fundedLivingOutflow?: number;
  unfundedLivingOutflow?: number;
  fundedOutflow?: number;
  unfundedOutflow?: number;
  requiredDebtRepayment?: number;
  fundedDebtRepayment?: number;
  unfundedDebtRepayment?: number;
  debtPrincipalPaid?: number;
  debtInterestPaid?: number;
  debtCpfOaDrawdown?: number;
  /** `cashAccessibleInflow - requiredOutflow` before portfolio yield/principal. */
  prePortfolioGap?: number;
  investmentYieldAvailable?: number;
  investmentYieldUsed?: number;
  principalWithdrawn?: number;
  investmentPrincipalWithdrawn?: number;
  ilpPrincipalWithdrawn?: number;
  /** Employment + bonus income; itemizes part of `cashAccessibleInflow`. */
  employmentInflow?: number;
  investmentDividendInflow?: number;
  ilpIncomeInflow?: number;
  cpfLifeInflow?: number;
  rentalInflow?: number;
  investmentWithdrawalInflow?: number;
  cashReserveDrawdown?: number;
  goalsGap?: number;
  cumulativeGoalsGap?: number;
  scheduledInvestmentTransfer?: number;
  fundedInvestmentTransfer?: number;
  /** Annualized outflow components for the chart-facing sample year / phase. */
  outflowBreakdown?: AgeOutflowBreakdownItem[];
  /** Number of monthly flow rows represented before chart-facing annualization. */
  flowMonthsRepresented?: number;
  /** Multiplier applied to chart-facing flow fields for truncated years/phases. */
  flowAnnualizationFactor?: number;
  investmentPrincipal?: number;
  propertyNet?: number;
  investments: number;
  cash: number;
  cpf: number;
  /** OA / SA / MA / RA / notional CPFIS when a CPF projection exists; else zero. */
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfCpfis: number;
  liabilities: number;
  projectedLiabilities?: number;
  projectedHousingLiabilities?: number;
  projectedNonHousingLiabilities?: number;
  vehiclesNet: number;
};
