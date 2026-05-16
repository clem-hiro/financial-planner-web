import { countAnnualBonusPayoutsInHorizon } from "./sg-cpf";

export interface AccrueTakeHomeSurplusInput {
  /** Accrual window in months (callers pass a non-negative multiple of 12). */
  months: number;
  /** Monthly take-home income; `null` ⇒ zero surplus (no income basis). */
  monthlyIncome: number | null;
  monthlyExpenses: number;
  monthlyGoalContrib: number;
  /** Net (post-tax/CPF) annual bonus cash; ≤0 ⇒ no bonus accrued. */
  annualBonusNet: number;
  /** Calendar month (1–12) the bonus is paid. */
  bonusPayoutMonth: number;
  /** Horizon start as `YYYY-MM`. */
  startYearMonth: string;
  /** Annual income/bonus escalation. Default 0 = no escalation. */
  incomeGrowthAnnual?: number;
  /** Annual expense escalation. Default 0 = no escalation. */
  expenseGrowthAnnual?: number;
}

/**
 * Take-home cash accrued over `months`: monthly surplus (income minus spend
 * basis and planned goal contributions, floored at 0) plus the net annual
 * bonus on each payout month within the horizon. `monthlyIncome == null` ⇒
 * zero surplus (mirrors dashboard null/floor semantics); bonus still counted.
 *
 * Single source of truth for both the scalar `projectedAtRetirement` accrual
 * and the per-age chart accrual — the chart caps `months` at retirement so it
 * cannot grow past it.
 *
 * Escalation (gI on income+bonus, gE on expenses) follows the CPF January
 * cadence verbatim (cpf-monthly-projection.ts: raise applied each calendar
 * January strictly after the start month; the start year uses the base rate),
 * so this curve and the chart's CPF curve never diverge. Goal contributions
 * are nominal (not escalated).
 *
 * gE=0 ∧ gI=0 takes the flat fast path — byte-identical to the pre-escalation
 * behaviour. Chart ages step in whole years so `months` is a multiple of 12;
 * that exactness is the growth=0 regression guard. The `=== 0` short-circuit
 * keeps it exact (no float reassociation through the year loop).
 */
export function accrueTakeHomeSurplus(
  input: AccrueTakeHomeSurplusInput
): number {
  const {
    months,
    monthlyIncome,
    monthlyExpenses,
    monthlyGoalContrib,
    annualBonusNet,
    bonusPayoutMonth,
    startYearMonth,
    incomeGrowthAnnual = 0,
    expenseGrowthAnnual = 0,
  } = input;

  const hasBonus = annualBonusNet > 0;
  const noEscalation = incomeGrowthAnnual === 0 && expenseGrowthAnnual === 0;
  const validStart = /^\d{4}-\d{2}$/.test(startYearMonth);

  if (noEscalation || !validStart) {
    const surplus =
      monthlyIncome == null
        ? 0
        : Math.max(0, monthlyIncome - monthlyExpenses - monthlyGoalContrib);
    const bonus = hasBonus
      ? annualBonusNet *
        countAnnualBonusPayoutsInHorizon(
          startYearMonth,
          months,
          bonusPayoutMonth
        )
      : 0;
    return surplus * months + bonus;
  }

  const startMonth = Number(startYearMonth.slice(5, 7)); // 1–12
  const payout = Math.max(1, Math.min(12, Math.trunc(bonusPayoutMonth)));
  // Mirror CPF's repeated `*= 1+growth` (not Math.pow) so both curves drift
  // identically in the last ULP.
  let incomeMul = 1;
  let expenseMul = 1;
  let total = 0;
  for (let i = 0; i < months; i++) {
    const calMonth = ((startMonth - 1 + i) % 12) + 1;
    if (calMonth === 1 && i > 0) {
      incomeMul *= 1 + incomeGrowthAnnual;
      expenseMul *= 1 + expenseGrowthAnnual;
    }
    if (monthlyIncome != null) {
      total += Math.max(
        0,
        monthlyIncome * incomeMul -
          monthlyExpenses * expenseMul -
          monthlyGoalContrib
      );
    }
    if (hasBonus && calMonth === payout) {
      total += annualBonusNet * incomeMul;
    }
  }
  return total;
}
