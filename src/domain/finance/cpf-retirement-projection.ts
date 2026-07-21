/**
 * Illustrative CPF retirement-sum and RA-formation modelling at age 55.
 * Not actuarial CPF LIFE; constants are configurable for policy drift.
 */

export const CPF_RA_FORMATION_AGE = 55 as const;
export const DEFAULT_CPF_LIFE_START_AGE = 65 as const;

/** Cohort year the baseline FRS applies to (members turning 55 that calendar year). */
export const CPF_FRS_BASE_COHORT_YEAR = 2026 as const;

/** Published Full Retirement Sum for members turning 55 in {@link CPF_FRS_BASE_COHORT_YEAR}. */
export const CURRENT_FRS_SG = 220_400 as const;

export const DEFAULT_FRS_ANNUAL_GROWTH_RATE = 0.035 as const;
export const DEFAULT_BRS_FRACTION_OF_FRS = 0.5 as const;
export const DEFAULT_ERS_MULTIPLIER_OF_FRS = 2 as const;

/** Illustrative annual CPF LIFE payout as a fraction of RA balance at payout start. */
export const DEFAULT_CPF_LIFE_PAYOUT_RATE_ANNUAL = 0.04 as const;

export type CpfRetirementTarget = "brs" | "frs" | "ers";

export type CpfAssumptions = {
  frsAnnualGrowthRate: number;
  retirementTarget: CpfRetirementTarget;
  /** When set, skips growth projection and uses this as the age-55 target sum. */
  manualProjectedFrsOverride: number | null;
  cpfLifePayoutRateAnnual: number;
  cpfLifeStartAge: number;
};

export const DEFAULT_CPF_ASSUMPTIONS: CpfAssumptions = {
  frsAnnualGrowthRate: DEFAULT_FRS_ANNUAL_GROWTH_RATE,
  retirementTarget: "frs",
  manualProjectedFrsOverride: null,
  cpfLifePayoutRateAnnual: DEFAULT_CPF_LIFE_PAYOUT_RATE_ANNUAL,
  cpfLifeStartAge: DEFAULT_CPF_LIFE_START_AGE,
};

export type CpfRetirementProjection = {
  yearsToAge55: number;
  currentFrsBaseline: number;
  estimatedFrsAt55: number;
  estimatedBrsAt55: number;
  estimatedErsAt55: number;
  requiredTargetAt55: number;
  cpfLifeMonthlyPayoutLow: number;
  cpfLifeMonthlyPayoutHigh: number;
};

export type CpfRaSimulation = {
  beforeAge55: { oa: number; sa: number };
  requiredTarget: number;
  transferFromSa: number;
  transferFromOa: number;
  /** Remaining SA after RA set-aside — moved to OA because SA closes at 55. */
  transferExcessSaToOa: number;
  afterRaCreation: { ra: number; remainingOa: number; remainingSa: number };
  fullyFunded: boolean;
  shortfall: number;
};

export type CpfSaInvestmentMaturityRouting = {
  toSa: number;
  toRa: number;
  toOa: number;
  raShortfallAfterRouting: number;
};

export type CpfScenarioExample = {
  id: "high_sa" | "mostly_oa" | "below_frs";
  label: string;
  description: string;
  beforeAge55: { oa: number; sa: number };
};

export const CPF_SCENARIO_EXAMPLES: readonly CpfScenarioExample[] = [
  {
    id: "high_sa",
    label: "High SA savings",
    description: "Most of your CPF is already in SA — less OA is needed to top up RA.",
    beforeAge55: { oa: 120_000, sa: 280_000 },
  },
  {
    id: "mostly_oa",
    label: "Mostly OA savings",
    description: "A larger share comes from OA because SA alone is not enough.",
    beforeAge55: { oa: 450_000, sa: 50_000 },
  },
  {
    id: "below_frs",
    label: "Below required FRS",
    description: "Total CPF is less than the target — RA takes everything available.",
    beforeAge55: { oa: 80_000, sa: 40_000 },
  },
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function yearsUntilAge(
  currentAge: number,
  targetAge: number = CPF_RA_FORMATION_AGE
): number {
  if (!Number.isFinite(currentAge)) return 0;
  return Math.max(0, Math.round(targetAge - currentAge));
}

/**
 * futureFRS = currentFRS × (1 + growthRate)^yearsTo55
 */
export function estimateFutureFrs(
  currentFrs: number,
  growthRate: number,
  yearsTo55: number
): number {
  const base = Math.max(0, currentFrs);
  const rate = Math.max(-0.5, Math.min(0.2, growthRate));
  const years = Math.max(0, yearsTo55);
  if (years === 0) return round2(base);
  return round2(base * (1 + rate) ** years);
}

export function brsFromFrs(frs: number): number {
  return round2(Math.max(0, frs) * DEFAULT_BRS_FRACTION_OF_FRS);
}

export function ersFromFrs(frs: number): number {
  return round2(Math.max(0, frs) * DEFAULT_ERS_MULTIPLIER_OF_FRS);
}

export function retirementTargetAmount(
  estimatedFrsAt55: number,
  target: CpfRetirementTarget
): number {
  const frs = Math.max(0, estimatedFrsAt55);
  if (target === "brs") return brsFromFrs(frs);
  if (target === "ers") return ersFromFrs(frs);
  return round2(frs);
}

/**
 * Simplified monthly CPF LIFE illustration from RA balance at payout start.
 * Returns a band (±10%) around the central estimate.
 */
export function estimateCpfLifeMonthlyPayoutRange(
  raBalance: number,
  annualPayoutRate: number = DEFAULT_CPF_LIFE_PAYOUT_RATE_ANNUAL
): { low: number; high: number; central: number } {
  const ra = Math.max(0, raBalance);
  const rate = Math.max(0, Math.min(0.15, annualPayoutRate));
  const central = round2((ra * rate) / 12);
  const low = round2(central * 0.9);
  const high = round2(central * 1.1);
  return { low, high, central };
}

export function buildCpfRetirementProjection(params: {
  currentAge: number;
  assumptions?: Partial<CpfAssumptions>;
  currentFrs?: number;
}): CpfRetirementProjection {
  const assumptions: CpfAssumptions = {
    ...DEFAULT_CPF_ASSUMPTIONS,
    ...params.assumptions,
  };
  const yearsTo55 = yearsUntilAge(params.currentAge);
  const baseline = params.currentFrs ?? CURRENT_FRS_SG;
  const estimatedFrsAt55 =
    assumptions.manualProjectedFrsOverride != null &&
    assumptions.manualProjectedFrsOverride > 0
      ? round2(assumptions.manualProjectedFrsOverride)
      : estimateFutureFrs(
          baseline,
          assumptions.frsAnnualGrowthRate,
          yearsTo55
        );
  const estimatedBrsAt55 = brsFromFrs(estimatedFrsAt55);
  const estimatedErsAt55 = ersFromFrs(estimatedFrsAt55);
  const requiredTargetAt55 = retirementTargetAmount(
    estimatedFrsAt55,
    assumptions.retirementTarget
  );
  const payout = estimateCpfLifeMonthlyPayoutRange(
    requiredTargetAt55,
    assumptions.cpfLifePayoutRateAnnual
  );
  return {
    yearsToAge55: yearsTo55,
    currentFrsBaseline: baseline,
    estimatedFrsAt55,
    estimatedBrsAt55,
    estimatedErsAt55,
    requiredTargetAt55,
    cpfLifeMonthlyPayoutLow: payout.low,
    cpfLifeMonthlyPayoutHigh: payout.high,
  };
}

/**
 * At age 55: SA funds RA first; OA tops up if needed; SA is then closed and any
 * leftover SA moves to OA (CPFB SA-closure rule from Jan 2025).
 */
export function simulateRaFormationAt55(params: {
  oa: number;
  sa: number;
  targetRetirementSum: number;
}): CpfRaSimulation {
  const oa = Math.max(0, params.oa);
  const sa = Math.max(0, params.sa);
  const target = Math.max(0, params.targetRetirementSum);
  const transferFromSa = Math.min(sa, target);
  let remaining = target - transferFromSa;
  const transferFromOa = Math.min(oa, remaining);
  remaining -= transferFromOa;
  const ra = round2(transferFromSa + transferFromOa);
  const transferExcessSaToOa = round2(Math.max(0, sa - transferFromSa));
  const remainingOa = round2(oa - transferFromOa + transferExcessSaToOa);
  const shortfall = round2(Math.max(0, remaining));
  return {
    beforeAge55: { oa, sa },
    requiredTarget: target,
    transferFromSa: round2(transferFromSa),
    transferFromOa: round2(transferFromOa),
    transferExcessSaToOa,
    afterRaCreation: { ra, remainingOa, remainingSa: 0 },
    fullyFunded: shortfall === 0,
    shortfall,
  };
}

/**
 * After SA is closed (age 55+): apply any leftover SA to RA up to the retirement
 * sum target, then to OA. Used when a member already has an RA but still holds SA
 * (e.g. opening balances), or as a belt-and-suspenders drain after formation.
 */
export function closeSpecialAccountBalance(params: {
  sa: number;
  oa: number;
  ra: number;
  targetRetirementSum: number;
}): { sa: number; oa: number; ra: number; toRa: number; toOa: number } {
  const sa = Math.max(0, params.sa);
  if (sa <= 0) {
    return {
      sa: 0,
      oa: round2(Math.max(0, params.oa)),
      ra: round2(Math.max(0, params.ra)),
      toRa: 0,
      toOa: 0,
    };
  }
  const oa = Math.max(0, params.oa);
  const ra = Math.max(0, params.ra);
  const target = Math.max(0, params.targetRetirementSum);
  const toRa = round2(Math.min(sa, Math.max(0, target - ra)));
  const toOa = round2(sa - toRa);
  return {
    sa: 0,
    oa: round2(oa + toOa),
    ra: round2(ra + toRa),
    toRa,
    toOa,
  };
}

/**
 * CPFIS-SA proceeds return to SA before age 55. Once SA is closed, proceeds
 * top up RA to the selected retirement-sum target first; any excess goes to OA.
 */
export function routeCpfSaInvestmentMaturityProceeds(params: {
  proceeds: number;
  memberAgeAtMaturity: number;
  currentRaBalance: number;
  targetRetirementSum: number;
}): CpfSaInvestmentMaturityRouting {
  const proceeds = round2(Math.max(0, params.proceeds));
  const age = Math.max(0, params.memberAgeAtMaturity);
  const currentRa = round2(Math.max(0, params.currentRaBalance));
  const target = round2(Math.max(0, params.targetRetirementSum));

  if (age < CPF_RA_FORMATION_AGE) {
    return {
      toSa: proceeds,
      toRa: 0,
      toOa: 0,
      raShortfallAfterRouting: round2(Math.max(0, target - currentRa)),
    };
  }

  const raTopUpRoom = round2(Math.max(0, target - currentRa));
  const toRa = round2(Math.min(proceeds, raTopUpRoom));
  const toOa = round2(proceeds - toRa);

  return {
    toSa: 0,
    toRa,
    toOa,
    raShortfallAfterRouting: round2(Math.max(0, target - currentRa - toRa)),
  };
}

export function simulateRaForScenario(
  scenario: CpfScenarioExample,
  targetRetirementSum: number
): CpfRaSimulation {
  return simulateRaFormationAt55({
    oa: scenario.beforeAge55.oa,
    sa: scenario.beforeAge55.sa,
    targetRetirementSum,
  });
}
