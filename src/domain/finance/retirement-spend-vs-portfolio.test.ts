import { describe, expect, it } from "vitest";
import {
  analyzeRetirementDividendVsSpend,
  analyzeRetirementSpendVsPortfolio,
} from "./retirement-spend-vs-portfolio";

describe("analyzeRetirementSpendVsPortfolio — goal inflation", () => {
  const base = {
    projectedBalanceAtRetirement: 2_000_000,
    goalMonthlySpend: 5_000,
    annualWithdrawalRate: 0.04,
  };

  it("gE=0 ∨ yrs=0 ⇒ byte-identical to no-inflation; inflated == nominal", () => {
    const noArgs = analyzeRetirementSpendVsPortfolio(base);
    const zeroArgs = analyzeRetirementSpendVsPortfolio({
      ...base,
      expenseGrowthAnnual: 0,
      yearsToRetirement: 0,
    });
    const zeroYears = analyzeRetirementSpendVsPortfolio({
      ...base,
      expenseGrowthAnnual: 0.02,
      yearsToRetirement: 0,
    });
    expect(zeroArgs.requiredPortfolioForGoal).toBe(
      noArgs.requiredPortfolioForGoal
    );
    expect(zeroYears.requiredPortfolioForGoal).toBe(
      noArgs.requiredPortfolioForGoal
    );
    expect(zeroArgs.inflatedMonthlySpendGoal).toBe(base.goalMonthlySpend);
  });

  it("inflates the goal to retirement-year dollars before the comparison", () => {
    const yrs = 20;
    const gE = 0.02;
    const r = analyzeRetirementSpendVsPortfolio({
      ...base,
      expenseGrowthAnnual: gE,
      yearsToRetirement: yrs,
    });
    const geff = base.goalMonthlySpend * Math.pow(1 + gE, yrs);
    expect(r.inflatedMonthlySpendGoal).toBeCloseTo(geff, 6);
    expect(r.requiredPortfolioForGoal).toBeCloseTo(
      (geff * 12) / base.annualWithdrawalRate,
      4
    );
    // Inflated goal needs a far larger portfolio than the nominal one.
    expect(r.meetsGoal).toBe(false);
  });

  it("null goal ⇒ inflatedMonthlySpendGoal null", () => {
    const r = analyzeRetirementSpendVsPortfolio({
      ...base,
      goalMonthlySpend: null,
      expenseGrowthAnnual: 0.02,
      yearsToRetirement: 20,
    });
    expect(r.inflatedMonthlySpendGoal).toBeNull();
  });
});

describe("analyzeRetirementDividendVsSpend — goal inflation", () => {
  const base = {
    projectedInvestmentsAtRetirement: 1_000_000,
    goalMonthlySpend: 4_000,
    annualDividendYield: 0.03,
    currentCashTotal: 100_000,
  };

  it("gE=0 ∨ yrs=0 ⇒ nominal == inflated, comparisons unchanged", () => {
    const noArgs = analyzeRetirementDividendVsSpend(base);
    const zeroArgs = analyzeRetirementDividendVsSpend({
      ...base,
      expenseGrowthAnnual: 0,
      yearsToRetirement: 0,
    });
    expect(zeroArgs.monthlySpendGoal).toBe(base.goalMonthlySpend);
    expect(zeroArgs.inflatedMonthlySpendGoal).toBe(base.goalMonthlySpend);
    expect(zeroArgs.monthlyCashSupplementNeeded).toBe(
      noArgs.monthlyCashSupplementNeeded
    );
    expect(zeroArgs.requiredInvestedForDividendGoal).toBe(
      noArgs.requiredInvestedForDividendGoal
    );
  });

  it("keeps monthlySpendGoal nominal, exposes inflated goal, compares vs inflated", () => {
    const yrs = 10;
    const gE = 0.03;
    const r = analyzeRetirementDividendVsSpend({
      ...base,
      expenseGrowthAnnual: gE,
      yearsToRetirement: yrs,
    });
    const geff = base.goalMonthlySpend * Math.pow(1 + gE, yrs);
    expect(r.monthlySpendGoal).toBe(base.goalMonthlySpend); // nominal preserved
    expect(r.inflatedMonthlySpendGoal).toBeCloseTo(geff, 6);
    // Supplement is computed against the inflated goal.
    const monthlyDividend = (base.projectedInvestmentsAtRetirement * 0.03) / 12;
    expect(r.monthlyCashSupplementNeeded).toBeCloseTo(
      Math.max(0, geff - monthlyDividend),
      4
    );
  });
});
