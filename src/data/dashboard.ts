import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageCompletedOnDate,
  analyzeRetirementDividendVsSpend,
  analyzeRetirementSpendVsPortfolio,
  buildAmortizationSchedule,
  buildCpfMonthlyProjectionSeries,
  buildDashboardInsights,
  buildNetWorthByAgeProjection,
  buildHousingPaymentInsights,
  buildRetirementCashflowProjection,
  buildSpendRecommendationsForMonth,
  calculateNetWorth,
  calculateSavingsRate,
  annualWithdrawalFromInvestmentRow,
  contributionMonthsLimitFromInvestmentRow,
  contributionStartMonthFromInvestmentRow,
  debtRepaymentStartYearMonth,
  defaultLoanTypeForCategory,
  effectiveMonthlyRepayment,
  investmentMaturityMonthFromInvestmentRow,
  liabilityRowToPlanning,
  oaShareForCpfProjection,
  splitHousingInstalment,
  withdrawalStartMonthFromInvestmentRow,
  DEFAULT_RETIREMENT_DIVIDEND_YIELD_ANNUAL,
  DEFAULT_CPF_LIFE_PAYOUT_RATE_ANNUAL,
  DEFAULT_CPF_LIFE_START_AGE,
  cumulativeVehicleProceedsToCash,
  effectiveLoanBalance,
  futureValueInvestmentPortfolioAtMonth,
  monthlyBudgetAggregateOverspend,
  monthlyBudgetVsActual,
  topOverBudgetCategories,
  vehicleGrossAssetEstimate,
  vehicleNetListedBeforeLiquidation,
  vehicleNetProceedsAtCoeMonthEnd,
} from "@/domain/finance";
import { buildPropertyEquityBreakdown } from "@/domain/housing";
import { housingUpfrontOaEvents } from "@/domain/housing/upfront-oa-events";
import type {
  CpfInvestmentProjectionInput,
  DebtObligationInput,
  HousingLoanProjectionInput,
  ProjectionAssetSnapshot,
  ProjectionInvestmentComponent,
  ProjectionLedgerEntry,
  ProjectionOutflowBreakdownItem,
  ProjectionPeriodRow,
  RetirementCashflowProjectionResult,
} from "@/domain/finance";
import type { RetirementDividendVsSpendResult } from "@/domain/finance";
import {
  type SgCpfAgeBand,
  DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
} from "@/domain/finance/sg-cpf";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import {
  budgetLineRowToDomain,
  expenseRowToBudgetExpense,
  investmentValues,
  num,
  profileAnnualBonus,
  profileAnnualBonusTakeHomeCash,
  profileAnnualSalaryGrowthNominal,
  profileExpenseGrowthNominal,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
  profileRetirementWithdrawalRateAnnual,
  profileCpfAgeBand,
  sumExpenseAmounts,
  sumPlannedMonthlyGoalContributions,
  vehicleRowToValuationInput,
} from "@/data/mappers";
import {
  listBudgetLineOverridesForMonth,
  advisorReadBudgetLineOverridesForMonth,
  overridesToLineIdMap,
} from "@/data/repositories/budget-line-overrides";
import {
  listBudgetLines,
  advisorReadBudgetLines,
} from "@/data/repositories/budget-lines";
import {
  listCashAccounts,
  advisorReadCashAccounts,
} from "@/data/repositories/cash-accounts";
import {
  getCpfBalanceByUserId,
  advisorReadCpfBalances,
} from "@/data/repositories/cpf-balances";
import {
  advisorReadCpfInvestments,
  listCpfInvestments,
} from "@/data/repositories/cpf-investments";
import {
  listFinancialGoals,
  advisorReadGoals,
} from "@/data/repositories/goals";
import {
  listHousingLoans,
  advisorReadHousingLoans,
} from "@/data/repositories/housing-loans";
import {
  listLiabilities,
  advisorReadLiabilities,
} from "@/data/repositories/liabilities";
import {
  listProperties,
  advisorReadProperties,
} from "@/data/repositories/properties";
import {
  listVehicles,
  advisorReadVehicles,
} from "@/data/repositories/vehicles";
import { getCachedProfileById } from "@/data/supabase/request-context";
import { advisorReadProfile } from "@/data/repositories/profiles";
import {
  getIncomeTaxConfig,
  advisorReadIncomeTaxConfig,
} from "@/data/repositories/income-tax-configs";
import {
  listExpensesForMonth,
  advisorReadExpensesForMonth,
} from "@/data/repositories/expenses";
import {
  listInvestments,
  advisorReadInvestments,
} from "@/data/repositories/investments";
import { buildSyntheticTaxExpense } from "@/data/income-tax-synthetic-expense";
import { buildSyntheticHousingCashExpense } from "@/data/housing-cash-synthetic-expense";
import type {
  CpfBalanceRow,
  CpfInvestmentRow,
  HousingLoanRow,
  LiabilityRow,
} from "@/data/supabase/types";
import {
  buildInvestmentProjectionSeries,
  projectionSnapshotFromInvestmentRows,
} from "@/data/projection";
import type { ProjectionSeriesPoint } from "@/data/projection";
import { birthDateIsValidPast } from "@/lib/validation";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";
import { applyProposalChanges } from "@/domain/advisor-proposals/apply-overlay";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import {
  addCalendarMonths,
  addMonthsToYearMonth,
  formatYearMonth,
} from "@/lib/dates";

/**
 * Server-only, role-gated. When `proposalOverlay` is present the four
 * proposal-affected canonical bindings are replaced by the shared overlay
 * mapper before any derivation. Absent/empty ⇒ canonical path is byte-identical.
 */
export type DashboardPayloadOptions = {
  proposalOverlay?: AdvisorProposalChangeRow[];
  /**
   * Viewer discriminator (D1). `"advisor"` routes the consent-gated client
   * tables (investments, income-tax config) through the SECURITY DEFINER
   * `advisor_read_*` RPCs, with `userId` as the client id. Absent ⇒ unchanged
   * client-self `.from()` path — byte-identical to pre-consent-gate (C8); an
   * advisor with no viewer opt hits RLS-denied empty (fail-closed, not a leak).
   */
  viewer?: "advisor";
};

export type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";

export type DashboardPayload = {
  netWorth: number;
  /**
   * Net worth minus tracked CPF (OA+SA+MA+CPFIS notionals). Useful as a
   * liquidity‑oriented headline; full net still includes CPF.
   */
  netWorthExcludingCpf: number;
  netWorthBreakdown: {
    investments: number;
    cash: number;
    /** Tracked CPF + optional CPFIS notional; 0 when not configured. */
    cpf: number;
    liabilities: number;
    /** SG motor gross (rebate ramp, OTR→terminal, PARF+COE, or fallback model). */
    vehiclesGrossAsset: number;
    /** Loan balance used with vehicles (PV or stored). */
    vehiclesLoan: number;
    /** vehiclesGrossAsset − vehiclesLoan; already included in `net`. */
    vehiclesNet: number;
    vehicleCount: number;
    /** Current owned property valuation basis after ownership share. */
    propertiesGrossAsset: number;
    /** Scheduled mortgage balance linked to current owned properties. */
    propertiesLoan: number;
    /** propertiesGrossAsset − propertiesLoan; already included in `net`. */
    propertiesNet: number;
    propertyCount: number;
    net: number;
  };
  /**
   * CPF buckets at each projected age, aligned to `ageProjection.points`.
   * Null when birth date is missing/invalid or gross salary inputs are missing.
   * If CPF balances are not saved, projections start from a virtual $0 snapshot.
   */
  cpfProjectionByAge: Array<{
    age: number;
    oa: number;
    sa: number;
    ma: number;
    cpfis: number;
    ra: number;
    totalCpf: number;
  }> | null;
  cpfYearEndProjection: {
    balanceAsOfMonth: string;
    startYearMonth: string | null;
    targetYearMonth: string;
    projectedMonths: number;
    oa: number;
    sa: number;
    ma: number;
    ra: number;
    cpfis: number;
    totalCpf: number;
  } | null;
  cpfProjectionMissingInputs: Array<{
    label: string;
    href: string;
  }>;
  /** Vertical markers on the CPF chart (e.g. keys / repayment start). */
  cpfHousingMarkers: Array<{ age: number; label: string }>;
  /**
   * How many housing loan rows are passed into the monthly CPF stepper
   * (OA downpayment/fees lumps + your OA share of instalments). 0 means OA
   * excludes mortgage in this projection.
   */
  cpfHousingLoanCountInProjection: number;
  /** True when a `financial_cpf_balances` row exists (even if all buckets are zero). */
  hasCpfBalanceRecord: boolean;
  savingsRate: number | null;
  /** Sum of expense rows in the dashboard month (all spend types). */
  monthlyExpensesLoggedTotal: number;
  /** Planned monthly budget: active monthly lines in that month, with overrides. */
  monthlyPlannedMonthlyBudgetTotal: number;
  /**
   * Spend used for savings rate and dashboard-month discretionary math:
   * logged total when any expense exists in the month, otherwise planned monthly budget.
   */
  monthlyExpensesTotal: number;
  insights: string[];
  /** Rule-based “spend less” / budget guidance for the payload month. */
  spendRecommendations: string[];
  baseCurrency: string;
  month: string;
  investmentSummary: {
    totalValue: number;
    count: number;
  };
  projectionPreview: ProjectionSeriesPoint[];
  /**
   * Net worth by age from the time-aware cash-flow ledger: cash-accessible
   * inflows cover active outflows first; portfolio yield and then principal cover
   * any remaining deficit.
   * Null when birth date is not set or invalid.
   */
  ageProjection: {
    /** Default cash-off retirement runway scenario. */
    points: AgeAssetBreakdownPoint[];
    /** Alternate chart scenario: retirement deficits may spend cash after investments/ILP. */
    cashReservePoints: AgeAssetBreakdownPoint[];
    currentAge: number;
    targetRetirementAge: number;
    projectedAtRetirement: number;
    /**
     * One year’s bonus as cash after employee CPF on AW; modeled as paid once per
     * `annualBonusPayoutMonth` (calendar). Null when no bonus or amount is zero.
     */
    annualBonusTakeHomeNet: number | null;
    /** 1–12; aligns with CPF projection default (December). */
    annualBonusPayoutMonth: number;
    /**
     * CPF notionals at the age used for the headline retirement path (target
     * age, or today’s age when you are already at/past target). Null without projected CPF data.
     */
    cpfBucketsAtTargetRetirement: {
      age: number;
      oa: number;
      sa: number;
      ma: number;
      ra: number;
      cpfis: number;
      totalCpf: number;
    } | null;
    /** Dashboard-month context for legacy cards and method notes. */
    netWorthByAgeModel: {
      fromInvestmentAccountContributions: number;
      /**
       * Take-home minus expenses minus sum of planned monthly goal contributions
       * (dashboard month); floored at 0. Dated goal events, not monthly
       * contributions, drive the long-horizon cash-flow ledger.
       */
      fromTakeHomeSurplus: number;
      takeHomePerMonth: number | null;
      /** Same basis as dashboard `monthlyExpensesTotal` (logged when present, else planned). */
      monthlyExpensesTotal: number;
      /**
       * Annual bonus take-home (after employee CPF on AW) used for lump cash adds on the path.
       */
      annualBonusTakeHomeNet: number | null;
    };
    spendCheck: {
      goalMonthlySpend: number | null;
      /** Dividend-only income vs spend; cash supplement when dividends fall short. */
      dividendPlan: RetirementDividendVsSpendResult;
      assumedAnnualWithdrawalRate: number;
      impliedSustainableMonthlySpend: number;
      requiredPortfolioForGoal: number | null;
      meetsGoal: boolean | null;
      surplusVsRequired: number | null;
    };
  } | null;
  /** Sum across applicable monthly budget lines vs monthly-tagged spend. */
  monthlyBudgetTotals: {
    budget: number;
    spent: number;
    remaining: number;
  };
  /** Aggregate spent vs planned for budgeted categories this month. */
  monthlyBudgetAggregate: { onTrack: boolean; overBy: number };
  /** Top monthly-cadence categories over budget this month (empty if none). */
  monthlyBudgetOver: Array<{
    categoryLabel: string;
    spent: number;
    budget: number;
    overBy: number;
  }>;
  /**
   * Take-home minus spend basis for `month` (logged when any expense exists, else planned
   * monthly budget—same as savings rate). Goals not included—see `discretionaryAfterGoals`.
   */
  takeHomeMinusExpenses: number | null;
  /** Sum of `monthly_contribution` across goals (each term maxed at 0). */
  totalPlannedGoalContributionsMonthly: number;
  /**
   * Take-home minus expenses minus `totalPlannedGoalContributionsMonthly`.
   * Null when take-home is not set. Can be negative.
   */
  discretionaryAfterGoals: number | null;
  /** Goals with a positive planned monthly contribution (shown next to monthly cash flow). */
  goalBudgetHints: Array<{
    goalId: string;
    title: string;
    plannedMonthly: number;
  }>;
};

function housingLoanToProjection(
  row: HousingLoanRow
): HousingLoanProjectionInput {
  const upfrontOaEvents = housingUpfrontOaEvents(row);

  return {
    completionMonth: row.completion_month,
    firstPaymentMonth: row.first_payment_month,
    downpaymentFromOa: num(row.downpayment_from_oa),
    feesFromOa: num(row.fees_from_oa),
    upfrontOaEvents: upfrontOaEvents.length > 0 ? upfrontOaEvents : undefined,
    principal: num(row.principal),
    annualNominalRate: num(row.annual_nominal_rate),
    termMonths: row.term_months,
    oaShareOfPayment: oaShareForCpfProjection(row),
    maxOaPerMonth:
      row.max_oa_per_month != null &&
      String(row.max_oa_per_month).trim() !== ""
        ? num(row.max_oa_per_month)
        : null,
  };
}

function liabilityToDebtObligation(
  row: LiabilityRow,
  startYearMonth: string
): DebtObligationInput | null {
  const liability = liabilityRowToPlanning(row);
  if (liability.balance <= 0) return null;

  const startYm = debtRepaymentStartYearMonth(liability, startYearMonth);
  const repayment = effectiveMonthlyRepayment(liability);
  return {
    id: `liability-${row.id}`,
    label: liability.name,
    kind: "liability",
    balance: liability.balance,
    annualInterestRate: liability.interestRateAnnual ?? 0,
    loanType:
      liability.loanType ?? defaultLoanTypeForCategory(liability.category),
    termMonths: liability.remainingTenureMonths,
    monthlyPayment: repayment > 0 ? repayment : null,
    startMonth: Math.max(0, monthDistance(startYearMonth, startYm)),
    fundingSource: "cash",
  };
}

function housingLoanBalanceAndRemainingSchedule(
  row: HousingLoanRow,
  startYearMonth: string
): { balance: number; firstDueMonth: string; remainingPayments: number } | null {
  const principal = num(row.principal);
  if (principal <= 0 || row.term_months <= 0) return null;

  const schedule = buildAmortizationSchedule({
    principal,
    annualNominalRate: Math.max(0, num(row.annual_nominal_rate)),
    termMonths: row.term_months,
    firstPaymentYearMonth: row.first_payment_month,
  });
  if (schedule.length === 0) return null;

  let balance = principal;
  const remaining = [];
  for (const payment of schedule) {
    if (payment.yearMonth < startYearMonth) {
      balance = payment.balanceAfter;
    } else {
      remaining.push(payment);
    }
  }
  const firstDue = remaining[0];
  if (!firstDue || balance <= 0) return null;
  return {
    balance,
    firstDueMonth: firstDue.yearMonth,
    remainingPayments: remaining.length,
  };
}

function housingLoanToDebtObligation(
  row: HousingLoanRow,
  startYearMonth: string
): DebtObligationInput | null {
  const schedule = housingLoanBalanceAndRemainingSchedule(row, startYearMonth);
  if (!schedule) return null;

  const firstInstalment = buildAmortizationSchedule({
    principal: schedule.balance,
    annualNominalRate: Math.max(0, num(row.annual_nominal_rate)),
    termMonths: schedule.remainingPayments,
    firstPaymentYearMonth: schedule.firstDueMonth,
  })[0]?.totalPayment;
  const monthlyPayment = firstInstalment ?? 0;
  if (monthlyPayment <= 0) return null;

  const split = splitHousingInstalment(row, monthlyPayment);
  return {
    id: `housing-${row.id}`,
    label: row.label,
    kind: "housing",
    balance: schedule.balance,
    annualInterestRate: Math.max(0, num(row.annual_nominal_rate)),
    loanType: "amortized",
    termMonths: schedule.remainingPayments,
    monthlyPayment,
    startMonth: Math.max(0, monthDistance(startYearMonth, schedule.firstDueMonth)),
    fundingSource: split.paymentSource,
    cpfOaShare:
      monthlyPayment > 0 ? Math.min(1, split.cpfOaPayment / monthlyPayment) : 0,
    maxCpfOaMonthly:
      row.max_oa_per_month != null &&
      String(row.max_oa_per_month).trim() !== ""
        ? num(row.max_oa_per_month)
        : null,
  };
}

function buildProjectionDebtObligations({
  liabilities,
  housingLoans,
  startYearMonth,
}: {
  liabilities: LiabilityRow[];
  housingLoans: HousingLoanRow[];
  startYearMonth: string;
}): DebtObligationInput[] {
  return [
    ...liabilities
      .map((row) => liabilityToDebtObligation(row, startYearMonth))
      .filter((row): row is DebtObligationInput => row != null),
    ...housingLoans
      .map((row) => housingLoanToDebtObligation(row, startYearMonth))
      .filter((row): row is DebtObligationInput => row != null),
  ];
}

function cpfInvestmentToProjection(
  row: CpfInvestmentRow
): CpfInvestmentProjectionInput {
  return {
    account: row.account,
    purchaseMonth: row.purchase_month,
    premiumType: row.premium_type,
    amount: num(row.amount),
    projectedGrowthAnnual: num(row.projected_growth_annual),
    maturityMonth: row.maturity_month,
  };
}

function ageAtEndOfYearMonth(birthYmd: string, yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const asOf = new Date(y, m, 0, 12, 0, 0, 0);
  return ageCompletedOnDate(birthYmd, asOf);
}

function isYearMonth(value: string | null | undefined): value is string {
  return value != null && /^\d{4}-\d{2}$/.test(value);
}

function monthDistance(startYm: string, endYm: string): number {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function annualGrowthMultiplierAtYear(
  startYearMonth: string,
  year: number,
  growthAnnual: number
): number {
  if (growthAnnual === 0) return 1;
  let cursor = startYearMonth;
  const targetJanuary = `${year}-01`;
  let multiplier = 1;
  while (cursor <= targetJanuary) {
    if (cursor.endsWith("-01") && cursor > startYearMonth) {
      multiplier *= 1 + growthAnnual;
    }
    cursor = addMonthsToYearMonth(cursor, 1);
  }
  return multiplier;
}

/**
 * Per-age points are sampled one month per age, but retirement spend, dividends, and
 * bonuses are annual lump events. Summing flow fields over the sample's calendar year
 * makes the chart show the full year's spending/shortfall regardless of which month the
 * birthday-aligned sample lands on. Transition years are split by lifecycle phase so a
 * retired sample does not inherit pre-retirement salary from the same calendar year.
 * Stock fields stay point-sampled.
 */
const PROJECTION_FLOW_FIELDS = [
  "cashAccessibleInflow",
  "requiredLivingOutflow",
  "requiredOutflow",
  "fundedLivingOutflow",
  "unfundedLivingOutflow",
  "fundedOutflow",
  "unfundedOutflow",
  "prePortfolioGap",
  "investmentYieldAvailable",
  "investmentYieldUsed",
  "principalWithdrawn",
  "investmentPrincipalWithdrawn",
  "ilpPrincipalWithdrawn",
  "employmentInflow",
  "investmentDividendInflow",
  "ilpIncomeInflow",
  "cpfLifeInflow",
  "rentalInflow",
  "investmentWithdrawalInflow",
  "cashReserveDrawdown",
  "goalsGap",
  "scheduledInvestmentTransfer",
  "fundedInvestmentTransfer",
  "requiredDebtRepayment",
  "fundedDebtRepayment",
  "unfundedDebtRepayment",
  "debtPrincipalPaid",
  "debtInterestPaid",
  "debtCpfOaDrawdown",
] as const;

type ProjectionFlowSums = Record<(typeof PROJECTION_FLOW_FIELDS)[number], number>;

const ANNUALIZED_OUTFLOW_SOURCE_TYPES = new Set([
  "planned_expense",
  "tax",
  "housing_cash",
  "debt_repayment",
  "retirement_spend",
]);

function sumProjectionFlows(rows: ProjectionPeriodRow[]): ProjectionFlowSums {
  const sums = Object.fromEntries(
    PROJECTION_FLOW_FIELDS.map((field) => [field, 0])
  ) as ProjectionFlowSums;
  for (const row of rows) {
    for (const field of PROJECTION_FLOW_FIELDS) sums[field] += row[field];
  }
  return sums;
}

function annualizationFactorForRows(rows: ProjectionPeriodRow[]): number {
  if (rows.length <= 0 || rows.length >= 12) return 1;
  return 12 / rows.length;
}

function sumProjectionOutflows(
  rows: ProjectionPeriodRow[],
  annualizationFactor: number
): ProjectionOutflowBreakdownItem[] {
  const sums = new Map<string, ProjectionOutflowBreakdownItem>();
  for (const row of rows) {
    for (const item of row.outflowBreakdown) {
      const itemFactor = ANNUALIZED_OUTFLOW_SOURCE_TYPES.has(item.sourceType)
        ? annualizationFactor
        : 1;
      const amount = item.amount * itemFactor;
      const existing = sums.get(item.key);
      if (existing) {
        existing.amount += amount;
      } else {
        sums.set(item.key, { ...item, amount });
      }
    }
  }
  return Array.from(sums.values()).sort((a, b) => b.amount - a.amount);
}

function annualizeProjectionFlows(
  flows: ProjectionFlowSums,
  outflows: ProjectionOutflowBreakdownItem[],
  annualizationFactor: number
): ProjectionFlowSums {
  if (annualizationFactor === 1) {
    return {
      ...flows,
      requiredOutflow:
        outflows.reduce((sum, item) => sum + item.amount, 0) ||
        flows.requiredOutflow,
    };
  }

  const rawNamedCashInflow =
    flows.employmentInflow +
    flows.investmentDividendInflow +
    flows.ilpIncomeInflow +
    flows.cpfLifeInflow +
    flows.rentalInflow +
    flows.investmentWithdrawalInflow;
  const rawOtherCashInflow = Math.max(
    0,
    flows.cashAccessibleInflow - rawNamedCashInflow
  );

  const annualized: ProjectionFlowSums = { ...flows };
  annualized.employmentInflow *= annualizationFactor;
  annualized.requiredLivingOutflow *= annualizationFactor;
  annualized.fundedLivingOutflow *= annualizationFactor;
  annualized.unfundedLivingOutflow *= annualizationFactor;
  annualized.fundedOutflow *= annualizationFactor;
  annualized.unfundedOutflow *= annualizationFactor;
  annualized.cpfLifeInflow *= annualizationFactor;
  annualized.rentalInflow *= annualizationFactor;
  annualized.principalWithdrawn *= annualizationFactor;
  annualized.investmentPrincipalWithdrawn *= annualizationFactor;
  annualized.ilpPrincipalWithdrawn *= annualizationFactor;
  annualized.cashReserveDrawdown *= annualizationFactor;
  annualized.goalsGap *= annualizationFactor;
  annualized.scheduledInvestmentTransfer *= annualizationFactor;
  annualized.fundedInvestmentTransfer *= annualizationFactor;
  annualized.requiredDebtRepayment *= annualizationFactor;
  annualized.fundedDebtRepayment *= annualizationFactor;
  annualized.unfundedDebtRepayment *= annualizationFactor;
  annualized.debtPrincipalPaid *= annualizationFactor;
  annualized.debtInterestPaid *= annualizationFactor;
  annualized.debtCpfOaDrawdown *= annualizationFactor;

  annualized.cashAccessibleInflow =
    rawOtherCashInflow +
    annualized.employmentInflow +
    annualized.investmentDividendInflow +
    annualized.ilpIncomeInflow +
    annualized.cpfLifeInflow +
    annualized.rentalInflow +
    annualized.investmentWithdrawalInflow;
  annualized.requiredOutflow =
    outflows.reduce((sum, item) => sum + item.amount, 0) ||
    flows.requiredOutflow * annualizationFactor;
  annualized.prePortfolioGap =
    annualized.cashAccessibleInflow - annualized.requiredOutflow;
  return annualized;
}

function sampleYearPhaseFlowRows({
  rows,
  sample,
  startYearMonth,
  retirementStartMonth,
}: {
  rows: ProjectionPeriodRow[];
  sample: ProjectionPeriodRow;
  startYearMonth: string;
  retirementStartMonth: number;
}): ProjectionPeriodRow[] {
  const sampleYear = sample.yearMonth.slice(0, 4);
  const sampleIsPostRetirement = sample.phase === "post_retirement";
  return rows.filter((row) => {
    if (row.month <= 0) return false;

    // Period rows store the state after a month has been applied. Flow fields
    // therefore belong to the prior month, not the row's state month.
    const flowMonth = row.month - 1;
    const flowYearMonth = addMonthsToYearMonth(startYearMonth, flowMonth);
    if (flowYearMonth.slice(0, 4) !== sampleYear) return false;

    return sampleIsPostRetirement
      ? flowMonth >= retirementStartMonth
      : flowMonth < retirementStartMonth;
  });
}

function retirementSpendLedgerEntries({
  startYearMonth,
  horizonMonths,
  retirementStartMonth,
  monthlySpend,
  growthAnnual,
}: {
  startYearMonth: string;
  horizonMonths: number;
  retirementStartMonth: number;
  monthlySpend: number;
  growthAnnual: number;
}): ProjectionLedgerEntry[] {
  const entries: ProjectionLedgerEntry[] = [];
  const startYear = Number(startYearMonth.slice(0, 4));
  const endYear = Number(
    addMonthsToYearMonth(startYearMonth, horizonMonths).slice(0, 4)
  );
  for (let year = startYear; year <= endYear; year++) {
    const yearStartMonth = monthDistance(startYearMonth, `${year}-01`);
    const nextYearStartMonth = monthDistance(startYearMonth, `${year + 1}-01`);
    const activeStart = Math.max(0, retirementStartMonth, yearStartMonth);
    const activeEnd = Math.min(horizonMonths, nextYearStartMonth);
    if (activeEnd <= activeStart) continue;

    const activeMonths = activeEnd - activeStart;
    const paymentMonth =
      yearStartMonth >= retirementStartMonth && yearStartMonth >= 0
        ? yearStartMonth
        : activeStart;
    entries.push({
      id: `retirement-spend-need-${year}`,
      sourceType: "retirement_spend",
      label: `Retirement spend need ${year}`,
      direction: "outflow",
      cashAccess: "cash",
      phase: "post_retirement",
      cadence: "one_off",
      startMonth: paymentMonth,
      amount:
        monthlySpend *
        activeMonths *
        annualGrowthMultiplierAtYear(startYearMonth, year, growthAnnual),
    });
  }
  return entries;
}

function cpfInitialSnapshot(cpfRow: CpfBalanceRow | null) {
  return {
    oa: cpfRow ? num(cpfRow.oa) : 0,
    sa: cpfRow ? num(cpfRow.sa) : 0,
    ma: cpfRow ? num(cpfRow.ma) : 0,
    ra: 0,
    oaAnnualRate:
      cpfRow &&
      cpfRow.oa_annual_rate != null &&
      String(cpfRow.oa_annual_rate).trim() !== ""
        ? num(cpfRow.oa_annual_rate)
        : undefined,
    saAnnualRate:
      cpfRow &&
      cpfRow.sa_annual_rate != null &&
      String(cpfRow.sa_annual_rate).trim() !== ""
        ? num(cpfRow.sa_annual_rate)
        : undefined,
    maAnnualRate:
      cpfRow &&
      cpfRow.ma_annual_rate != null &&
      String(cpfRow.ma_annual_rate).trim() !== ""
        ? num(cpfRow.ma_annual_rate)
        : undefined,
    cpfisMonthlyFromOa: cpfRow ? num(cpfRow.cpfis_monthly_from_oa) : 0,
    cpfisNotionalBalance: cpfRow ? num(cpfRow.cpfis_notional_balance) : 0,
    cpfisAnnualReturn: cpfRow ? num(cpfRow.cpfis_annual_return) : 0,
  };
}

function buildCpfHousingMarkers(
  birthYmd: string,
  loans: HousingLoanRow[]
): Array<{ age: number; label: string }> {
  const byAge = new Map<number, string[]>();
  for (const L of loans) {
    const ageKeys = ageAtEndOfYearMonth(birthYmd, L.completion_month);
    const agePay = ageAtEndOfYearMonth(birthYmd, L.first_payment_month);
    if (ageKeys === agePay) {
      const arr = byAge.get(ageKeys) ?? [];
      arr.push(`${L.label}: keys + repay (${L.completion_month})`);
      byAge.set(ageKeys, arr);
    } else {
      const k = byAge.get(ageKeys) ?? [];
      k.push(`${L.label}: keys (${L.completion_month})`);
      byAge.set(ageKeys, k);
      const p = byAge.get(agePay) ?? [];
      p.push(`${L.label}: repay (${L.first_payment_month})`);
      byAge.set(agePay, p);
    }
  }
  return [...byAge.entries()]
    .map(([age, parts]) => ({ age, label: parts.join(" · ") }))
    .sort((a, b) => a.age - b.age);
}

export async function getDashboardPayload(
  supabase: SupabaseClient,
  userId: string,
  yearMonth: string,
  opts?: DashboardPayloadOptions
): Promise<DashboardPayload> {
  const isAdvisorViewer = opts?.viewer === "advisor";
  const [
    baseProfile,
    expenses,
    baseInvestments,
    baseCashAccounts,
    baseLiabilityRows,
    baseBudgetLineRows,
    overrideRows,
    baseGoals,
    cpfRow,
    cpfInvestmentRows,
    baseHousingLoanRows,
    baseVehicleRows,
    baseProperties,
    incomeTaxConfig,
  ] = await Promise.all([
    // Consent chokepoint: advisor viewer ⇒ consent-gated RPC (fail-closed
    // null profile when not consented — payload financials derive to empty;
    // the page renders the consent-required gated state via the separate
    // linkage path). Self ⇒ unchanged cached `.from()` (C8 byte-identical).
    isAdvisorViewer
      ? advisorReadProfile(supabase, userId)
      : getCachedProfileById(userId),
    // advisor_read_expenses applies the same calendar-month window the self
    // path does (p_year_month = first of yearMonth) — gated advisor view
    // shows the selected period, not all-time.
    isAdvisorViewer
      ? advisorReadExpensesForMonth(supabase, userId, yearMonth)
      : listExpensesForMonth(supabase, userId, yearMonth),
    // Consent chokepoint: advisor viewer ⇒ RPC (fail-closed empty when not
    // consented); self ⇒ unchanged `.from()` (C8 byte-identical).
    isAdvisorViewer
      ? advisorReadInvestments(supabase, userId)
      : listInvestments(supabase, userId),
    isAdvisorViewer
      ? advisorReadCashAccounts(supabase, userId)
      : listCashAccounts(supabase, userId),
    isAdvisorViewer
      ? advisorReadLiabilities(supabase, userId)
      : listLiabilities(supabase, userId),
    isAdvisorViewer
      ? advisorReadBudgetLines(supabase, userId)
      : listBudgetLines(supabase, userId),
    // advisor_read_budget_line_month_overrides applies the same exact-month
    // (year_month) filter the self path does.
    isAdvisorViewer
      ? advisorReadBudgetLineOverridesForMonth(supabase, userId, yearMonth)
      : listBudgetLineOverridesForMonth(supabase, userId, yearMonth),
    isAdvisorViewer
      ? advisorReadGoals(supabase, userId)
      : listFinancialGoals(supabase, userId),
    isAdvisorViewer
      ? advisorReadCpfBalances(supabase, userId)
      : getCpfBalanceByUserId(supabase, userId),
    isAdvisorViewer
      ? advisorReadCpfInvestments(supabase, userId)
      : listCpfInvestments(supabase, userId),
    isAdvisorViewer
      ? advisorReadHousingLoans(supabase, userId)
      : listHousingLoans(supabase, userId),
    isAdvisorViewer
      ? advisorReadVehicles(supabase, userId)
      : listVehicles(supabase, userId),
    isAdvisorViewer
      ? advisorReadProperties(supabase, userId)
      : listProperties(supabase, userId),
    isAdvisorViewer
      ? advisorReadIncomeTaxConfig(supabase, userId)
      : getIncomeTaxConfig(supabase, userId),
  ]);

  // Projection-input seam: substitute the four proposal-affected bindings
  // BEFORE any derivation. No overlay ⇒ identity (same references) ⇒ the
  // canonical projection is byte-identical to the pre-overlay behaviour.
  //
  // The overlay is composed in-memory from persisted canonical + the persisted
  // proposal diff via the single shared mapper; it is NEVER persisted. The
  // accept path reuses the same mapper so preview == read-after-accept (C6).
  //
  // MERGE-CONFLICT RULE: if this conflicts vs a pre-change main, KEEP this
  // design — reject any persisted overlay snapshot or duplicate mapper. See
  // HANDOFF §7.
  const overlay = opts?.proposalOverlay;
  const {
    profile,
    investments,
    budgetLines: budgetLineRows,
    goals,
    cashAccounts = baseCashAccounts,
    liabilities: liabilityRows = baseLiabilityRows,
    vehicles: vehicleRows = baseVehicleRows,
    properties = baseProperties,
    housingLoans: housingLoanRows = baseHousingLoanRows,
  } =
    overlay && overlay.length > 0
      ? applyProposalChanges(
          {
            profile: baseProfile,
            investments: baseInvestments,
            budgetLines: baseBudgetLineRows,
            goals: baseGoals,
            cashAccounts: baseCashAccounts,
            liabilities: baseLiabilityRows,
            vehicles: baseVehicleRows,
            properties: baseProperties,
            housingLoans: baseHousingLoanRows,
          },
          overlay
        )
      : {
          profile: baseProfile,
          investments: baseInvestments,
          budgetLines: baseBudgetLineRows,
          goals: baseGoals,
          cashAccounts: baseCashAccounts,
          liabilities: baseLiabilityRows,
          vehicles: baseVehicleRows,
          properties: baseProperties,
          housingLoans: baseHousingLoanRows,
        };

  const amountOverrideByLineId = overridesToLineIdMap(overrideRows);
  const domainBudgetLines = budgetLineRows.map(budgetLineRowToDomain);
  const projectionBudgetLines = budgetLineRows
    .filter((row) => row.source_liability_id == null)
    .map(budgetLineRowToDomain);
  const baseBudgetExpenses = expenses.map(expenseRowToBudgetExpense);
  const syntheticTax = buildSyntheticTaxExpense(
    incomeTaxConfig,
    profile,
    yearMonth
  );
  const syntheticHousingCash = buildSyntheticHousingCashExpense(
    housingLoanRows,
    yearMonth
  );
  // Prepend synthetic lines; order doesn't affect `monthlyBudgetVsActual` totals.
  const budgetExpenses = [
    ...(syntheticTax ? [syntheticTax.expense] : []),
    ...(syntheticHousingCash ? [syntheticHousingCash.expense] : []),
    ...baseBudgetExpenses,
  ];
  const monthlyBudget = monthlyBudgetVsActual(domainBudgetLines, budgetExpenses, {
    viewingYearMonth: yearMonth,
    amountOverrideByLineId,
  });

  const monthlyExpensesLoggedTotal = sumExpenseAmounts(expenses);
  const monthlyPlannedMonthlyBudgetTotal = monthlyBudget.totals.budget;
  const monthlyExpensesTotal =
    monthlyExpensesLoggedTotal > 0
      ? monthlyExpensesLoggedTotal
      : monthlyPlannedMonthlyBudgetTotal;

  const income = profileSalaryTakeHomeMonthly(profile, yearMonth);
  const annualBonusTakeHomeNet = profileAnnualBonusTakeHomeCash(
    profile,
    yearMonth
  );
  const totalPlannedGoalContributionsMonthly =
    sumPlannedMonthlyGoalContributions(goals);
  /**
   * Cash left after spend basis (logged when any expense in the month, else planned
   * monthly budget) and planned goal contributions (floored at 0).
   * Kept for dashboard-month cards; the by-age projection now uses dated ledger
   * events instead of repeating this scalar.
   */
  const monthlyInvestableSurplus =
    income != null
      ? Math.max(
          0,
          income -
            monthlyExpensesTotal -
            totalPlannedGoalContributionsMonthly
        )
      : 0;
  const savingsRate =
    income != null
      ? calculateSavingsRate({
          monthlyIncome: income,
          monthlyExpenses: monthlyExpensesTotal,
          monthlyPlannedGoalContributions: totalPlannedGoalContributionsMonthly,
        })
      : null;

  const values = investmentValues(investments);
  const cashBalances = cashAccounts.map((r) => num(r.balance));
  const liabilities = liabilityRows.map((r) => num(r.balance));
  const cpfTotalTracked = cpfRow
    ? num(cpfRow.oa) +
      num(cpfRow.sa) +
      num(cpfRow.ma) +
      num(cpfRow.cpfis_notional_balance)
    : 0;
  const dashboardAsOf = new Date();
  const birthRaw = profile?.birth_date;
  const rawTargetRetirement =
    profile?.target_retirement_age != null
      ? Math.round(Number(profile.target_retirement_age))
      : 65;
  const targetRetirementAgeResolved = Math.min(
    80,
    Math.max(50, rawTargetRetirement)
  );
  const birthValidForAge =
    birthRaw &&
    typeof birthRaw === "string" &&
    birthDateIsValidPast(birthRaw);
  const monthsToRetirementHorizon: number | null = birthValidForAge
    ? Math.max(
        0,
        (targetRetirementAgeResolved -
          ageCompletedOnDate(birthRaw as string, dashboardAsOf)) *
          12
      )
    : null;
  const grossMonthlyForCpf = profileMonthlyGross(profile);
  const bandStrForCpf = profileCpfAgeBand(profile);
  const fixedCpfBand: SgCpfAgeBand | undefined =
    bandStrForCpf === "below_55" ||
    bandStrForCpf === "above_55_to_60" ||
    bandStrForCpf === "above_60_to_65" ||
    bandStrForCpf === "above_65_to_70" ||
    bandStrForCpf === "above_70"
      ? bandStrForCpf
      : undefined;
  const cpfProjectionMissingInputs: DashboardPayload["cpfProjectionMissingInputs"] =
    [];
  if (cpfRow && !isYearMonth(cpfRow.balance_as_of_month)) {
    cpfProjectionMissingInputs.push({
      label: "CPF balance as-of month",
      href: "/setup?tab=cpf#cpf-balances",
    });
  }
  if (grossMonthlyForCpf == null || grossMonthlyForCpf <= 0) {
    cpfProjectionMissingInputs.push({
      label: "Monthly gross salary",
      href: "/setup?tab=profile#profile-assumptions",
    });
  }
  if (!birthValidForAge && fixedCpfBand == null) {
    cpfProjectionMissingInputs.push({
      label: "Birth date or CPF age band",
      href: "/setup?tab=profile#profile-assumptions",
    });
  }
  const cpfBalanceAsOfMonth = cpfRow ? cpfRow.balance_as_of_month : yearMonth;
  const cpfProjectionBalanceAsOfMonth = isYearMonth(cpfBalanceAsOfMonth)
    ? cpfBalanceAsOfMonth
    : null;
  const cpfProjectionStartYearMonth = cpfProjectionBalanceAsOfMonth
    ? addMonthsToYearMonth(cpfProjectionBalanceAsOfMonth, 1)
    : null;
  const cpfEmploymentContributionEndMonth =
    cpfProjectionStartYearMonth != null && monthsToRetirementHorizon != null
      ? Math.max(
          0,
          monthDistance(
            cpfProjectionStartYearMonth,
            addMonthsToYearMonth(yearMonth, monthsToRetirementHorizon)
          )
        )
      : null;
  const cpfYearEndTargetYearMonth = `${yearMonth.slice(0, 4)}-12`;
  let cpfYearEndProjection: DashboardPayload["cpfYearEndProjection"] = null;
  let cpfMonthlySeriesForProjection:
    | ReturnType<typeof buildCpfMonthlyProjectionSeries>
    | null = null;
  if (
    cpfProjectionMissingInputs.length === 0 &&
    cpfProjectionBalanceAsOfMonth != null &&
    cpfProjectionStartYearMonth != null &&
    grossMonthlyForCpf != null
  ) {
    const monthsToYearEnd = monthDistance(
      cpfProjectionStartYearMonth,
      cpfYearEndTargetYearMonth
    );
    if (monthsToYearEnd < 0) {
      const initialCpf = cpfInitialSnapshot(cpfRow);
      const cpfis = initialCpf.cpfisNotionalBalance;
      cpfYearEndProjection = {
        balanceAsOfMonth: cpfProjectionBalanceAsOfMonth,
        startYearMonth: null,
        targetYearMonth: cpfYearEndTargetYearMonth,
        projectedMonths: 0,
        oa: initialCpf.oa,
        sa: initialCpf.sa,
        ma: initialCpf.ma,
        ra: initialCpf.ra ?? 0,
        cpfis,
        totalCpf: initialCpf.oa + initialCpf.sa + initialCpf.ma + cpfis,
      };
    } else {
      const yearEndHorizonMonths = monthsToYearEnd + 1;
      cpfMonthlySeriesForProjection = buildCpfMonthlyProjectionSeries({
        startYearMonth: cpfProjectionStartYearMonth,
        horizonMonths: yearEndHorizonMonths,
        birthDate:
          birthValidForAge && typeof birthRaw === "string" ? birthRaw : null,
        fixedCpfAgeBand: fixedCpfBand,
        grossMonthly: grossMonthlyForCpf,
        annualBonus: profileAnnualBonus(profile),
        annualSalaryGrowthNominal: profileAnnualSalaryGrowthNominal(profile),
        employmentContributionEndMonth: cpfEmploymentContributionEndMonth,
        initial: cpfInitialSnapshot(cpfRow),
        housingLoans: housingLoanRows.map(housingLoanToProjection),
        deductRecurringHousingPayments: false,
        cpfInvestments: cpfInvestmentRows.map(cpfInvestmentToProjection),
      });
      const yearEndRow =
        cpfMonthlySeriesForProjection[cpfMonthlySeriesForProjection.length - 1];
      if (yearEndRow) {
        cpfYearEndProjection = {
          balanceAsOfMonth: cpfProjectionBalanceAsOfMonth,
          startYearMonth: cpfProjectionStartYearMonth,
          targetYearMonth: cpfYearEndTargetYearMonth,
          projectedMonths: yearEndHorizonMonths,
          oa: yearEndRow.oa,
          sa: yearEndRow.sa,
          ma: yearEndRow.ma,
          ra: yearEndRow.ra,
          cpfis: yearEndRow.cpfis,
          totalCpf: yearEndRow.totalCpf,
        };
      }
    }
  }
  const vehicleValuationInputs = vehicleRows.map(vehicleRowToValuationInput);
  const vehicleProceedsCashNow = cumulativeVehicleProceedsToCash(
    vehicleValuationInputs,
    dashboardAsOf
  );
  let vehiclesGrossAsset = 0;
  let vehiclesLoanForNw = 0;
  let activeVehicleCount = 0;
  for (const vi of vehicleValuationInputs) {
    if (vi.vehicleStatus !== "active") continue;
    activeVehicleCount += 1;
    const vn = vehicleNetListedBeforeLiquidation(vi, dashboardAsOf);
    if (vn > 0) {
      vehiclesGrossAsset += vehicleGrossAssetEstimate(vi, dashboardAsOf);
      vehiclesLoanForNw += effectiveLoanBalance(vi, dashboardAsOf);
    }
  }
  const vehiclesNetEquityTotal = vehicleValuationInputs
    .filter((v) => v.vehicleStatus === "active")
    .reduce(
      (s, vi) => s + vehicleNetListedBeforeLiquidation(vi, dashboardAsOf),
      0
    );
  const baseNetWorth = calculateNetWorth({
    investmentValues: values,
    cashBalances,
    liabilities,
    cpfTotal: cpfRow ? cpfTotalTracked : undefined,
  });
  const propertyEquityNow = buildPropertyEquityBreakdown({
    properties,
    housingLoans: housingLoanRows,
    asOfYearMonth: formatYearMonth(dashboardAsOf),
  });
  const netWorth =
    baseNetWorth +
    vehiclesNetEquityTotal +
    vehicleProceedsCashNow +
    propertyEquityNow.propertiesNet;
  const investmentsTotal = values.reduce((a, b) => a + b, 0);
  const cashTotal = cashBalances.reduce((a, b) => a + b, 0);
  const liabilitiesTotal = liabilities.reduce((a, b) => a + b, 0);
  const netWorthBreakdown = {
    investments: investmentsTotal,
    cash: cashTotal + vehicleProceedsCashNow,
    cpf: cpfRow ? cpfTotalTracked : 0,
    liabilities: liabilitiesTotal,
    vehiclesGrossAsset,
    vehiclesLoan: vehiclesLoanForNw,
    vehiclesNet: vehiclesNetEquityTotal,
    vehicleCount: activeVehicleCount,
    propertiesGrossAsset: propertyEquityNow.propertiesGrossAsset,
    propertiesLoan: propertyEquityNow.propertiesLoan,
    propertiesNet: propertyEquityNow.propertiesNet,
    propertyCount: propertyEquityNow.propertyCount,
    net: netWorth,
  };
  const netWorthExcludingCpf = netWorth - netWorthBreakdown.cpf;

  const baseInsights = buildDashboardInsights({
    monthlyIncome: income,
    monthlyExpensesTotal,
    savingsRate,
    netWorth,
  });

  const totalValue = investmentsTotal;

  const snap = projectionSnapshotFromInvestmentRows(investments);
  const projectionPreview =
    snap != null
      ? buildInvestmentProjectionSeries(investments, 36, {
          monthsToRetirementFromNow: monthsToRetirementHorizon,
        })
      : [];

  let ageProjection: DashboardPayload["ageProjection"] = null;
  let cpfProjectionByAge: DashboardPayload["cpfProjectionByAge"] = null;
  let cpfHousingMarkers: DashboardPayload["cpfHousingMarkers"] = [];
  if (
    birthRaw &&
    typeof birthRaw === "string" &&
    birthDateIsValidPast(birthRaw)
  ) {
    const asOf = dashboardAsOf;
    const currentAge = ageCompletedOnDate(birthRaw, asOf);
    const targetRetirementAge = targetRetirementAgeResolved;
    const snapForAgeBase = snap ?? {
      currentValue: 0,
      monthlyContribution: 0,
      annualReturn: 0,
    };
    const monthsToRet = monthsToRetirementHorizon ?? 0;
    const nwAgePoints = buildNetWorthByAgeProjection({
      birthDate: birthRaw,
      asOf,
      investmentSnapshot: snapForAgeBase,
      investmentRows: investments,
      monthsToRetirementFromNow: monthsToRetirementHorizon,
      cashTotal,
      liabilitiesTotal,
      ageStep: 1,
      emphasizeAge: targetRetirementAge,
    });
    let invAtRet = futureValueInvestmentPortfolioAtMonth(
      investments,
      monthsToRet,
      monthsToRetirementHorizon
    );
    const extraTaxMonthly =
      syntheticTax?.expense.spendPeriod === "monthly"
        ? syntheticTax.expense.amount
        : 0;
    if (
      cpfMonthlySeriesForProjection != null &&
      cpfProjectionStartYearMonth != null &&
      grossMonthlyForCpf != null
    ) {
      const maxAgeOnAxis = Math.max(...nwAgePoints.map((p) => p.age));
      const lastAgePointYearMonth = addMonthsToYearMonth(
        yearMonth,
        (maxAgeOnAxis - currentAge) * 12
      );
      const horizonMonths = Math.max(
        cpfMonthlySeriesForProjection.length,
        monthDistance(cpfProjectionStartYearMonth, lastAgePointYearMonth) + 1
      );
      const monthlySeries =
        cpfMonthlySeriesForProjection.length >= horizonMonths
          ? cpfMonthlySeriesForProjection
          : buildCpfMonthlyProjectionSeries({
              startYearMonth: cpfProjectionStartYearMonth,
              horizonMonths,
              birthDate: birthRaw,
              fixedCpfAgeBand: fixedCpfBand,
              grossMonthly: grossMonthlyForCpf,
              annualBonus: profileAnnualBonus(profile),
              annualSalaryGrowthNominal: profileAnnualSalaryGrowthNominal(profile),
              employmentContributionEndMonth: cpfEmploymentContributionEndMonth,
              initial: cpfInitialSnapshot(cpfRow),
              housingLoans: housingLoanRows.map(housingLoanToProjection),
              deductRecurringHousingPayments: false,
              cpfInvestments: cpfInvestmentRows.map(cpfInvestmentToProjection),
            });
      cpfMonthlySeriesForProjection = monthlySeries;
      cpfProjectionByAge = nwAgePoints.map((p) => {
        const targetYearMonth = addMonthsToYearMonth(
          yearMonth,
          (p.age - currentAge) * 12
        );
        const idx = Math.min(
          Math.max(0, monthDistance(cpfProjectionStartYearMonth, targetYearMonth)),
          monthlySeries.length - 1
        );
        const row = monthlySeries[idx];
        return {
          age: p.age,
          oa: row?.oa ?? 0,
          sa: row?.sa ?? 0,
          ma: row?.ma ?? 0,
          ra: row?.ra ?? 0,
          cpfis: row?.cpfis ?? 0,
          totalCpf: row?.totalCpf ?? 0,
        };
      });
      cpfHousingMarkers = buildCpfHousingMarkers(birthRaw, housingLoanRows);
    }

    let cpfBucketsAtTargetRetirement: NonNullable<
      DashboardPayload["ageProjection"]
    >["cpfBucketsAtTargetRetirement"] = null;
    if (cpfProjectionByAge && cpfProjectionByAge.length > 0) {
      const rowAtTarget =
        currentAge >= targetRetirementAge
          ? cpfProjectionByAge[0]
          : cpfProjectionByAge.find((r) => r.age === targetRetirementAge);
      if (rowAtTarget) {
        cpfBucketsAtTargetRetirement = {
          age: rowAtTarget.age,
          oa: rowAtTarget.oa,
          sa: rowAtTarget.sa,
          ma: rowAtTarget.ma,
          ra: rowAtTarget.ra,
          cpfis: rowAtTarget.cpfis,
          totalCpf: rowAtTarget.totalCpf,
        };
      }
    }

    const rawGoal = profile?.retirement_monthly_spend_goal;
    const goalMonthlySpend: number | null =
      rawGoal != null && String(rawGoal).trim() !== ""
        ? num(rawGoal as string)
        : null;
    const rawDivYield = profile?.retirement_dividend_yield_annual;
    const dividendYieldAnnual =
      rawDivYield != null && String(rawDivYield).trim() !== ""
        ? Math.min(0.25, Math.max(0, num(rawDivYield as string)))
        : DEFAULT_RETIREMENT_DIVIDEND_YIELD_ANNUAL;
    const ledger: ProjectionLedgerEntry[] = [];
    const retirementStartMonth = Math.max(0, monthsToRet);
    const horizonMonths = Math.max(...nwAgePoints.map((p) => p.monthsFromToday));
    if (income != null && income > 0 && retirementStartMonth > 0) {
      ledger.push({
        id: "employment-income",
        sourceType: "employment_income",
        label: "Employment income",
        direction: "inflow",
        cashAccess: "cash",
        phase: "pre_retirement",
        cadence: "monthly",
        startMonth: 0,
        endMonth: retirementStartMonth,
        amount: income,
        growthAnnual: profileAnnualSalaryGrowthNominal(profile),
      });
    }
    if (annualBonusTakeHomeNet > 0 && retirementStartMonth > 0) {
      ledger.push({
        id: "annual-bonus",
        sourceType: "bonus_income",
        label: "Annual bonus",
        direction: "inflow",
        cashAccess: "cash",
        phase: "pre_retirement",
        cadence: "annual",
        startMonth: 0,
        endMonth: retirementStartMonth,
        amount: annualBonusTakeHomeNet,
        growthAnnual: profileAnnualSalaryGrowthNominal(profile),
        monthOfYear: DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
      });
    }
    vehicleRows.forEach((vehicleRow, index) => {
      const vehicle = vehicleValuationInputs[index];
      if (!vehicle) return;
      if (vehicle.vehicleStatus !== "active" || vehicle.coeExpiryYm == null) {
        return;
      }
      const proceeds = vehicleNetProceedsAtCoeMonthEnd(vehicle);
      if (proceeds <= 0) return;
      const cashInMonth = monthDistance(
        yearMonth,
        addMonthsToYearMonth(vehicle.coeExpiryYm, 1)
      );
      if (cashInMonth < 0 || cashInMonth > horizonMonths) return;
      ledger.push({
        id: `vehicle-proceeds-${vehicleRow.id}`,
        sourceType: "vehicle_proceeds",
        sourceId: vehicleRow.id,
        label: `${vehicleRow.label} COE proceeds`,
        direction: "inflow",
        cashAccess: "cash",
        phase: "both",
        cadence: "one_off",
        startMonth: cashInMonth,
        amount: proceeds,
      });
    });
    for (const property of properties) {
      const rental = num(property.rental_income_monthly);
      if (property.planning_scope === "current" && rental > 0) {
        ledger.push({
          id: `property-rental-${property.id}`,
          sourceType: "rental_income",
          sourceId: property.id,
          label: `${property.name} rental income`,
          direction: "inflow",
          cashAccess: "cash",
          phase: "both",
          cadence: "monthly",
          startMonth: 0,
          amount: rental,
        });
      }
    }
    for (const line of projectionBudgetLines) {
      if (line.cadence !== "monthly" || line.amount <= 0) continue;
      const startMonth =
        line.startYearMonth != null && line.startYearMonth !== ""
          ? Math.max(0, monthDistance(yearMonth, line.startYearMonth))
          : 0;
      const endMonth =
        line.endYearMonth != null && line.endYearMonth !== ""
          ? Math.min(
              retirementStartMonth,
              Math.max(0, monthDistance(yearMonth, line.endYearMonth) + 1)
            )
          : retirementStartMonth;
      if (startMonth >= retirementStartMonth || endMonth <= startMonth) continue;
      ledger.push({
        id: `budget-line-${line.id ?? line.category}`,
        sourceType: "planned_expense",
        sourceId: line.id ?? null,
        label: line.category,
        direction: "outflow",
        cashAccess: "cash",
        phase: "pre_retirement",
        cadence: "monthly",
        startMonth,
        endMonth,
        amount:
          line.id != null && amountOverrideByLineId[line.id] != null
            ? amountOverrideByLineId[line.id]
            : line.amount,
        growthAnnual: profileExpenseGrowthNominal(profile),
      });
    }
    if (extraTaxMonthly > 0 && retirementStartMonth > 0) {
      ledger.push({
        id: "synthetic-tax",
        sourceType: "tax",
        label: "Estimated income tax",
        direction: "outflow",
        cashAccess: "cash",
        phase: "pre_retirement",
        cadence: "monthly",
        startMonth: 0,
        endMonth: retirementStartMonth,
        amount: extraTaxMonthly,
        growthAnnual: profileExpenseGrowthNominal(profile),
      });
    }
    for (const goal of goals) {
      const targetMonth = goal.target_date?.slice(0, 7);
      if (!targetMonth || !isYearMonth(targetMonth)) continue;
      const startMonth = monthDistance(yearMonth, targetMonth);
      if (startMonth < 0 || startMonth >= retirementStartMonth) continue;
      const remainingNeed = Math.max(
        0,
        num(goal.target_amount) - num(goal.current_amount)
      );
      if (remainingNeed <= 0) continue;
      ledger.push({
        id: `goal-event-${goal.id}`,
        sourceType: "goal_event",
        sourceId: goal.id,
        label: goal.title,
        direction: "outflow",
        cashAccess: "cash",
        phase: "pre_retirement",
        cadence: "one_off",
        startMonth,
        amount: remainingNeed,
      });
    }
    if (goalMonthlySpend != null && goalMonthlySpend > 0) {
      ledger.push(
        ...retirementSpendLedgerEntries({
          startYearMonth: yearMonth,
          horizonMonths,
          retirementStartMonth,
          monthlySpend: goalMonthlySpend,
          growthAnnual: profileExpenseGrowthNominal(profile),
        })
      );
    }
    if (retirementStartMonth > 0) {
      for (const investment of investments) {
        const contribution = num(investment.monthly_contribution);
        if (contribution <= 0) continue;
        const startMonth =
          contributionStartMonthFromInvestmentRow(investment) ?? 0;
        const contributionLimit = contributionMonthsLimitFromInvestmentRow(
          investment,
          monthsToRetirementHorizon
        );
        const endMonth = Math.min(
          retirementStartMonth,
          contributionLimit ?? retirementStartMonth
        );
        if (startMonth >= endMonth) continue;
        ledger.push({
          id: `investment-transfer-${investment.id}`,
          sourceType: "investment_contribution",
          sourceId: investment.id,
          label: `${investment.name} contribution`,
          direction: "transfer",
          cashAccess: "cash",
          phase: "pre_retirement",
          cadence: "monthly",
          startMonth,
          endMonth,
          amount: contribution,
          growthAnnual: num(investment.contribution_growth_annual),
          assetTarget: "investment",
        });
      }
    }
    const cpfLifeStartMonth = Math.max(
      0,
      (DEFAULT_CPF_LIFE_START_AGE - currentAge) * 12
    );
    const cpfLifeRow =
      cpfProjectionByAge?.find((r) => r.age === DEFAULT_CPF_LIFE_START_AGE) ??
      (currentAge >= DEFAULT_CPF_LIFE_START_AGE
        ? cpfProjectionByAge?.[0]
        : null);
    const cpfLifePremium = cpfLifeRow?.ra ?? 0;
    const cpfLifeMonthlyPayout =
      cpfLifePremium > 0
        ? (cpfLifePremium * DEFAULT_CPF_LIFE_PAYOUT_RATE_ANNUAL) / 12
        : 0;
    if (cpfLifeMonthlyPayout > 0) {
      ledger.push({
        id: "cpf-life-payout",
        sourceType: "cpf_life",
        label: "CPF LIFE payout",
        direction: "inflow",
        cashAccess: "cash",
        phase: "both",
        cadence: "monthly",
        startMonth: cpfLifeStartMonth,
        amount: cpfLifeMonthlyPayout,
      });
      ledger.push({
        id: "cpf-life-premium-conversion",
        sourceType: "cpf_life_premium",
        label: "CPF LIFE premium conversion",
        direction: "asset_change",
        cashAccess: "locked",
        phase: "both",
        cadence: "one_off",
        startMonth: cpfLifeStartMonth,
        amount: -cpfLifePremium,
        assetTarget: "cpf",
      });
    }
    const cpfSnapshotForProjectionMonth = (month: number) => {
      const targetYearMonth = addMonthsToYearMonth(yearMonth, month);
      if (
        cpfMonthlySeriesForProjection != null &&
        cpfProjectionStartYearMonth != null &&
        cpfMonthlySeriesForProjection.length > 0
      ) {
        const idx = monthDistance(cpfProjectionStartYearMonth, targetYearMonth);
        if (idx >= 0) {
          const row =
            cpfMonthlySeriesForProjection[
              Math.min(idx, cpfMonthlySeriesForProjection.length - 1)
            ];
          return {
            cpf: row?.totalCpf ?? 0,
            cpfOa: row?.oa ?? 0,
            cpfSa: row?.sa ?? 0,
            cpfMa: row?.ma ?? 0,
            cpfRa: row?.ra ?? 0,
            cpfCpfis: row?.cpfis ?? 0,
          };
        }
      }

      const initial = cpfInitialSnapshot(cpfRow);
      return {
        cpf:
          initial.oa +
          initial.sa +
          initial.ma +
          (initial.ra ?? 0) +
          initial.cpfisNotionalBalance,
        cpfOa: initial.oa,
        cpfSa: initial.sa,
        cpfMa: initial.ma,
        cpfRa: initial.ra ?? 0,
        cpfCpfis: initial.cpfisNotionalBalance,
      };
    };
    const externalAssetSnapshots: ProjectionAssetSnapshot[] = Array.from(
      { length: horizonMonths + 1 },
      (_, month) => {
        const asOfHorizon = addCalendarMonths(dashboardAsOf, month);
        const propertyEquity = buildPropertyEquityBreakdown({
          properties,
          housingLoans: housingLoanRows,
          asOfYearMonth: formatYearMonth(asOfHorizon),
        });
        return {
          month,
          ...cpfSnapshotForProjectionMonth(month),
          vehiclesNet: vehicleValuationInputs
            .filter((v) => v.vehicleStatus === "active")
            .reduce(
              (sum, vehicle) =>
                sum + vehicleNetListedBeforeLiquidation(vehicle, asOfHorizon),
              0
            ),
          propertyGross: propertyEquity.propertiesGrossAsset,
        };
      }
    );
    const investmentComponents: ProjectionInvestmentComponent[] = investments.map(
      (investment) => {
        const kind =
          investment.plan_nature === "includes_insurance_coverage"
            ? "ilp"
            : "pure_investment";
        return {
          id: investment.id,
          label: investment.name,
          kind,
          initialPrincipal: num(investment.current_value),
          annualGrowthRate: num(investment.expected_annual_return),
          investmentIncomeRateAnnual: num(
            investment.investment_income_rate_annual ?? "0"
          ),
          annualWithdrawal: annualWithdrawalFromInvestmentRow(investment),
          withdrawalStartMonth: withdrawalStartMonthFromInvestmentRow(
            investment,
            monthsToRetirementHorizon
          ),
          maturityMonth:
            kind === "ilp"
              ? investmentMaturityMonthFromInvestmentRow(
                  investment,
                  dashboardAsOf
                )
              : null,
        };
      }
    );
    const debtObligations = buildProjectionDebtObligations({
      liabilities: liabilityRows,
      housingLoans: housingLoanRows,
      startYearMonth: yearMonth,
    });
    const cashflowProjectionInput = {
      startYearMonth: yearMonth,
      horizonMonths,
      targetRetirementMonth: retirementStartMonth,
      initialCash: cashTotal + vehicleProceedsCashNow,
      initialInvestmentPrincipal: investmentsTotal,
      liabilities: liabilitiesTotal,
      debtObligations,
      investmentTotalReturnAnnual: snapForAgeBase.annualReturn,
      investmentComponents,
      ledger,
      samplePoints: nwAgePoints,
      externalAssetSnapshots,
    };
    const cashflowProjection = buildRetirementCashflowProjection(
      cashflowProjectionInput
    );
    const cashReserveCashflowProjection = buildRetirementCashflowProjection({
      ...cashflowProjectionInput,
      useCashReserveForDeficits: true,
    });
    const rowAtRetirement =
      currentAge >= targetRetirementAge
        ? cashflowProjection.samples[0]
        : cashflowProjection.samples.find((r) => r.age === targetRetirementAge);
    if (rowAtRetirement) {
      invAtRet = rowAtRetirement.investmentPrincipal;
    }
    const projectedAtRetirement =
      rowAtRetirement?.netWorth ??
      cashflowProjection.samples[0]?.netWorth ??
      investmentsTotal + cashTotal - liabilitiesTotal;
    const dividendPlan = analyzeRetirementDividendVsSpend({
      projectedInvestmentsAtRetirement: invAtRet,
      goalMonthlySpend:
        goalMonthlySpend != null && goalMonthlySpend > 0
          ? goalMonthlySpend
          : null,
      annualDividendYield: dividendYieldAnnual,
      currentCashTotal: cashTotal,
      expenseGrowthAnnual: profileExpenseGrowthNominal(profile),
      yearsToRetirement: monthsToRet / 12,
    });
    const spendCheck = {
      goalMonthlySpend,
      dividendPlan,
      ...analyzeRetirementSpendVsPortfolio({
        projectedBalanceAtRetirement: projectedAtRetirement,
        goalMonthlySpend:
          goalMonthlySpend != null && goalMonthlySpend > 0
            ? goalMonthlySpend
            : null,
        annualWithdrawalRate: profileRetirementWithdrawalRateAnnual(profile) ?? undefined,
        expenseGrowthAnnual: profileExpenseGrowthNominal(profile),
        yearsToRetirement: monthsToRet / 12,
      }),
    };
    const toAssetPoints = (
      projection: RetirementCashflowProjectionResult
    ): AgeAssetBreakdownPoint[] =>
      projection.samples.map((p) => {
        const flowRows = sampleYearPhaseFlowRows({
          rows: projection.periods,
          sample: p,
          startYearMonth: yearMonth,
          retirementStartMonth,
        });
        const annualizationFactor = annualizationFactorForRows(flowRows);
        const outflowBreakdown = sumProjectionOutflows(
          flowRows,
          annualizationFactor
        );
        const flows = annualizeProjectionFlows(
          sumProjectionFlows(flowRows),
          outflowBreakdown,
          annualizationFactor
        );
        return {
          age: p.age,
          value: p.netWorth,
          phase: p.phase,
          ...flows,
          cumulativeGoalsGap: p.cumulativeGoalsGap,
          outflowBreakdown,
          flowMonthsRepresented: flowRows.length,
          flowAnnualizationFactor: annualizationFactor,
          investmentPrincipal: p.investmentPrincipal,
          propertyNet: p.propertyNet,
          investments: p.investmentPrincipal,
          cash: p.cash,
          cpf: p.cpf,
          cpfOa: p.cpfOa,
          cpfSa: p.cpfSa,
          cpfMa: p.cpfMa,
          cpfRa: p.cpfRa,
          cpfCpfis: p.cpfCpfis,
          liabilities: p.liabilities,
          projectedLiabilities: p.projectedLiabilities,
          projectedHousingLiabilities: p.projectedHousingLiabilities,
          projectedNonHousingLiabilities: p.projectedNonHousingLiabilities,
          vehiclesNet: p.vehiclesNet,
        };
      });

    const assetPoints = toAssetPoints(cashflowProjection);
    const cashReserveAssetPoints = toAssetPoints(cashReserveCashflowProjection);

    ageProjection = {
      points: assetPoints,
      cashReservePoints: cashReserveAssetPoints,
      currentAge,
      targetRetirementAge,
      projectedAtRetirement,
      annualBonusTakeHomeNet:
        annualBonusTakeHomeNet > 0 ? annualBonusTakeHomeNet : null,
      annualBonusPayoutMonth: DEFAULT_ANNUAL_BONUS_PAYOUT_MONTH,
      cpfBucketsAtTargetRetirement,
      netWorthByAgeModel: {
        fromInvestmentAccountContributions:
          snapForAgeBase.monthlyContribution,
        fromTakeHomeSurplus: monthlyInvestableSurplus,
        takeHomePerMonth: income,
        monthlyExpensesTotal,
        annualBonusTakeHomeNet:
          annualBonusTakeHomeNet > 0 ? annualBonusTakeHomeNet : null,
      },
      spendCheck,
    };
  }

  const overTop = topOverBudgetCategories(monthlyBudget, 3);
  const monthlyBudgetOver = overTop.map((v) => ({
    categoryLabel: v.categoryLabel,
    spent: v.spent,
    budget: v.budget,
    overBy: v.spent - v.budget,
  }));
  const monthlyBudgetAggregate = monthlyBudgetAggregateOverspend(
    monthlyBudget.totals
  );

  const spendRecommendations = buildSpendRecommendationsForMonth({
    monthlyTakeHome: income,
    monthlyExpensesTotal,
    savingsRate,
    monthlyPlannedGoalContributions: totalPlannedGoalContributionsMonthly,
    budgetAggregate: monthlyBudgetAggregate,
    topOverBudget: monthlyBudgetOver.map((o) => ({
      categoryLabel: o.categoryLabel,
      overBy: o.overBy,
    })),
  });

  const currencyCode = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const housingInsights = buildHousingPaymentInsights(
    housingLoanRows,
    yearMonth,
    currencyCode
  );
  const insights = [...baseInsights, ...housingInsights];

  const takeHomeMinusExpenses =
    income != null ? income - monthlyExpensesTotal : null;
  const discretionaryAfterGoals =
    income != null
      ? income -
        monthlyExpensesTotal -
        totalPlannedGoalContributionsMonthly
      : null;
  const goalBudgetHints = goals
    .filter((g) => num(g.monthly_contribution) > 0)
    .map((g) => ({
      goalId: g.id,
      title: g.title,
      plannedMonthly: num(g.monthly_contribution),
    }));

  return {
    netWorth,
    netWorthExcludingCpf,
    netWorthBreakdown,
    savingsRate,
    monthlyExpensesLoggedTotal,
    monthlyPlannedMonthlyBudgetTotal,
    monthlyExpensesTotal,
    insights,
    spendRecommendations,
    baseCurrency: currencyCode,
    month: yearMonth,
    investmentSummary: {
      totalValue,
      count: investments.length,
    },
    projectionPreview,
    ageProjection,
    cpfProjectionByAge,
    cpfYearEndProjection,
    cpfProjectionMissingInputs,
    cpfHousingMarkers,
    cpfHousingLoanCountInProjection: housingLoanRows.length,
    hasCpfBalanceRecord: !!cpfRow,
    monthlyBudgetTotals: monthlyBudget.totals,
    monthlyBudgetAggregate,
    monthlyBudgetOver,
    takeHomeMinusExpenses,
    totalPlannedGoalContributionsMonthly,
    discretionaryAfterGoals,
    goalBudgetHints,
  };
}
