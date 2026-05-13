"use server";

import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { updateBudgetLine } from "@/data/repositories/budget-lines";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import { updateFinancialGoal } from "@/data/repositories/goals";
import {
  deleteInvestment,
  insertInvestment,
  updateInvestment,
} from "@/data/repositories/investments";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isAdvisor } from "@/lib/profile-role";
import { z } from "zod";

function clientErrorFromUnknown(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "Something went wrong while saving. Please try again.";
}

function revalidateAdvisorClientViews(clientId: string) {
  revalidatePath("/advisor/clients");
  revalidatePath(`/advisor/client/${clientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
}

async function requireAdvisorLinkedClient(
  clientId: string
): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required" };
  }
  const me = await getProfileById(supabase, user.id);
  if (!isAdvisor(me)) {
    return { ok: false, error: "Not allowed" };
  }
  const row = await getClientProfileForAdvisor(supabase, user.id, clientId);
  if (!row) {
    return { ok: false, error: "Client not found" };
  }
  return { ok: true, supabase };
}

export async function patchAdvisorClientProfileAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  const display_name = formData.get("display_name");
  const monthly_income = formData.get("monthly_income");
  const savings_target_monthly = formData.get("savings_target_monthly");
  const fixed_expenses_monthly = formData.get("fixed_expenses_monthly");
  const monthly_gross_salary = formData.get("monthly_gross_salary");

  const patch: Parameters<typeof updateProfile>[2] = {};

  if (display_name !== null) {
    const v = String(display_name).trim();
    patch.display_name = v || null;
  }
  if (monthly_income !== null && monthly_income !== "") {
    const n = Number(monthly_income);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid monthly income" };
    patch.monthly_income = n;
  }
  if (savings_target_monthly !== null && savings_target_monthly !== "") {
    const n = Number(savings_target_monthly);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid savings target" };
    patch.savings_target_monthly = n;
  }
  if (fixed_expenses_monthly !== null && fixed_expenses_monthly !== "") {
    const n = Number(fixed_expenses_monthly);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid fixed expenses" };
    patch.fixed_expenses_monthly = n;
  }
  if (monthly_gross_salary !== null && monthly_gross_salary !== "") {
    const n = Number(monthly_gross_salary);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid gross salary" };
    patch.monthly_gross_salary = n;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "Nothing to update" };
  }

  try {
    await updateProfile(supabase, clientId, patch);
  } catch (e) {
    console.error(e);
    return { error: "Could not update profile" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}

export async function patchAdvisorClientBudgetLineAmountAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const lineId = String(formData.get("id") ?? "").trim();
  const amount = Number(formData.get("amount"));
  if (!clientId || !lineId) return { error: "Missing fields" };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  try {
    await updateBudgetLine(supabase, clientId, lineId, { amount });
  } catch (e) {
    console.error(e);
    return { error: "Could not update budget line" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}

export async function patchAdvisorClientGoalMonthlyContributionAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const goalId = String(formData.get("goal_id") ?? "").trim();
  const raw = formData.get("monthly_contribution");
  if (!clientId || !goalId) return { error: "Missing fields" };
  const monthly_contribution = Number(raw);
  if (!Number.isFinite(monthly_contribution) || monthly_contribution < 0) {
    return { error: "Invalid contribution" };
  }

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  try {
    await updateFinancialGoal(supabase, clientId, goalId, {
      monthly_contribution,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not update goal" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}

export async function createAdvisorClientInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  const name = String(formData.get("name") ?? "").trim();
  const currentValue = Number(formData.get("current_value"));
  const monthlyContribution = Number(formData.get("monthly_contribution"));
  const expectedAnnualReturn = Number(formData.get("expected_annual_return"));

  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return { error: "Invalid current value" };
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    return { error: "Invalid monthly contribution" };
  }
  if (
    !Number.isFinite(expectedAnnualReturn) ||
    expectedAnnualReturn < 0 ||
    expectedAnnualReturn > 1
  ) {
    return { error: "Invalid expected return (use 0–1, e.g. 0.07)" };
  }

  const contributionTypeRaw = String(
    formData.get("contribution_type") ?? ""
  ).trim();
  const isFixed = contributionTypeRaw === "fixed_duration";

  let contribution_type: string | null = null;
  let contribution_duration_years: number | null = null;
  if (isFixed) {
    const y = Number(formData.get("contribution_duration_years"));
    if (!Number.isFinite(y) || y <= 0 || y > 80) {
      return {
        error: "Enter contribution duration in years (between 0.25 and 80)",
      };
    }
    contribution_type = "fixed_duration";
    contribution_duration_years = y;
  } else if (contributionTypeRaw === "until_retirement") {
    contribution_type = "until_retirement";
  }

  try {
    await insertInvestment(supabase, clientId, {
      name,
      current_value: currentValue,
      monthly_contribution: monthlyContribution,
      expected_annual_return: expectedAnnualReturn,
      contribution_type,
      contribution_duration_years,
    });
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}

export async function updateAdvisorClientInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  const idRaw = String(formData.get("id") ?? "").trim();
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) {
    return { error: "Invalid investment" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const currentValue = Number(formData.get("current_value"));
  const monthlyContribution = Number(formData.get("monthly_contribution"));
  const expectedAnnualReturn = Number(formData.get("expected_annual_return"));

  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(currentValue) || currentValue < 0) {
    return { error: "Invalid current value" };
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    return { error: "Invalid monthly contribution" };
  }
  if (
    !Number.isFinite(expectedAnnualReturn) ||
    expectedAnnualReturn < 0 ||
    expectedAnnualReturn > 1
  ) {
    return { error: "Invalid expected return (use 0–1, e.g. 0.07)" };
  }

  const contributionTypeRaw = String(
    formData.get("contribution_type") ?? ""
  ).trim();
  const isFixed = contributionTypeRaw === "fixed_duration";

  let contribution_type: string | null = null;
  let contribution_duration_years: number | null = null;
  if (isFixed) {
    const y = Number(formData.get("contribution_duration_years"));
    if (!Number.isFinite(y) || y <= 0 || y > 80) {
      return {
        error: "Enter contribution duration in years (between 0.25 and 80)",
      };
    }
    contribution_type = "fixed_duration";
    contribution_duration_years = y;
  } else if (contributionTypeRaw === "until_retirement") {
    contribution_type = "until_retirement";
  }

  try {
    await updateInvestment(supabase, clientId, idParsed.data, {
      name,
      current_value: currentValue,
      monthly_contribution: monthlyContribution,
      expected_annual_return: expectedAnnualReturn,
      contribution_type,
      contribution_duration_years,
    });
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}

export async function deleteAdvisorClientInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase } = ctx;

  const idRaw = String(formData.get("id") ?? "").trim();
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) {
    return { error: "Invalid investment" };
  }

  try {
    await deleteInvestment(supabase, clientId, idParsed.data);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null };
}
