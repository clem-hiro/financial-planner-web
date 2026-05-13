import type { InvestmentRow } from "@/data/supabase/types";
import { describe, expect, it } from "vitest";
import { contributionMonthsLimitFromInvestmentRow } from "./investment-contribution";
import { futureValueInvestmentPortfolioAtMonth } from "./investment-portfolio-fv";
import { projectFutureValue } from "./projection";

describe("projectFutureValue (contribution phase)", () => {
  it("matches legacy when contributionMonthsLimit is omitted", () => {
    const a = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn: 0.06,
      months: 120,
    });
    const b = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn: 0.06,
      months: 120,
      contributionMonthsLimit: null,
    });
    expect(a).toBeCloseTo(b, 8);
  });

  it("stops contributions after the cap but keeps compounding", () => {
    const annualReturn = 0.06;
    const cap = 60;
    const totalMonths = 120;
    const mid = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn,
      months: cap,
    });
    const full = projectFutureValue({
      currentValue: mid,
      monthlyContribution: 0,
      annualReturn,
      months: totalMonths - cap,
    });
    const phased = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn,
      months: totalMonths,
      contributionMonthsLimit: cap,
    });
    expect(phased).toBeCloseTo(full, 6);
  });

  it("linear when rate is zero and cap splits phases", () => {
    const phased = projectFutureValue({
      currentValue: 1000,
      monthlyContribution: 100,
      annualReturn: 0,
      months: 10,
      contributionMonthsLimit: 4,
    });
    expect(phased).toBeCloseTo(1400, 8);
  });
});

describe("contributionMonthsLimitFromInvestmentRow", () => {
  it("uses fixed years when type is fixed_duration", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      {
        contribution_type: "fixed_duration",
        contribution_duration_years: "15",
      },
      400
    );
    expect(lim).toBe(15 * 12);
  });

  it("uses months to retirement for until_retirement", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      { contribution_type: null, contribution_duration_years: null },
      180
    );
    expect(lim).toBe(180);
  });

  it("returns undefined when retirement horizon unknown (legacy-friendly)", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      { contribution_type: null, contribution_duration_years: null },
      null
    );
    expect(lim).toBeUndefined();
  });
});

describe("futureValueInvestmentPortfolioAtMonth", () => {
  it("sums two accounts", () => {
    const ts = "2020-01-01T00:00:00.000Z";
    const rows: InvestmentRow[] = [
      {
        id: "1",
        user_id: "u",
        name: "A",
        current_value: "5000",
        monthly_contribution: "100",
        expected_annual_return: "0.05",
        created_at: ts,
        updated_at: ts,
      },
      {
        id: "2",
        user_id: "u",
        name: "B",
        current_value: "3000",
        monthly_contribution: "0",
        expected_annual_return: "0.05",
        created_at: ts,
        updated_at: ts,
      },
    ];
    const m = 12;
    const sum =
      projectFutureValue({
        currentValue: 5000,
        monthlyContribution: 100,
        annualReturn: 0.05,
        months: m,
      }) +
      projectFutureValue({
        currentValue: 3000,
        monthlyContribution: 0,
        annualReturn: 0.05,
        months: m,
      });
    expect(futureValueInvestmentPortfolioAtMonth(rows, m, null)).toBeCloseTo(
      sum,
      6
    );
  });
});
