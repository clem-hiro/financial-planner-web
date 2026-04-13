import { NextResponse } from "next/server";
import { num } from "@/data/mappers";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { SgCpfAgeBand } from "@/domain/finance/sg-cpf";
import { monthlyEmployeeCpfTakeHomeSg } from "@/domain/finance/sg-cpf";
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
    data.cpf_age_band !== undefined;

  const patch: {
    display_name?: string | null;
    monthly_income?: number | null;
    monthly_gross_salary?: number | null;
    cpf_age_band?: string | null;
    birth_date?: string | null;
    target_retirement_age?: number | null;
    retirement_monthly_spend_goal?: number | null;
    retirement_dividend_yield_annual?: number | null;
    annual_salary_growth_nominal?: number | null;
  } = {};

  if (data.display_name !== undefined) {
    patch.display_name = data.display_name;
  }

  if (touchCpf) {
    const existing = await getProfileById(supabase, user.id);
    let gross =
      existing?.monthly_gross_salary != null
        ? num(existing.monthly_gross_salary)
        : null;
    if (gross === 0) gross = null;

    let band = (existing?.cpf_age_band as SgCpfAgeBand | null) ?? null;

    if (data.monthly_gross_salary !== undefined) {
      const g = data.monthly_gross_salary;
      gross = g == null || g === 0 ? null : g;
    }
    if (data.cpf_age_band !== undefined) {
      band = data.cpf_age_band;
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
      const { takeHome } = monthlyEmployeeCpfTakeHomeSg(gross, ym, band);
      patch.monthly_gross_salary = gross;
      patch.cpf_age_band = band;
      patch.monthly_income = takeHome;
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
  if (data.annual_salary_growth_nominal !== undefined) {
    patch.annual_salary_growth_nominal = data.annual_salary_growth_nominal;
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
