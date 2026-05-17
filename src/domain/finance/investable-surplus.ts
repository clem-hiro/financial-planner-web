import { addMonthsToYearMonth } from "@/lib/dates";
import { countAnnualBonusPayoutsInHorizon } from "./sg-cpf";
import {
  plannedMonthlyBudgetTotalForMonth,
  type BudgetLineForDomain,
} from "./budget";

/**
 * Sum of monthly investable surplus over `months` steps from `startYearMonth`,
 * respecting budget line start/end (e.g. debt payoff). Used for by-age cash accrual.
 *
 * Optional nominal escalation follows the CPF January cadence verbatim
 * (cpf-monthly-projection.ts): the raise is applied each calendar January
 * strictly after the start month via a repeated `*= (1+g)` (not Math.pow); the
 * start year stays at the base rate. Income and the annual bonus escalate by
 * `incomeGrowthAnnual`; the per-month planned spend (budget lines + extra,
 * including synthetic income tax) by `expenseGrowthAnnual`. Goal contributions
 * stay nominal. `incomeGrowthAnnual === 0 && expenseGrowthAnnual === 0` takes a
 * fast path returning the unescalated computation untouched — that output is
 * the byte-identical regression baseline (no float reassociation through it).
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
  /** Annual income/bonus escalation on the CPF Jan cadence. Default 0 = none. */
  incomeGrowthAnnual?: number;
  /** Annual planned-spend escalation on the CPF Jan cadence. Default 0 = none. */
  expenseGrowthAnnual?: number;
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
    incomeGrowthAnnual = 0,
    expenseGrowthAnnual = 0,
  } = params;

  if (months <= 0 || monthlyIncome <= 0) return 0;

  if (incomeGrowthAnnual === 0 && expenseGrowthAnnual === 0) {
    // Unescalated [Debts] baseline — byte-identical regression anchor.
    // Do not refactor: float reassociation would break the exact guard.
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

  // CPF January cadence: raise on each calendar January strictly after the
  // start month, repeated `*= (1+g)`, start year at base rate. The bonus moves
  // into the loop so each payout escalates at its own year index.
  const payout = Math.max(
    1,
    Math.min(12, Math.trunc(annualBonusPayoutMonth))
  );
  let incomeMul = 1;
  let expenseMul = 1;
  let total = 0;
  for (let i = 0; i < months; i++) {
    const ym = addMonthsToYearMonth(startYearMonth, i);
    if (ym.endsWith("-01") && ym > startYearMonth) {
      incomeMul *= 1 + incomeGrowthAnnual;
      expenseMul *= 1 + expenseGrowthAnnual;
    }
    const planned =
      (plannedMonthlyBudgetTotalForMonth(
        domainBudgetLines,
        ym,
        amountOverrideByLineId
      ) +
        extraMonthlyPlannedSpend) *
      expenseMul;
    total += Math.max(
      0,
      monthlyIncome * incomeMul - planned - monthlyGoalContributions
    );
    if (annualBonusTakeHomeNet > 0 && Number(ym.slice(5, 7)) === payout) {
      total += annualBonusTakeHomeNet * incomeMul;
    }
  }

  return total;
}
