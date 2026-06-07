import { describe, expect, it } from "vitest";
import type { AdvisorClientWorkspaceListRow } from "@/data/repositories/advisor-clients";
import {
  parseAdvisorClientListFilterPreset,
  rowMatchesAdvisorClientListFilter,
} from "./advisor-client-list-filters";

function row(
  overrides: Partial<AdvisorClientWorkspaceListRow> = {}
): AdvisorClientWorkspaceListRow {
  return {
    id: "c1",
    display_name: "Test",
    profile_type: "client",
    onboarding_required: true,
    onboarding_completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    monthly_income: "5000",
    savings_target_monthly: "500",
    fixed_expenses_monthly: "2000",
    monthly_gross_salary: null,
    last_expense_spent_at: null,
    expense_count: "0",
    total_count: "1",
    consent_status: "none",
    ...overrides,
  };
}

describe("parseAdvisorClientListFilterPreset", () => {
  it("defaults unknown values to all", () => {
    expect(parseAdvisorClientListFilterPreset(undefined)).toBe("all");
    expect(parseAdvisorClientListFilterPreset("bogus")).toBe("all");
  });

  it("accepts known presets", () => {
    expect(parseAdvisorClientListFilterPreset("needs_attention")).toBe(
      "needs_attention"
    );
  });
});

describe("rowMatchesAdvisorClientListFilter", () => {
  it("pending_onboarding matches incomplete wizard clients", () => {
    expect(
      rowMatchesAdvisorClientListFilter(
        row({ onboarding_required: true, onboarding_completed_at: null }),
        "pending_onboarding"
      )
    ).toBe(true);
    expect(
      rowMatchesAdvisorClientListFilter(
        row({ onboarding_required: false, onboarding_completed_at: "2026-01-02" }),
        "pending_onboarding"
      )
    ).toBe(false);
  });

  it("consent_missing matches none status", () => {
    expect(
      rowMatchesAdvisorClientListFilter(row({ consent_status: "none" }), "consent_missing")
    ).toBe(true);
    expect(
      rowMatchesAdvisorClientListFilter(row({ consent_status: "active" }), "consent_missing")
    ).toBe(false);
  });

  it("needs_attention matches high-risk or non-active consent", () => {
    expect(
      rowMatchesAdvisorClientListFilter(
        row({
          consent_status: "none",
          monthly_income: "5000",
          fixed_expenses_monthly: "4500",
        }),
        "needs_attention"
      )
    ).toBe(true);
  });
});
