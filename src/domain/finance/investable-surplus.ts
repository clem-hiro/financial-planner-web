import { addMonthsToYearMonth } from "@/lib/dates";
import { countAnnualBonusPayoutsInHorizon } from "./sg-cpf";
import {
  plannedMonthlyBudgetTotalForMonth,
  type BudgetLineForDomain,
} from "./budget";

/**
 * Sum of monthly investable surplus over `months` steps from `startYearMonth`,
 * respecting budget line start/end (e.g. debt payoff). Used for by-age cash accrual.
 */
export function sumInvestableSurplusOverHorizon(params: {
  startYearMonth: string;
  months: number;
  monthlyIncome: number;
  domainBudgetLines: BudgetLineForDomain[];
  amountOverrideByLineId?: Record<string, number>;
  monthlyGoalContributions: number;
  annualBonusTakeHomeNet?: number;
  annualBonusPayoutMonth?: number;
  /** Fixed extra planned spend each month (e.g. income-tax GIRO). */
  extraMonthlyPlannedSpend?: number;
}): number {
  const {
    startYearMonth,
    months,
    monthlyIncome,
    domainBudgetLines,
    amountOverrideByLineId,
    monthlyGoalContributions,
    annualBonusTakeHomeNet = 0,
    annualBonusPayoutMonth = 12,
    extraMonthlyPlannedSpend = 0,
  } = params;

  if (months <= 0 || monthlyIncome <= 0) return 0;

  let total = 0;
  for (let i = 0; i < months; i++) {
    const ym = addMonthsToYearMonth(startYearMonth, i);
    const planned =
      plannedMonthlyBudgetTotalForMonth(
        domainBudgetLines,
        ym,
        amountOverrideByLineId
      ) + extraMonthlyPlannedSpend;
    total += Math.max(
      0,
      monthlyIncome - planned - monthlyGoalContributions
    );
  }

  if (annualBonusTakeHomeNet > 0) {
    total +=
      annualBonusTakeHomeNet *
      countAnnualBonusPayoutsInHorizon(
        startYearMonth,
        months,
        annualBonusPayoutMonth
      );
  }

  return total;
}
