"use server";

import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import {
  advisorCanReadClient,
  getClientProfileForAdvisor,
} from "@/data/repositories/advisor-clients";
import { getBudgetLineById } from "@/data/repositories/budget-lines";
import { getFinancialGoalById } from "@/data/repositories/goals";
import { getInvestmentById } from "@/data/repositories/investments";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { recordAdvisorProposalChanges } from "@/server/advisor-proposal-recording";
import { isAdvisor } from "@/lib/profile-role";
import { z } from "zod";
import { randomUUID } from "crypto";

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
}

async function requireAdvisorLinkedClient(
  clientId: string
): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      advisorUserId: string;
    }
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
  // Consent-first trust boundary: the advisor (resolved server-side from the
  // session above — never from client-supplied input) cannot author proposals
  // until this client has granted active consent. UI gating is secondary.
  const consentOk = await advisorCanReadClient(supabase, clientId);
  if (!consentOk) {
    return {
      ok: false,
      error: "This client has not granted consent. Suggestions are unavailable until they do.",
    };
  }
  return { ok: true, supabase, advisorUserId: user.id };
}

export async function patchAdvisorClientProfileAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const profile = await getProfileById(supabase, clientId);
  if (!profile) return { error: "Client profile not found" };

  const changes: Parameters<typeof recordAdvisorProposalChanges>[3] = [];

  const display_name = formData.get("display_name");
  if (display_name !== null) {
    const v = String(display_name).trim();
    changes.push({
      entityType: "profile",
      entityId: null,
      fieldKey: "display_name",
      oldValue: profile.display_name,
      newValue: v || null,
    });
  }
  const monthly_income = formData.get("monthly_income");
  if (monthly_income !== null && monthly_income !== "") {
    const n = Number(monthly_income);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid monthly income" };
    changes.push({
      entityType: "profile",
      entityId: null,
      fieldKey: "monthly_income",
      oldValue: profile.monthly_income,
      newValue: n,
    });
  }
  const savings_target_monthly = formData.get("savings_target_monthly");
  if (savings_target_monthly !== null && savings_target_monthly !== "") {
    const n = Number(savings_target_monthly);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid savings target" };
    changes.push({
      entityType: "profile",
      entityId: null,
      fieldKey: "savings_target_monthly",
      oldValue: profile.savings_target_monthly,
      newValue: n,
    });
  }
  const fixed_expenses_monthly = formData.get("fixed_expenses_monthly");
  if (fixed_expenses_monthly !== null && fixed_expenses_monthly !== "") {
    const n = Number(fixed_expenses_monthly);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid fixed expenses" };
    changes.push({
      entityType: "profile",
      entityId: null,
      fieldKey: "fixed_expenses_monthly",
      oldValue: profile.fixed_expenses_monthly,
      newValue: n,
    });
  }
  const monthly_gross_salary = formData.get("monthly_gross_salary");
  if (monthly_gross_salary !== null && monthly_gross_salary !== "") {
    const n = Number(monthly_gross_salary);
    if (!Number.isFinite(n) || n < 0) return { error: "Invalid gross salary" };
    changes.push({
      entityType: "profile",
      entityId: null,
      fieldKey: "monthly_gross_salary",
      oldValue: profile.monthly_gross_salary,
      newValue: n,
    });
  }

  if (changes.length === 0) {
    return { error: "Nothing to update" };
  }

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, changes);
  } catch (e) {
    console.error(e);
    return { error: "Could not save suggestion" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function patchAdvisorClientBudgetLineAmountAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  const lineId = String(formData.get("id") ?? "").trim();
  const amount = Number(formData.get("amount"));
  if (!clientId || !lineId) return { error: "Missing fields" };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const line = await getBudgetLineById(supabase, clientId, lineId);
  if (!line) return { error: "Budget line not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "budget_line",
        entityId: lineId,
        fieldKey: "amount",
        oldValue: line.amount,
        newValue: amount,
        contextLabel: line.category,
      },
    ]);
  } catch (e) {
    console.error(e);
    return { error: "Could not save suggestion" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function patchAdvisorClientGoalMonthlyContributionAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
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
  const { supabase, advisorUserId } = ctx;

  const goal = await getFinancialGoalById(supabase, clientId, goalId);
  if (!goal) return { error: "Goal not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "goal",
        entityId: goalId,
        fieldKey: "monthly_contribution",
        oldValue: goal.monthly_contribution,
        newValue: monthly_contribution,
        contextLabel: goal.title,
      },
    ]);
  } catch (e) {
    console.error(e);
    return { error: "Could not save suggestion" };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function createAdvisorClientInvestmentAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

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

  const contributionTypeRaw = String(formData.get("contribution_type") ?? "").trim();
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

  const placeholderId = randomUUID();
  const fields = [
    { fieldKey: "name", newValue: name },
    { fieldKey: "current_value", newValue: currentValue },
    { fieldKey: "monthly_contribution", newValue: monthlyContribution },
    { fieldKey: "expected_annual_return", newValue: expectedAnnualReturn },
    { fieldKey: "contribution_type", newValue: contribution_type },
    { fieldKey: "contribution_duration_years", newValue: contribution_duration_years },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "investment" as const,
        entityId: placeholderId,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        contextLabel: name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function updateAdvisorClientInvestmentAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const idRaw = String(formData.get("id") ?? "").trim();
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) {
    return { error: "Invalid investment" };
  }

  const existing = await getInvestmentById(supabase, clientId, idParsed.data);
  if (!existing) return { error: "Investment not found" };

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

  const contributionTypeRaw = String(formData.get("contribution_type") ?? "").trim();
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

  const updates = [
    { fieldKey: "name", oldValue: existing.name, newValue: name },
    { fieldKey: "current_value", oldValue: existing.current_value, newValue: currentValue },
    {
      fieldKey: "monthly_contribution",
      oldValue: existing.monthly_contribution,
      newValue: monthlyContribution,
    },
    {
      fieldKey: "expected_annual_return",
      oldValue: existing.expected_annual_return,
      newValue: expectedAnnualReturn,
    },
    {
      fieldKey: "contribution_type",
      oldValue: existing.contribution_type,
      newValue: contribution_type,
    },
    {
      fieldKey: "contribution_duration_years",
      oldValue: existing.contribution_duration_years,
      newValue: contribution_duration_years,
    },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "investment" as const,
        entityId: idParsed.data,
        fieldKey: u.fieldKey,
        oldValue: u.oldValue,
        newValue: u.newValue,
        contextLabel: name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function deleteAdvisorClientInvestmentAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const idRaw = String(formData.get("id") ?? "").trim();
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) {
    return { error: "Invalid investment" };
  }

  const existing = await getInvestmentById(supabase, clientId, idParsed.data);
  if (!existing) return { error: "Investment not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "investment",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        contextLabel: existing.name,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}
