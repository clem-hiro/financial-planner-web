/**
 * Singapore resident progressive income tax — YA 2024+ rates (in force YA 2025 + YA 2026).
 * Source: IRAS resident tax rates page.
 *
 * This module is pure: typed inputs, typed outputs, no I/O. The CPF auto-relief
 * is computed externally via `annualEmployeeCpfTakeHomeWithBonusSg` and passed
 * into `computeAnnualTax` as `cpfReliefSgd` — keeps this module decoupled from
 * the CPF rate tables.
 */

export type IncomeTaxBracket = {
  /** Inclusive lower bound (SGD). */
  lowerSgd: number;
  /** Inclusive upper bound (SGD), or `null` for the open-ended top bracket. */
  upperSgd: number | null;
  /** Marginal rate within this bracket (0..1). */
  rate: number;
  /** Tax owed when chargeable income reaches this bracket's lower bound. */
  cumulativeTaxAtLowerSgd: number;
};

export const INCOME_TAX_YA_2026: ReadonlyArray<IncomeTaxBracket> = [
  { lowerSgd: 0, upperSgd: 20_000, rate: 0, cumulativeTaxAtLowerSgd: 0 },
  { lowerSgd: 20_000, upperSgd: 30_000, rate: 0.02, cumulativeTaxAtLowerSgd: 0 },
  { lowerSgd: 30_000, upperSgd: 40_000, rate: 0.035, cumulativeTaxAtLowerSgd: 200 },
  { lowerSgd: 40_000, upperSgd: 80_000, rate: 0.07, cumulativeTaxAtLowerSgd: 550 },
  { lowerSgd: 80_000, upperSgd: 120_000, rate: 0.115, cumulativeTaxAtLowerSgd: 3_350 },
  { lowerSgd: 120_000, upperSgd: 160_000, rate: 0.15, cumulativeTaxAtLowerSgd: 7_950 },
  { lowerSgd: 160_000, upperSgd: 200_000, rate: 0.18, cumulativeTaxAtLowerSgd: 13_950 },
  { lowerSgd: 200_000, upperSgd: 240_000, rate: 0.19, cumulativeTaxAtLowerSgd: 21_150 },
  { lowerSgd: 240_000, upperSgd: 280_000, rate: 0.195, cumulativeTaxAtLowerSgd: 28_750 },
  { lowerSgd: 280_000, upperSgd: 320_000, rate: 0.20, cumulativeTaxAtLowerSgd: 36_550 },
  { lowerSgd: 320_000, upperSgd: 500_000, rate: 0.22, cumulativeTaxAtLowerSgd: 44_550 },
  { lowerSgd: 500_000, upperSgd: 1_000_000, rate: 0.23, cumulativeTaxAtLowerSgd: 84_150 },
  { lowerSgd: 1_000_000, upperSgd: null, rate: 0.24, cumulativeTaxAtLowerSgd: 199_150 },
] as const;

export const TOTAL_RELIEF_CAP_SGD = 80_000;

export const EARNED_INCOME_RELIEF_BY_AGE = {
  under55: 1_000,
  age55to59: 6_000,
  age60Plus: 8_000,
} as const;

/** IRAS typed-relief bundle (one field per category). All amounts in SGD. */
export type IncomeTaxReliefBundle = {
  spouseReliefSgd: number;
  qualifyingChildReliefSgd: number;
  handicappedChildReliefSgd: number;
  workingMotherChildReliefSgd: number;
  parentReliefSgd: number;
  grandparentCaregiverReliefSgd: number;
  handicappedSiblingReliefSgd: number;
  cpfCashTopupSelfSgd: number;
  cpfCashTopupFamilySgd: number;
  srsContributionSgd: number;
  nsmanSelfReliefSgd: number;
  nsmanWifeReliefSgd: number;
  nsmanParentReliefSgd: number;
  courseFeesReliefSgd: number;
  lifeInsuranceReliefSgd: number;
  cpfMedisaveVoluntarySgd: number;
  otherReliefsAmountSgd: number;
};

export type IncomeTaxComputeInput = {
  annualIncomeSgd: number;
  age: number;
  /** Mandatory employee CPF — pass result from `annualEmployeeCpfTakeHomeWithBonusSg`. */
  cpfReliefSgd: number;
  reliefs: IncomeTaxReliefBundle;
  /** Opt-in rebate (e.g. YA 2026 = 60%). `null` means no rebate. */
  rebatePercent: number | null;
  /** Opt-in rebate cap. Must be `null` iff `rebatePercent` is `null`. */
  rebateCapSgd: number | null;
};

export type ChargeableIncomeBreakdown = {
  totalReliefBeforeCap: number;
  totalReliefAfterCap: number;
  reliefCapApplied: boolean;
  chargeableIncome: number;
};

export type RebateBreakdown = {
  rebateApplied: number;
  netTax: number;
};

export type IncomeTaxComputeBreakdown = {
  annualIncomeSgd: number;
  earnedIncomeReliefSgd: number;
  cpfReliefSgd: number;
  typedReliefsSgd: number;
  totalReliefBeforeCapSgd: number;
  totalReliefAfterCapSgd: number;
  reliefCapApplied: boolean;
  chargeableIncomeSgd: number;
  grossTaxSgd: number;
  rebateAppliedSgd: number;
  netTaxSgd: number;
  monthlyGiroSgd: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function earnedIncomeReliefForAge(age: number): number {
  if (age >= 60) return EARNED_INCOME_RELIEF_BY_AGE.age60Plus;
  if (age >= 55) return EARNED_INCOME_RELIEF_BY_AGE.age55to59;
  return EARNED_INCOME_RELIEF_BY_AGE.under55;
}

export function chargeableIncomeFromReliefs(input: {
  annualIncomeSgd: number;
  totalReliefsSgd: number;
}): ChargeableIncomeBreakdown {
  const before = Math.max(0, input.totalReliefsSgd);
  const after = Math.min(before, TOTAL_RELIEF_CAP_SGD);
  const reliefCapApplied = before > TOTAL_RELIEF_CAP_SGD;
  const chargeable = Math.max(0, input.annualIncomeSgd - after);
  return {
    totalReliefBeforeCap: before,
    totalReliefAfterCap: after,
    reliefCapApplied,
    chargeableIncome: chargeable,
  };
}

export function grossTaxForChargeableIncome(
  chargeable: number,
  brackets: ReadonlyArray<IncomeTaxBracket> = INCOME_TAX_YA_2026
): number {
  if (!Number.isFinite(chargeable) || chargeable <= 0) return 0;
  for (const bracket of brackets) {
    const insideUpper = bracket.upperSgd == null || chargeable <= bracket.upperSgd;
    if (chargeable >= bracket.lowerSgd && insideUpper) {
      return roundMoney(
        bracket.cumulativeTaxAtLowerSgd +
          (chargeable - bracket.lowerSgd) * bracket.rate
      );
    }
  }
  return 0;
}

export function applyRebate(
  grossTax: number,
  percent: number | null,
  capSgd: number | null
): RebateBreakdown {
  if (grossTax <= 0 || percent == null || capSgd == null) {
    return { rebateApplied: 0, netTax: Math.max(0, grossTax) };
  }
  const raw = grossTax * (percent / 100);
  const rebateApplied = Math.min(Math.max(0, raw), Math.max(0, capSgd));
  return {
    rebateApplied: roundMoney(rebateApplied),
    netTax: roundMoney(grossTax - rebateApplied),
  };
}

export function monthlyGiroFromNetTax(netTax: number): number {
  if (!Number.isFinite(netTax) || netTax <= 0) return 0;
  return roundMoney(netTax / 12);
}

function sumReliefBundle(b: IncomeTaxReliefBundle): number {
  return (
    b.spouseReliefSgd +
    b.qualifyingChildReliefSgd +
    b.handicappedChildReliefSgd +
    b.workingMotherChildReliefSgd +
    b.parentReliefSgd +
    b.grandparentCaregiverReliefSgd +
    b.handicappedSiblingReliefSgd +
    b.cpfCashTopupSelfSgd +
    b.cpfCashTopupFamilySgd +
    b.srsContributionSgd +
    b.nsmanSelfReliefSgd +
    b.nsmanWifeReliefSgd +
    b.nsmanParentReliefSgd +
    b.courseFeesReliefSgd +
    b.lifeInsuranceReliefSgd +
    b.cpfMedisaveVoluntarySgd +
    b.otherReliefsAmountSgd
  );
}

export function computeAnnualTax(
  input: IncomeTaxComputeInput
): IncomeTaxComputeBreakdown {
  const earnedIncomeReliefSgd = earnedIncomeReliefForAge(input.age);
  const cpfReliefSgd = Math.max(0, input.cpfReliefSgd);
  const typedReliefsSgd = Math.max(0, sumReliefBundle(input.reliefs));
  const totalReliefsSgd = earnedIncomeReliefSgd + cpfReliefSgd + typedReliefsSgd;

  const chargeable = chargeableIncomeFromReliefs({
    annualIncomeSgd: input.annualIncomeSgd,
    totalReliefsSgd,
  });
  const grossTax = grossTaxForChargeableIncome(chargeable.chargeableIncome);
  const rebate = applyRebate(grossTax, input.rebatePercent, input.rebateCapSgd);

  return {
    annualIncomeSgd: input.annualIncomeSgd,
    earnedIncomeReliefSgd,
    cpfReliefSgd,
    typedReliefsSgd,
    totalReliefBeforeCapSgd: chargeable.totalReliefBeforeCap,
    totalReliefAfterCapSgd: chargeable.totalReliefAfterCap,
    reliefCapApplied: chargeable.reliefCapApplied,
    chargeableIncomeSgd: chargeable.chargeableIncome,
    grossTaxSgd: roundMoney(grossTax),
    rebateAppliedSgd: rebate.rebateApplied,
    netTaxSgd: rebate.netTax,
    monthlyGiroSgd: monthlyGiroFromNetTax(rebate.netTax),
  };
}
