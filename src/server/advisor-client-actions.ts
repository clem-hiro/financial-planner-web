"use server";

import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { updateBudgetLine } from "@/data/repositories/budget-lines";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import { updateFinancialGoal } from "@/data/repositories/goals";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isAdvisor } from "@/lib/profile-role";

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
