import { describe, expect, it } from "vitest";
import {
  compareDebtPayoffStrategies,
  debtsEligibleForPayoffComparison,
} from "./debt-payoff-strategies";

describe("compareDebtPayoffStrategies", () => {
  const twoDebts = [
    {
      id: "a",
      name: "Card",
      balance: 10_000,
      annualRate: 0.24,
      minimumPayment: 300,
    },
    {
      id: "b",
      name: "Personal",
      balance: 5_000,
      annualRate: 0.06,
      minimumPayment: 150,
    },
  ];

  it("returns empty with fewer than two eligible debts", () => {
    expect(compareDebtPayoffStrategies([twoDebts[0]!], 0)).toEqual([]);
    expect(
      debtsEligibleForPayoffComparison([
        { ...twoDebts[0]!, balance: 0, minimumPayment: 300 },
        twoDebts[1]!,
      ])
    ).toHaveLength(1);
  });

  it("matches strategies when extra is zero and minimums only", () => {
    const results = compareDebtPayoffStrategies(twoDebts, 0);
    expect(results).toHaveLength(2);
    expect(results[0]!.monthsToDebtFree).toBe(results[1]!.monthsToDebtFree);
  });

  it("avalanche finishes sooner or equal with less interest when extra is applied", () => {
    const results = compareDebtPayoffStrategies(twoDebts, 200);
    const avalanche = results.find((r) => r.strategy === "avalanche")!;
    const snowball = results.find((r) => r.strategy === "snowball")!;
    expect(avalanche.monthsToDebtFree).not.toBeNull();
    expect(snowball.monthsToDebtFree).not.toBeNull();
    expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(
      snowball.totalInterestPaid
    );
    expect(avalanche.payoffOrder[0]).toBe("a");
  });
});
