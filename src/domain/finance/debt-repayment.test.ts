import { describe, expect, it } from "vitest";
import {
  debtRepaymentAppliesInMonth,
  debtRepaymentEndYearMonth,
  estimateAmortizedMonthlyPayment,
  estimateFlatRateMonthlyPayment,
  estimateMonthlyRepayment,
  effectiveMonthlyRepayment,
} from "./debt-repayment";

describe("estimateAmortizedMonthlyPayment", () => {
  it("matches standard level-payment formula", () => {
    const pmt = estimateAmortizedMonthlyPayment(620_000, 0.026, 24 * 12);
    expect(pmt).not.toBeNull();
    expect(pmt!).toBeGreaterThan(2600);
    expect(pmt!).toBeLessThan(3000);
  });
});

describe("estimateFlatRateMonthlyPayment", () => {
  it("matches vehicle-style flat rate example", () => {
    const pmt = estimateFlatRateMonthlyPayment(100_000, 0.02, 7 * 12);
    expect(pmt).toBeCloseTo(1357.14, 0);
  });
});

describe("estimateMonthlyRepayment", () => {
  it("returns null for revolving without manual amount", () => {
    expect(
      estimateMonthlyRepayment({
        balance: 5000,
        loanType: "revolving",
        interestRateAnnual: 0.24,
        remainingTenureMonths: 36,
      })
    ).toBeNull();
  });
});

describe("debt repayment schedule", () => {
  const base = {
    name: "Car",
    balance: 50_000,
    category: "vehicle" as const,
    loanType: "flat_rate" as const,
    interestRateAnnual: 0.02,
    remainingTenureMonths: 84,
    monthlyRepayment: 900,
    repaymentOverride: true,
    startDate: "2025-01-15",
  };

  it("stops after tenure ends", () => {
    expect(
      debtRepaymentAppliesInMonth(base, "2031-11", "2025-05")
    ).toBe(true);
    expect(
      debtRepaymentAppliesInMonth(base, "2031-12", "2025-05")
    ).toBe(true);
    expect(
      debtRepaymentAppliesInMonth(base, "2032-01", "2025-05")
    ).toBe(false);
  });

  it("computes payoff month from start + tenure", () => {
    expect(debtRepaymentEndYearMonth(base, "2025-01")).toBe("2031-12");
  });
});

describe("effectiveMonthlyRepayment", () => {
  it("prefers stored monthly when set", () => {
    expect(
      effectiveMonthlyRepayment({
        name: "Card",
        balance: 10_000,
        category: "credit_card",
        loanType: "revolving",
        interestRateAnnual: null,
        remainingTenureMonths: null,
        monthlyRepayment: 500,
        repaymentOverride: true,
        startDate: null,
      })
    ).toBe(500);
  });
});
