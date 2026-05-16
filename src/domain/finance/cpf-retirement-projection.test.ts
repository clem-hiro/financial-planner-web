import { describe, expect, it } from "vitest";
import {
  CURRENT_FRS_SG,
  DEFAULT_FRS_ANNUAL_GROWTH_RATE,
  estimateFutureFrs,
  simulateRaFormationAt55,
  buildCpfRetirementProjection,
  retirementTargetAmount,
  CPF_SCENARIO_EXAMPLES,
  simulateRaForScenario,
} from "./cpf-retirement-projection";

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
    expect(sim.afterRaCreation.ra).toBe(500_000);
    expect(sim.afterRaCreation.remainingOa).toBe(100_000);
    expect(sim.fullyFunded).toBe(true);
  });

  it("records shortfall when balances are below target", () => {
    const sim = simulateRaFormationAt55({
      oa: 80_000,
      sa: 40_000,
      targetRetirementSum: 500_000,
    });
    expect(sim.afterRaCreation.ra).toBe(120_000);
    expect(sim.shortfall).toBe(380_000);
    expect(sim.fullyFunded).toBe(false);
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
