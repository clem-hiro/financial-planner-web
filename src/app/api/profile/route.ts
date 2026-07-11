import { NextResponse } from "next/server";
import { num } from "@/data/mappers";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { SgCpfAgeBand } from "@/domain/finance/sg-cpf";
import { annualEmployeeCpfTakeHomeWithBonusSg } from "@/domain/finance/sg-cpf";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { profilePatchSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const touchCpf =
    data.monthly_gross_salary !== undefined ||
    data.cpf_age_band !== undefined ||
    data.annual_bonus !== undefined;

  const patch: {
    display_name?: string | null;
    monthly_income?: number | null;
    other_monthly_income?: number | null;
    salary_frequency?: "monthly" | "biweekly" | "weekly" | "annual" | null;
    annual_bonus?: number | null;
    annual_bonus_months?: number | null;
    savings_target_monthly?: number | null;
    fixed_expenses_monthly?: number | null;
    debt_obligations_monthly?: number | null;
    base_currency?: string;
    monthly_gross_salary?: number | null;
    cpf_age_band?: string | null;
    birth_date?: string | null;
    target_retirement_age?: number | null;
    retirement_monthly_spend_goal?: number | null;
    retirement_dividend_yield_annual?: number | null;
    retirement_withdrawal_rate_annual?: number | null;
    annual_salary_growth_nominal?: number | null;
    expense_growth_nominal?: number | null;
    onboarding_required?: boolean;
    onboarding_step?: number | null;
    onboarding_completed_at?: string | null;
    lifestyle_profile?: string | null;
    budgeting_strategy?: string | null;
    onboarding_confidence_level?: string | null;
    budget_generation_source?: string | null;
    estimated_budget_mode?: boolean;
    food_spend_band?: string | null;
    salary_increment_month?: number | null;
    last_salary_review_at?: string | null;
    last_investment_review_at?: string | null;
    last_cpf_rules_review_at?: string | null;
    last_cpf_rules_review_version?: string | null;
  } = {};

  if (data.display_name !== undefined) {
    patch.display_name = data.display_name;
  }
  if (data.salary_frequency !== undefined) {
    patch.salary_frequency = data.salary_frequency;
  }
  if (data.annual_bonus !== undefined) {
    patch.annual_bonus = data.annual_bonus;
  }
  if (data.annual_bonus_months !== undefined) {
    patch.annual_bonus_months = data.annual_bonus_months;
  }
  if (data.savings_target_monthly !== undefined) {
    patch.savings_target_monthly = data.savings_target_monthly;
  }
  if (data.fixed_expenses_monthly !== undefined) {
    patch.fixed_expenses_monthly = data.fixed_expenses_monthly;
  }
  if (data.debt_obligations_monthly !== undefined) {
    patch.debt_obligations_monthly = data.debt_obligations_monthly;
  }
  if (data.base_currency !== undefined) {
    patch.base_currency = data.base_currency;
  }

  if (touchCpf) {
    const existing = await getProfileById(supabase, user.id);
    let gross =
      existing?.monthly_gross_salary != null
        ? num(existing.monthly_gross_salary)
        : null;
    if (gross === 0) gross = null;

    let band = (existing?.cpf_age_band as SgCpfAgeBand | null) ?? null;
    let annualBonus =
      existing?.annual_bonus != null ? num(existing.annual_bonus) : 0;

    if (data.monthly_gross_salary !== undefined) {
      const g = data.monthly_gross_salary;
      gross = g == null || g === 0 ? null : g;
    }
    if (data.cpf_age_band !== undefined) {
      band = data.cpf_age_band;
    }
    if (data.annual_bonus !== undefined) {
      annualBonus = data.annual_bonus ?? 0;
    }

    if (gross != null && gross > 0) {
      if (!band) {
        return NextResponse.json(
          {
            error:
              "cpf_age_band is required when monthly_gross_salary is set (or already stored)",
          },
          { status: 400 }
        );
      }
      const ym = formatYearMonth(new Date());
      const { takeHomeFromSalaryMonthly } = annualEmployeeCpfTakeHomeWithBonusSg(
        gross,
        annualBonus,
        ym,
        band
      );
      patch.monthly_gross_salary = gross;
      patch.cpf_age_band = band;
      patch.monthly_income = takeHomeFromSalaryMonthly;
    } else {
      if (data.monthly_gross_salary !== undefined) {
        patch.monthly_gross_salary = null;
        patch.cpf_age_band = null;
      } else if (data.cpf_age_band !== undefined) {
        patch.cpf_age_band = data.cpf_age_band;
      }
      if (data.monthly_income !== undefined) {
        patch.monthly_income = data.monthly_income;
      }
    }
  } else if (data.monthly_income !== undefined) {
    patch.monthly_income = data.monthly_income;
  }

  if (data.other_monthly_income !== undefined) {
    patch.other_monthly_income = data.other_monthly_income;
  }

  if (data.birth_date !== undefined) {
    patch.birth_date = data.birth_date;
  }
  if (data.target_retirement_age !== undefined) {
    patch.target_retirement_age = data.target_retirement_age;
  }
  if (data.retirement_monthly_spend_goal !== undefined) {
    patch.retirement_monthly_spend_goal = data.retirement_monthly_spend_goal;
  }
  if (data.retirement_dividend_yield_annual !== undefined) {
    patch.retirement_dividend_yield_annual =
      data.retirement_dividend_yield_annual;
  }
  if (data.retirement_withdrawal_rate_annual !== undefined) {
    patch.retirement_withdrawal_rate_annual =
      data.retirement_withdrawal_rate_annual;
  }
  if (data.annual_salary_growth_nominal !== undefined) {
    patch.annual_salary_growth_nominal = data.annual_salary_growth_nominal;
  }
  if (data.expense_growth_nominal !== undefined) {
    patch.expense_growth_nominal = data.expense_growth_nominal;
  }
  if (data.onboarding_required !== undefined) {
    patch.onboarding_required = data.onboarding_required;
  }
  if (data.onboarding_step !== undefined) {
    patch.onboarding_step = data.onboarding_step;
  }
  if (data.onboarding_completed_at !== undefined) {
    patch.onboarding_completed_at = data.onboarding_completed_at;
  }
  if (data.lifestyle_profile !== undefined) {
    patch.lifestyle_profile = data.lifestyle_profile;
  }
  if (data.budgeting_strategy !== undefined) {
    patch.budgeting_strategy = data.budgeting_strategy;
  }
  if (data.onboarding_confidence_level !== undefined) {
    patch.onboarding_confidence_level = data.onboarding_confidence_level;
  }
  if (data.budget_generation_source !== undefined) {
    patch.budget_generation_source = data.budget_generation_source;
  }
  if (data.estimated_budget_mode !== undefined) {
    patch.estimated_budget_mode = data.estimated_budget_mode;
  }
  if (data.food_spend_band !== undefined) {
    patch.food_spend_band = data.food_spend_band;
  }
  if (data.salary_increment_month !== undefined) {
    patch.salary_increment_month = data.salary_increment_month;
  }
  if (data.last_salary_review_at !== undefined) {
    patch.last_salary_review_at = data.last_salary_review_at;
  }
  if (data.last_investment_review_at !== undefined) {
    patch.last_investment_review_at = data.last_investment_review_at;
  }
  if (data.last_cpf_rules_review_at !== undefined) {
    patch.last_cpf_rules_review_at = data.last_cpf_rules_review_at;
  }
  if (data.last_cpf_rules_review_version !== undefined) {
    patch.last_cpf_rules_review_version = data.last_cpf_rules_review_version;
  }

  if (Object.keys(patch).length === 0) {
    const profile = await getProfileById(supabase, user.id);
    return NextResponse.json(profile);
  }

  try {
    await updateProfile(supabase, user.id, patch);
    const profile = await getProfileById(supabase, user.id);
    return NextResponse.json(profile);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
