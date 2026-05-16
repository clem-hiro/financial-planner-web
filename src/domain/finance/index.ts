export { calculateNetWorth } from "./net-worth";
export { calculateSavingsRate } from "./savings-rate";
export {
  projectFutureValue,
  calculateTimeToGoal,
} from "./projection";
export {
  futureValueInvestmentPortfolioAtMonth,
  calculateTimeToGoalInvestmentPortfolio,
} from "./investment-portfolio-fv";
export {
  contributionMonthsLimitFromInvestmentRow,
} from "./investment-contribution";
export {
  goalProgressRatio,
  estimateTimeToGoalStandalone,
} from "./goal-standalone";
export type { StandaloneGoalEstimate } from "./goal-standalone";
export {
  analyzeGoalDeadlineGap,
  countEndOfMonthContributionPeriods,
  requiredMonthlyForMonths,
} from "./goal-deadline";
export type {
  GoalDeadlineAnalysis,
  GoalDeadlineAnalysisParams,
} from "./goal-deadline";
export {
  ageCompletedOnDate,
  buildNetWorthByAgeProjection,
} from "./age-projection";
export type { InvestmentProjectionLike } from "./age-projection";
export {
  analyzeRetirementDividendVsSpend,
  analyzeRetirementSpendVsPortfolio,
  DEFAULT_RETIREMENT_DIVIDEND_YIELD_ANNUAL,
  DEFAULT_RETIREMENT_WITHDRAWAL_ANNUAL_RATE,
} from "./retirement-spend-vs-portfolio";
export type {
  RetirementDividendVsSpendResult,
  RetirementSpendVsPortfolioResult,
} from "./retirement-spend-vs-portfolio";
export { buildDashboardInsights } from "./insights";
export { buildSpendRecommendationsForMonth } from "./spend-recommendations";
export type { SpendRecommendationsInput } from "./spend-recommendations";
export {
  normalizeCategory,
  isValidYearMonth,
  isMonthlyBudgetLineApplicable,
  plannedMonthlyBudgetTotalForMonth,
  monthlyBudgetVsActual,
  monthlyBudgetAggregateOverspend,
  annualBudgetVsActual,
  topOverBudgetCategories,
} from "./budget";
export {
  ANNUAL_MAX_TOTAL_CPF_CONTRIBUTION_SG,
  ANNUAL_WAGE_CEILING_SG,
  MONTHLY_OW_FROM_ANNUAL_CAP_SG,
  additionalWageCeilingRemaining,
  ordinaryWageCeilingSg,
  monthlyEmployeeCpfTakeHomeSg,
  employeeCpfRateSg,
  annualEmployeeCpfTakeHomeWithBonusSg,
  countAnnualBonusPayoutsInHorizon,
  DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
  isSgCpfAgeBand,
} from "./sg-cpf";
export type {
  SgCpfAgeBand,
  MonthlyCpfBreakdown,
  AnnualCpfBreakdownWithBonus,
} from "./sg-cpf";
export {
  employerCpfRateSg,
  totalCpfContributionRateSg,
  monthlyCpfInflowsFromOwSubject,
  ordinaryWagesSubjectWithYtd,
  sgCpfAgeBandForCompletedAge,
} from "./sg-cpf-contribution-buckets";
export type { OwSubjectYtdResult } from "./sg-cpf-contribution-buckets";
export {
  DEBT_CATEGORIES,
  DEBT_REPAYMENTS_CATEGORY_PREFIX,
  debtBudgetCategoryName,
  debtRepaymentAppliesInMonth,
  debtRepaymentEndYearMonth,
  debtRepaymentStartYearMonth,
  defaultLoanTypeForCategory,
  effectiveMonthlyRepayment,
  estimateAmortizedMonthlyPayment,
  estimateFlatRateMonthlyPayment,
  estimateMonthlyRepayment,
  isDebtBudgetCategory,
  sumDebtRepaymentsInMonth,
} from "./debt-repayment";
export type {
  DebtCategory,
  LiabilityForPlanning,
  LoanType,
} from "./debt-repayment";
export { sumInvestableSurplusOverHorizon } from "./investable-surplus";
export { buildAmortizationSchedule } from "./mortgage-amortization";
export type { AmortizationPayment } from "./mortgage-amortization";
export {
  buildCpfMonthlyProjectionSeries,
  downsampleCpfSeries,
  DEFAULT_CPF_OA_CREDITING_ANNUAL,
  DEFAULT_CPF_SA_CREDITING_ANNUAL,
  DEFAULT_CPF_MA_CREDITING_ANNUAL,
} from "./cpf-monthly-projection";
export {
  buildCpfRetirementProjection,
  simulateRaFormationAt55,
  estimateFutureFrs,
  CURRENT_FRS_SG,
  CPF_RA_FORMATION_AGE,
  DEFAULT_CPF_ASSUMPTIONS,
  CPF_SCENARIO_EXAMPLES,
} from "./cpf-retirement-projection";
export type {
  CpfAssumptions,
  CpfRetirementProjection,
  CpfRaSimulation,
  CpfRetirementTarget,
  CpfScenarioExample,
} from "./cpf-retirement-projection";
export type {
  CpfBalanceSnapshot,
  CpfMonthPoint,
  HousingLoanProjectionInput,
} from "./cpf-monthly-projection";
export {
  bodyAtPurchaseResolved,
  bodyValueEstimate,
  completedMonthsSinceReg,
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
  monthsBetweenYearMonths,
  parfRebateEstimateIllustrative,
  usesDeregistrationAnchors,
  usesImplicitArfBodyFallbackOnly,
  usesMarketValueGross,
  usesNoParfBasisImplicitWithCoeTaper,
  usesPurchaseToCoeTerminalSchedule,
  usesRebateRemainingToTerminal,
  vehicleGrossAssetEstimate,
  vehicleGrossAssetFromDeregistrationAnchors,
  vehicleGrossFromPurchaseToTerminalLinear,
  vehicleGrossFromRebatesRemainingToTerminal,
  cumulativeVehicleProceedsToCash,
  vehicleNetEquity,
  vehicleNetListedBeforeLiquidation,
  vehicleNetProceedsAtCoeMonthEnd,
} from "./vehicle-sg";
export type { VehicleStatus, VehicleValuationInput } from "./vehicle-sg";
export type { MonthlyBudgetVsActualOptions } from "./budget";
export {
  BUDGET_STRATEGY_PRESETS,
  LIFESTYLE_PRESETS,
  budgetBucketForCategoryLabel,
  generateGuidedMonthlyBudgetLines,
  strategyNeedsWantsSavings,
  sumBucketAmounts,
} from "./budget-guided-setup";
export type {
  BudgetSpendBucket,
  BudgetingStrategyId,
  FoodSpendBandId,
  GenerateGuidedBudgetParams,
  GuidedBudgetLineDraft,
  LifestyleProfileId,
  OnboardingConfidenceLevel,
} from "./budget-guided-setup";
export {
  EARNED_INCOME_RELIEF_BY_AGE,
  INCOME_TAX_YA_2026,
  TOTAL_RELIEF_CAP_SGD,
  applyRebate,
  chargeableIncomeFromReliefs,
  computeAnnualTax,
  earnedIncomeReliefForAge,
  grossTaxForChargeableIncome,
  monthlyGiroFromNetTax,
} from "./sg-income-tax";
export type {
  ChargeableIncomeBreakdown,
  IncomeTaxBracket,
  IncomeTaxComputeBreakdown,
  IncomeTaxComputeInput,
  IncomeTaxReliefBundle,
  RebateBreakdown,
} from "./sg-income-tax";
export type * from "./types";
