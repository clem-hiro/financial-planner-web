import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageCompletedOnDate,
  analyzeRetirementDividendVsSpend,
  analyzeRetirementSpendVsPortfolio,
  buildCpfMonthlyProjectionSeries,
  buildDashboardInsights,
  buildNetWorthByAgeProjection,
  buildSpendRecommendationsForMonth,
  calculateNetWorth,
  calculateSavingsRate,
  DEFAULT_RETIREMENT_DIVIDEND_YIELD_ANNUAL,
  cumulativeVehicleProceedsToCash,
  effectiveLoanBalance,
  futureValueInvestmentPortfolioAtMonth,
  monthlyBudgetAggregateOverspend,
  monthlyBudgetVsActual,
  topOverBudgetCategories,
  vehicleGrossAssetEstimate,
  vehicleNetListedBeforeLiquidation,
} from "@/domain/finance";
import type { HousingLoanProjectionInput } from "@/domain/finance";
import type { SgCpfAgeBand } from "@/domain/finance/sg-cpf";
import type { RetirementDividendVsSpendResult } from "@/domain/finance";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { addCalendarMonths } from "@/lib/dates";
import {
  budgetLineRowToDomain,
  expenseRowToBudgetExpense,
  investmentValues,
  num,
  profileAnnualBonus,
  profileAnnualSalaryGrowthNominal,
  profileMonthlyGross,
  profileMonthlyIncome,
  profileRetirementWithdrawalRateAnnual,
  profileCpfAgeBand,
  sumExpenseAmounts,
  sumPlannedMonthlyGoalContributions,
  vehicleRowToValuationInput,
} from "@/data/mappers";
import {
  listBudgetLineOverridesForMonth,
  overridesToLineIdMap,
} from "@/data/repositories/budget-line-overrides";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { listCashAccounts } from "@/data/repositories/cash-accounts";
import { getCpfBalanceByUserId } from "@/data/repositories/cpf-balances";
import { listFinancialGoals } from "@/data/repositories/goals";
import { listHousingLoans } from "@/data/repositories/housing-loans";
import { listLiabilities } from "@/data/repositories/liabilities";
import { listVehicles } from "@/data/repositories/vehicles";
import { getProfileById } from "@/data/repositories/profiles";
import { listExpensesForMonth } from "@/data/repositories/expenses";
import { listInvestments } from "@/data/repositories/investments";
import type { HousingLoanRow } from "@/data/supabase/types";
import {
  buildInvestmentProjectionSeries,
  projectionSnapshotFromInvestmentRows,
} from "@/data/projection";
import type { ProjectionSeriesPoint } from "@/data/projection";
import { birthDateIsValidPast } from "@/lib/validation";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";

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
    net: number;
  };
  /**
   * CPF buckets at each projected age, aligned to `ageProjection.points`.
   * Null when birth date is missing/invalid or CPF balances are not saved.
   */
  cpfProjectionByAge: Array<{
    age: number;
    oa: number;
    sa: number;
    ma: number;
    cpfis: number;
    totalCpf: number;
  }> | null;
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
   * Spend used for savings rate, discretionary math, and by-age cash accrual:
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
   * Simplified net worth by age (investments compound; cash grows by monthly surplus;
   * debt held flat).
   * Null when birth date is not set or invalid.
   */
  ageProjection: {
    points: AgeAssetBreakdownPoint[];
    currentAge: number;
    targetRetirementAge: number;
    projectedAtRetirement: number;
    /**
     * CPF notionals at the age used for the headline retirement path (target
     * age, or today’s age when you are already at/past target). Null without CPF data.
     */
    cpfBucketsAtTargetRetirement: {
      age: number;
      oa: number;
      sa: number;
      ma: number;
      cpfis: number;
      totalCpf: number;
    } | null;
    /** Monthly flows for transparency; only account contributions compound in FV. */
    netWorthByAgeModel: {
      fromInvestmentAccountContributions: number;
      /**
       * Take-home minus expenses minus sum of planned monthly goal contributions
       * (dashboard month); floored at 0. Accrues into projected cash, not investment FV.
       */
      fromTakeHomeSurplus: number;
      takeHomePerMonth: number | null;
      /** Same basis as dashboard `monthlyExpensesTotal` (logged when present, else planned). */
      monthlyExpensesTotal: number;
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
  return {
    completionMonth: row.completion_month,
    firstPaymentMonth: row.first_payment_month,
    downpaymentFromOa: num(row.downpayment_from_oa),
    feesFromOa: num(row.fees_from_oa),
    principal: num(row.principal),
    annualNominalRate: num(row.annual_nominal_rate),
    termMonths: row.term_months,
    oaShareOfPayment: num(row.oa_share_of_payment),
    maxOaPerMonth:
      row.max_oa_per_month != null &&
      String(row.max_oa_per_month).trim() !== ""
        ? num(row.max_oa_per_month)
        : null,
  };
}

function ageAtEndOfYearMonth(birthYmd: string, yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const asOf = new Date(y, m, 0, 12, 0, 0, 0);
  return ageCompletedOnDate(birthYmd, asOf);
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
  yearMonth: string
): Promise<DashboardPayload> {
  const [
    profile,
    expenses,
    investments,
    cashAccounts,
    liabilityRows,
    budgetLineRows,
    overrideRows,
    goals,
    cpfRow,
    housingLoanRows,
    vehicleRows,
  ] = await Promise.all([
    getProfileById(supabase, userId),
    listExpensesForMonth(supabase, userId, yearMonth),
    listInvestments(supabase, userId),
    listCashAccounts(supabase, userId),
    listLiabilities(supabase, userId),
    listBudgetLines(supabase, userId),
    listBudgetLineOverridesForMonth(supabase, userId, yearMonth),
    listFinancialGoals(supabase, userId),
    getCpfBalanceByUserId(supabase, userId),
    listHousingLoans(supabase, userId),
    listVehicles(supabase, userId),
  ]);

  const amountOverrideByLineId = overridesToLineIdMap(overrideRows);
  const domainBudgetLines = budgetLineRows.map(budgetLineRowToDomain);
  const budgetExpenses = expenses.map(expenseRowToBudgetExpense);
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

  const income = profileMonthlyIncome(profile);
  const totalPlannedGoalContributionsMonthly =
    sumPlannedMonthlyGoalContributions(goals);
  /**
   * Cash left after spend basis (logged when any expense in the month, else planned
   * monthly budget) and planned goal contributions (floored at 0).
   * Accrues into projected cash on the by-age chart, not into investment FV.
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
  const netWorth =
    baseNetWorth + vehiclesNetEquityTotal + vehicleProceedsCashNow;
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
    const cashMinusLiab = cashTotal - liabilitiesTotal;
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
    const invAtRet = futureValueInvestmentPortfolioAtMonth(
      investments,
      monthsToRet,
      monthsToRetirementHorizon
    );
    const asOfRetirement = addCalendarMonths(dashboardAsOf, monthsToRet);
    const vehicleSaleCashAtRet = cumulativeVehicleProceedsToCash(
      vehicleValuationInputs,
      asOfRetirement
    );
    const vehiclesNetAtRet = vehicleValuationInputs
      .filter((v) => v.vehicleStatus === "active")
      .reduce(
        (s, vi) => s + vehicleNetListedBeforeLiquidation(vi, asOfRetirement),
        0
      );
    const surplusAccrualToRet = monthlyInvestableSurplus * monthsToRet;
    const cashAtRetirementHorizon =
      cashTotal + vehicleSaleCashAtRet + surplusAccrualToRet;
    let projectedAtRetirement =
      invAtRet +
      cashAtRetirementHorizon -
      liabilitiesTotal +
      vehiclesNetAtRet;

    if (cpfRow) {
      const maxAgeOnAxis = Math.max(...nwAgePoints.map((p) => p.age));
      const horizonMonths = Math.max(
        1,
        (maxAgeOnAxis - currentAge) * 12 + 1
      );
      const grossMonthly = profileMonthlyGross(profile) ?? 0;
      const bandStr = profileCpfAgeBand(profile);
      const fixedBand: SgCpfAgeBand | undefined =
        bandStr === "below_55" ||
        bandStr === "above_55_to_60" ||
        bandStr === "above_60_to_65" ||
        bandStr === "above_65_to_70" ||
        bandStr === "above_70"
          ? bandStr
          : undefined;
      const monthlySeries = buildCpfMonthlyProjectionSeries({
        startYearMonth: yearMonth,
        horizonMonths,
        birthDate: birthRaw,
        fixedCpfAgeBand: fixedBand,
        grossMonthly,
        annualBonus: profileAnnualBonus(profile),
        annualSalaryGrowthNominal: profileAnnualSalaryGrowthNominal(profile),
        initial: {
          oa: num(cpfRow.oa),
          sa: num(cpfRow.sa),
          ma: num(cpfRow.ma),
          oaAnnualRate:
            cpfRow.oa_annual_rate != null &&
            String(cpfRow.oa_annual_rate).trim() !== ""
              ? num(cpfRow.oa_annual_rate)
              : undefined,
          saAnnualRate:
            cpfRow.sa_annual_rate != null &&
            String(cpfRow.sa_annual_rate).trim() !== ""
              ? num(cpfRow.sa_annual_rate)
              : undefined,
          maAnnualRate:
            cpfRow.ma_annual_rate != null &&
            String(cpfRow.ma_annual_rate).trim() !== ""
              ? num(cpfRow.ma_annual_rate)
              : undefined,
          cpfisMonthlyFromOa: num(cpfRow.cpfis_monthly_from_oa),
          cpfisNotionalBalance: num(cpfRow.cpfis_notional_balance),
          cpfisAnnualReturn: num(cpfRow.cpfis_annual_return),
        },
        housingLoans: housingLoanRows.map(housingLoanToProjection),
      });
      cpfProjectionByAge = nwAgePoints.map((p) => {
        const idx = Math.min(
          Math.max(0, (p.age - currentAge) * 12),
          monthlySeries.length - 1
        );
        const row = monthlySeries[idx];
        return {
          age: p.age,
          oa: row?.oa ?? 0,
          sa: row?.sa ?? 0,
          ma: row?.ma ?? 0,
          cpfis: row?.cpfis ?? 0,
          totalCpf: row?.totalCpf ?? 0,
        };
      });
      cpfHousingMarkers = buildCpfHousingMarkers(birthRaw, housingLoanRows);
      const retIdx = Math.min(monthsToRet, monthlySeries.length - 1);
      const cpfAtRetirement = monthlySeries[retIdx]?.totalCpf ?? 0;
      projectedAtRetirement =
        invAtRet +
        cashAtRetirementHorizon -
        liabilitiesTotal +
        cpfAtRetirement +
        vehiclesNetAtRet;
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
    const dividendPlan = analyzeRetirementDividendVsSpend({
      projectedInvestmentsAtRetirement: invAtRet,
      goalMonthlySpend:
        goalMonthlySpend != null && goalMonthlySpend > 0
          ? goalMonthlySpend
          : null,
      annualDividendYield: dividendYieldAnnual,
      currentCashTotal: cashTotal,
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
      }),
    };
    const assetPoints: AgeAssetBreakdownPoint[] = nwAgePoints.map((p, i) => {
      const asOfHorizon = addCalendarMonths(dashboardAsOf, p.monthsFromToday);
      const vehicleSaleCashHorizon = cumulativeVehicleProceedsToCash(
        vehicleValuationInputs,
        asOfHorizon
      );
      const vehiclesNetHorizon = vehicleValuationInputs
        .filter((v) => v.vehicleStatus === "active")
        .reduce(
          (s, vi) => s + vehicleNetListedBeforeLiquidation(vi, asOfHorizon),
          0
        );
      const surplusAccrualHorizon =
        monthlyInvestableSurplus * p.monthsFromToday;
      const cashRow =
        cashTotal +
        vehicleSaleCashHorizon +
        surplusAccrualHorizon;
      const investments = p.value - cashMinusLiab;
      const cpfRowAge = cpfProjectionByAge?.[i];
      const cpfAmt = cpfRowAge?.totalCpf ?? 0;
      const net =
        investments +
        cashRow +
        cpfAmt +
        vehiclesNetHorizon -
        liabilitiesTotal;
      return {
        age: p.age,
        value: net,
        investments,
        cash: cashRow,
        cpf: cpfAmt,
        cpfOa: cpfRowAge?.oa ?? 0,
        cpfSa: cpfRowAge?.sa ?? 0,
        cpfMa: cpfRowAge?.ma ?? 0,
        cpfCpfis: cpfRowAge?.cpfis ?? 0,
        liabilities: liabilitiesTotal,
        vehiclesNet: vehiclesNetHorizon,
      };
    });

    ageProjection = {
      points: assetPoints,
      currentAge,
      targetRetirementAge,
      projectedAtRetirement,
      cpfBucketsAtTargetRetirement,
      netWorthByAgeModel: {
        fromInvestmentAccountContributions:
          snapForAgeBase.monthlyContribution,
        fromTakeHomeSurplus: monthlyInvestableSurplus,
        takeHomePerMonth: income,
        monthlyExpensesTotal,
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
  const insights = [...baseInsights];

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
