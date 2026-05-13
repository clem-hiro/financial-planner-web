import { describe, expect, it } from "vitest";
import {
  annualEmployeeCpfTakeHomeWithBonusSg,
  countAnnualBonusPayoutsInHorizon,
} from "@/domain/finance/sg-cpf";

describe("annualEmployeeCpfTakeHomeWithBonusSg", () => {
  it("keeps monthly budget take-home on salary only while splitting bonus to net annual", () => {
    const d = annualEmployeeCpfTakeHomeWithBonusSg(10_000, 20_000, "2026-05", "below_55");
    expect(d.takeHomeFromSalaryMonthly).toBeGreaterThan(0);
    expect(d.takeHomeMonthlyEquivalent).not.toBeCloseTo(d.takeHomeFromSalaryMonthly, 1);
    expect(d.takeHomeFromBonusNetAnnual).toBeCloseTo(
      d.grossAnnualBonus - d.employeeCpfOnAwAnnual,
      2
    );
    expect(d.takeHomeAnnual).toBeCloseTo(
      d.takeHomeFromSalaryMonthly * 12 + d.takeHomeFromBonusNetAnnual,
      2
    );
  });

  it("matches smoothed monthly equivalent when bonus is zero", () => {
    const d = annualEmployeeCpfTakeHomeWithBonusSg(5000, 0, "2026-01", "below_55");
    expect(d.takeHomeFromBonusNetAnnual).toBe(0);
    expect(d.takeHomeMonthlyEquivalent).toBeCloseTo(d.takeHomeFromSalaryMonthly, 5);
  });
});

describe("countAnnualBonusPayoutsInHorizon", () => {
  it("counts December once in a 12-month window starting January", () => {
    expect(countAnnualBonusPayoutsInHorizon("2026-01", 12, 12)).toBe(1);
  });

  it("counts zero months when horizon is zero", () => {
    expect(countAnnualBonusPayoutsInHorizon("2026-01", 0, 12)).toBe(0);
  });

  it("counts two Decembers across 24 months from January", () => {
    expect(countAnnualBonusPayoutsInHorizon("2026-01", 24, 12)).toBe(2);
  });
});
