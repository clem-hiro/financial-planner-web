import { incomeTaxConfigRowToDomain, num } from "@/data/mappers";
import type { IncomeTaxConfigRow, ProfileRow } from "@/data/supabase/types";
import { ageCompletedOnDate } from "@/domain/finance/age-projection";
import type { ExpenseForBudget } from "@/domain/finance/budget";
import { isSgCpfAgeBand, annualEmployeeCpfTakeHomeWithBonusSg } from "@/domain/finance/sg-cpf";
import {
  computeAnnualTax,
  type IncomeTaxComputeBreakdown,
} from "@/domain/finance/sg-income-tax";

export type SyntheticTaxExpense = {
  expense: ExpenseForBudget;
  breakdown: IncomeTaxComputeBreakdown;
};

/**
 * Builds the synthetic budget line that represents income tax cash outflow.
 *
 * Returns `null` when the inputs needed to compute tax are absent:
 *   - no stored config (user never visited the tax tab)
 *   - missing `monthly_gross_salary` or `birth_date` or `cpf_age_band`
 *
 * Callers (dashboard, budget summary) treat `null` as "skip" — the user simply
 * doesn't see a tax line until they fill in the prerequisites.
 *
 * `payment_method` controls the spend period:
 *   - `monthly_giro` → 12 equal monthly instalments (uses `monthlyGiroSgd`)
 *   - `one_time`     → single annual outflow (uses `netTaxSgd`)
 */
export function buildSyntheticTaxExpense(
  config: IncomeTaxConfigRow | null,
  profile: ProfileRow | null,
  referenceYearMonth: string
): SyntheticTaxExpense | null {
  if (!config || !profile) return null;
  if (!profile.birth_date) return null;
  if (!/^\d{4}-\d{2}$/.test(referenceYearMonth)) return null;

  const grossMonthly = profile.monthly_gross_salary
    ? num(profile.monthly_gross_salary)
    : 0;
  if (grossMonthly <= 0) return null;

  const ageBandRaw = profile.cpf_age_band;
  if (!ageBandRaw || !isSgCpfAgeBand(ageBandRaw)) return null;

  const age = ageCompletedOnDate(profile.birth_date, new Date());
  if (!Number.isFinite(age) || age < 0) return null;

  const annualBonus = profile.annual_bonus ? num(profile.annual_bonus) : 0;
  const annualIncomeSgd = grossMonthly * 12 + annualBonus;

  const cpfRelief = annualEmployeeCpfTakeHomeWithBonusSg(
    grossMonthly,
    annualBonus,
    referenceYearMonth,
    ageBandRaw
  ).employeeCpfContributionAnnual;

  const domain = incomeTaxConfigRowToDomain(config);
  const breakdown = computeAnnualTax({
    annualIncomeSgd,
    age,
    cpfReliefSgd: cpfRelief,
    reliefs: domain.reliefs,
    rebatePercent: domain.rebatePercent,
    rebateCapSgd: domain.rebateCapSgd,
  });

  if (breakdown.netTaxSgd <= 0) return null;

  const expense: ExpenseForBudget =
    domain.paymentMethod === "monthly_giro"
      ? {
          category: "Income tax (GIRO)",
          amount: breakdown.monthlyGiroSgd,
          spendPeriod: "monthly",
        }
      : {
          category: "Income tax (one-time)",
          amount: breakdown.netTaxSgd,
          spendPeriod: "annual",
        };

  return { expense, breakdown };
}
