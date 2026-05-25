import { describe, expect, it } from "vitest";
import { resolveRootDestination } from "@/lib/root-destination";
import type { ProfileRow } from "@/data/supabase/types";

const user = { id: "u1" } as const;

function clientProfile(
  overrides: Partial<ProfileRow> = {}
): ProfileRow {
  return {
    id: "u1",
    profile_type: "client",
    advisor_user_id: "advisor-1",
    display_name: null,
    monthly_income: null,
    salary_frequency: null,
    annual_bonus: null,
    savings_target_monthly: null,
    fixed_expenses_monthly: null,
    debt_obligations_monthly: null,
    monthly_gross_salary: null,
    annual_salary_growth_nominal: null,
    expense_growth_nominal: null,
    cpf_age_band: null,
    birth_date: null,
    target_retirement_age: null,
    retirement_monthly_spend_goal: null,
    base_currency: "SGD",
    onboarding_required: false,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ProfileRow;
}

describe("resolveRootDestination", () => {
  it("shows splash when signed out", () => {
    expect(resolveRootDestination(null, null)).toEqual({ kind: "splash" });
  });

  it("routes advisors to /advisor", () => {
    expect(
      resolveRootDestination(user, {
        ...clientProfile(),
        profile_type: "advisor",
      })
    ).toEqual({ kind: "redirect", pathname: "/advisor" });
  });

  it("routes clients without advisor link to account issue", () => {
    expect(
      resolveRootDestination(
        user,
        clientProfile({ advisor_user_id: null })
      )
    ).toEqual({ kind: "redirect", pathname: "/account-issue" });

    expect(
      resolveRootDestination(
        user,
        clientProfile({ advisor_user_id: "   " })
      )
    ).toEqual({ kind: "redirect", pathname: "/account-issue" });
  });

  it("routes clients needing onboarding", () => {
    expect(
      resolveRootDestination(
        user,
        clientProfile({
          onboarding_required: true,
          onboarding_completed_at: null,
        })
      )
    ).toEqual({ kind: "redirect", pathname: "/onboarding" });
  });

  it("routes ready clients to dashboard", () => {
    expect(resolveRootDestination(user, clientProfile())).toEqual({
      kind: "redirect",
      pathname: "/dashboard",
    });
  });

  it("treats missing profile as advisor (middleware parity)", () => {
    expect(resolveRootDestination(user, null)).toEqual({
      kind: "redirect",
      pathname: "/advisor",
    });
  });
});
