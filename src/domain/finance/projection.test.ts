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

  it("steps monthly contributions up annually when contribution growth is set", () => {
    const stepped = projectFutureValue({
      currentValue: 0,
      monthlyContribution: 100,
      annualReturn: 0,
      months: 24,
      contributionGrowthAnnual: 0.1,
    });
    expect(stepped).toBeCloseTo(12 * 100 + 12 * 110, 8);
  });

  it("applies planned annual withdrawals in December after the withdrawal start month", () => {
    const drawdown = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 0,
      annualReturn: 0,
      months: 12,
      annualWithdrawal: 6_000,
      withdrawalStartMonth: 6,
    });
    expect(drawdown).toBeCloseTo(4_000, 8);
  });
});

describe("projectFutureValue with contributionStartMonth", () => {
  it("defers contributions until the start month", () => {
    const immediate = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn: 0,
      months: 12,
      contributionMonthsLimit: 12,
    });
    const deferred = projectFutureValue({
      currentValue: 10_000,
      monthlyContribution: 500,
      annualReturn: 0,
      months: 12,
      contributionMonthsLimit: 12,
      contributionStartMonth: 6,
    });
    expect(deferred).toBeLessThan(immediate);
    expect(immediate - deferred).toBe(6 * 500);
  });
});

describe("contributionMonthsLimitFromInvestmentRow", () => {
  it("uses calendar end date when set", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      {
        contribution_type: "fixed_duration",
        contribution_duration_years: "99",
        contribution_start_date: null,
        contribution_end_date: "2028-06-01",
      },
      null
    );
    expect(lim).toBeDefined();
    expect(lim!).toBeGreaterThan(0);
    expect(lim!).toBeLessThan(99 * 12);
  });

  it("uses fixed years when type is fixed_duration", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      {
        contribution_type: "fixed_duration",
        contribution_duration_years: "15",
        contribution_start_date: null,
        contribution_end_date: null,
      },
      400
    );
    expect(lim).toBe(15 * 12);
  });

  it("uses months to retirement for until_retirement", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      {
        contribution_type: null,
        contribution_duration_years: null,
        contribution_start_date: null,
        contribution_end_date: null,
      },
      180
    );
    expect(lim).toBe(180);
  });

  it("returns undefined when retirement horizon unknown (legacy-friendly)", () => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      {
        contribution_type: null,
        contribution_duration_years: null,
        contribution_start_date: null,
        contribution_end_date: null,
      },
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
        contribution_growth_annual: "0",
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
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
        contribution_growth_annual: "0",
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
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

  it("sums variable contributions and account withdrawals", () => {
    const ts = "2020-01-01T00:00:00.000Z";
    const rows: InvestmentRow[] = [
      {
        id: "1",
        user_id: "u",
        name: "A",
        current_value: "10000",
        monthly_contribution: "100",
        expected_annual_return: "0",
        contribution_growth_annual: "0.1",
        contribution_type: "until_retirement",
        contribution_duration_years: null,
        withdrawal_monthly: "500",
        withdrawal_start_years: "2",
        created_at: ts,
        updated_at: ts,
      },
    ];
    expect(futureValueInvestmentPortfolioAtMonth(rows, 24, 360)).toBeCloseTo(
      12_520,
      8
    );
    expect(futureValueInvestmentPortfolioAtMonth(rows, 25, 360)).toBeCloseTo(
      12_641,
      8
    );
    expect(futureValueInvestmentPortfolioAtMonth(rows, 36, 360)).toBeCloseTo(
      7_972,
      8
    );
  });
});
