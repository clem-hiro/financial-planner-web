import { describe, expect, it } from "vitest";
import { parseInvestmentPlanningFields } from "./investment-planning-parse";

function baseFormData() {
  const fd = new FormData();
  fd.set("contribution_type", "until_retirement");
  fd.set("investment_income_rate_annual", "0.03");
  fd.set("contribution_growth_annual", "0");
  fd.set("withdrawal_annual", "24000");
  return fd;
}

describe("parseInvestmentPlanningFields", () => {
  it("converts withdrawal start age into years from today", () => {
    const fd = baseFormData();
    fd.set("withdrawal_start_age", "65");
    fd.set("withdrawal_current_age", "35");

    const parsed = parseInvestmentPlanningFields(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.withdrawal_start_years).toBe(30);
      expect(parsed.withdrawal_annual).toBe(24000);
      expect(parsed.withdrawal_monthly).toBe(2000);
      expect(parsed.investment_income_rate_annual).toBe(0.03);
    }
  });

  it("keeps the legacy years-from-today field when age context is absent", () => {
    const fd = baseFormData();
    fd.set("withdrawal_start_years", "30");

    const parsed = parseInvestmentPlanningFields(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.withdrawal_start_years).toBe(30);
    }
  });

  it("falls back from legacy monthly withdrawal when annual is absent", () => {
    const fd = new FormData();
    fd.set("contribution_type", "until_retirement");
    fd.set("contribution_growth_annual", "0");
    fd.set("withdrawal_monthly", "500");

    const parsed = parseInvestmentPlanningFields(fd);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.withdrawal_annual).toBe(6000);
      expect(parsed.withdrawal_monthly).toBe(500);
    }
  });

  it("rejects ILP withdrawals before plan maturity", () => {
    const fd = baseFormData();
    const nextYear = new Date().getFullYear() + 1;
    fd.set("plan_nature", "includes_insurance_coverage");
    fd.set("contribution_type", "fixed_duration");
    fd.set("contribution_start_date", `${nextYear}-01-01`);
    fd.set("contribution_duration_years", "10");
    fd.set("withdrawal_start_years", "2");

    const parsed = parseInvestmentPlanningFields(fd);

    expect(parsed.ok).toBe(false);
  });
});
