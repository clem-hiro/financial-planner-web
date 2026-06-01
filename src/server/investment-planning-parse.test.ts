import { describe, expect, it } from "vitest";
import { parseInvestmentPlanningFields } from "./investment-planning-parse";

function baseFormData() {
  const fd = new FormData();
  fd.set("contribution_type", "until_retirement");
  fd.set("contribution_growth_annual", "0");
  fd.set("withdrawal_monthly", "2000");
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
});
