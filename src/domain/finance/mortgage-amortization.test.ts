import { describe, expect, it } from "vitest";
import { buildAmortizationSchedule } from "./mortgage-amortization";

describe("buildAmortizationSchedule", () => {
  it("zeros out principal over term with zero interest", () => {
    const sched = buildAmortizationSchedule({
      principal: 12_000,
      annualNominalRate: 0,
      termMonths: 12,
      firstPaymentYearMonth: "2026-01",
    });
    expect(sched.length).toBe(12);
    expect(sched[0].yearMonth).toBe("2026-01");
    expect(sched[11].yearMonth).toBe("2026-12");
    expect(sched[11].balanceAfter).toBe(0);
    const sumPrin = sched.reduce((a, r) => a + r.principal, 0);
    expect(sumPrin).toBeCloseTo(12_000, 1);
  });

  it("has declining balance with positive rate", () => {
    const sched = buildAmortizationSchedule({
      principal: 100_000,
      annualNominalRate: 0.06,
      termMonths: 360,
      firstPaymentYearMonth: "2026-04",
    });
    expect(sched.length).toBe(360);
    expect(sched[0].balanceAfter).toBeLessThan(100_000);
    expect(sched[359].balanceAfter).toBeLessThan(1);
    expect(sched[0].yearMonth).toBe("2026-04");
  });
});
