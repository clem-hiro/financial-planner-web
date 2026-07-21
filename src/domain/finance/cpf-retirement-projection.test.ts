import { describe, expect, it } from "vitest";
import {
  CPF_FRS_BASE_COHORT_YEAR,
  CURRENT_FRS_SG,
  DEFAULT_FRS_ANNUAL_GROWTH_RATE,
  estimateFutureFrs,
  closeSpecialAccountBalance,
  routeCpfSaInvestmentMaturityProceeds,
  simulateRaFormationAt55,
  buildCpfRetirementProjection,
  retirementTargetAmount,
  CPF_SCENARIO_EXAMPLES,
  simulateRaForScenario,
} from "./cpf-retirement-projection";

/** CPFB published FRS for 2026 cohort (turning 55 in 2026) — update when policy changes. */
const PUBLISHED_FRS_2026_COHORT = 220_400;

describe("CPF retirement sum constants", () => {
  it("matches published FRS for the configured cohort year", () => {
    expect(CPF_FRS_BASE_COHORT_YEAR).toBe(2026);
    expect(CURRENT_FRS_SG).toBe(PUBLISHED_FRS_2026_COHORT);
  });
});

describe("estimateFutureFrs", () => {
  it("compounds growth for years until 55", () => {
    const result = estimateFutureFrs(
      CURRENT_FRS_SG,
      DEFAULT_FRS_ANNUAL_GROWTH_RATE,
      10
    );
    expect(result).toBeCloseTo(
      CURRENT_FRS_SG * (1 + DEFAULT_FRS_ANNUAL_GROWTH_RATE) ** 10,
      0
    );
  });

  it("returns baseline when years is zero", () => {
    expect(estimateFutureFrs(CURRENT_FRS_SG, 0.035, 0)).toBe(CURRENT_FRS_SG);
  });
});

describe("simulateRaFormationAt55", () => {
  it("transfers SA first then OA", () => {
    const sim = simulateRaFormationAt55({
      oa: 320_000,
      sa: 280_000,
      targetRetirementSum: 500_000,
    });
    expect(sim.transferFromSa).toBe(280_000);
    expect(sim.transferFromOa).toBe(220_000);
    expect(sim.transferExcessSaToOa).toBe(0);
    expect(sim.afterRaCreation.ra).toBe(500_000);
    expect(sim.afterRaCreation.remainingOa).toBe(100_000);
    expect(sim.afterRaCreation.remainingSa).toBe(0);
    expect(sim.fullyFunded).toBe(true);
  });

  it("closes SA and moves excess SA above the target into OA", () => {
    const sim = simulateRaFormationAt55({
      oa: 50_000,
      sa: 300_000,
      targetRetirementSum: 220_400,
    });
    expect(sim.transferFromSa).toBe(220_400);
    expect(sim.transferFromOa).toBe(0);
    expect(sim.transferExcessSaToOa).toBeCloseTo(79_600, 2);
    expect(sim.afterRaCreation.ra).toBe(220_400);
    expect(sim.afterRaCreation.remainingSa).toBe(0);
    expect(sim.afterRaCreation.remainingOa).toBeCloseTo(129_600, 2);
  });

  it("records shortfall when balances are below target", () => {
    const sim = simulateRaFormationAt55({
      oa: 80_000,
      sa: 40_000,
      targetRetirementSum: 500_000,
    });
    expect(sim.afterRaCreation.ra).toBe(120_000);
    expect(sim.afterRaCreation.remainingSa).toBe(0);
    expect(sim.shortfall).toBe(380_000);
    expect(sim.fullyFunded).toBe(false);
  });
});

describe("closeSpecialAccountBalance", () => {
  it("tops up RA from leftover SA then routes the rest to OA", () => {
    const closed = closeSpecialAccountBalance({
      sa: 100_000,
      oa: 10_000,
      ra: 180_000,
      targetRetirementSum: 220_400,
    });
    expect(closed).toEqual({
      sa: 0,
      oa: 69_600,
      ra: 220_400,
      toRa: 40_400,
      toOa: 59_600,
    });
  });
});

describe("routeCpfSaInvestmentMaturityProceeds", () => {
  it("returns CPFIS-SA proceeds to SA before age 55", () => {
    const routed = routeCpfSaInvestmentMaturityProceeds({
      proceeds: 80_000,
      memberAgeAtMaturity: 54,
      currentRaBalance: 0,
      targetRetirementSum: 220_400,
    });

    expect(routed).toEqual({
      toSa: 80_000,
      toRa: 0,
      toOa: 0,
      raShortfallAfterRouting: 220_400,
    });
  });

  it("tops up RA first after SA closure, then routes excess to OA", () => {
    const routed = routeCpfSaInvestmentMaturityProceeds({
      proceeds: 100_000,
      memberAgeAtMaturity: 56,
      currentRaBalance: 180_000,
      targetRetirementSum: 220_400,
    });

    expect(routed).toEqual({
      toSa: 0,
      toRa: 40_400,
      toOa: 59_600,
      raShortfallAfterRouting: 0,
    });
  });

  it("keeps the RA shortfall when proceeds are not enough after age 55", () => {
    const routed = routeCpfSaInvestmentMaturityProceeds({
      proceeds: 15_000,
      memberAgeAtMaturity: 55,
      currentRaBalance: 180_000,
      targetRetirementSum: 220_400,
    });

    expect(routed).toEqual({
      toSa: 0,
      toRa: 15_000,
      toOa: 0,
      raShortfallAfterRouting: 25_400,
    });
  });
});

describe("buildCpfRetirementProjection", () => {
  it("uses BRS when target is brs", () => {
    const p = buildCpfRetirementProjection({
      currentAge: 40,
      assumptions: { retirementTarget: "brs" },
    });
    expect(p.requiredTargetAt55).toBe(p.estimatedBrsAt55);
  });

  it("honours manual FRS override", () => {
    const p = buildCpfRetirementProjection({
      currentAge: 30,
      assumptions: { manualProjectedFrsOverride: 520_000 },
    });
    expect(p.estimatedFrsAt55).toBe(520_000);
    expect(p.requiredTargetAt55).toBe(520_000);
  });
});

describe("CPF_SCENARIO_EXAMPLES", () => {
  it("high SA scenario needs less OA transfer", () => {
    const target = retirementTargetAmount(500_000, "frs");
    const highSa = simulateRaForScenario(CPF_SCENARIO_EXAMPLES[0], target);
    const mostlyOa = simulateRaForScenario(CPF_SCENARIO_EXAMPLES[1], target);
    expect(highSa.transferFromOa).toBeLessThan(mostlyOa.transferFromOa);
  });
});
