"use server";

import { revalidatePath } from "next/cache";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import { assertConsent } from "@/server/advisor-consent";
// Client read-backs MUST route through the consent-gated SECURITY DEFINER
// advisor_read_* RPCs: consent-Phase-2 dropped the advisor's direct SELECT
// RLS on financial_*, so a direct .from() returns "not found" for a
// legitimately-linked advisor and silently breaks authoring (security-Medium).
import { advisorReadBudgetLines } from "@/data/repositories/budget-lines";
import { advisorReadGoals } from "@/data/repositories/goals";
import { advisorReadInvestments } from "@/data/repositories/investments";
import { advisorReadProfile, getProfileById } from "@/data/repositories/profiles";
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

function parseInvestmentPlanningFields(formData: FormData):
  | {
      ok: true;
      contribution_type: string | null;
      contribution_duration_years: number | null;
      contribution_growth_annual: number;
      withdrawal_monthly: number;
      withdrawal_start_years: number | null;
    }
  | { ok: false; error: string } {
  const contributionTypeRaw = String(formData.get("contribution_type") ?? "").trim();
  const isFixed = contributionTypeRaw === "fixed_duration";

  let contribution_type: string | null = null;
  let contribution_duration_years: number | null = null;
  if (isFixed) {
    const y = Number(formData.get("contribution_duration_years"));
    if (!Number.isFinite(y) || y <= 0 || y > 80) {
      return {
        ok: false,
        error: "Enter contribution duration in years (between 0.25 and 80)",
      };
    }
    contribution_type = "fixed_duration";
    contribution_duration_years = y;
  } else if (contributionTypeRaw === "until_retirement") {
    contribution_type = "until_retirement";
  }

  const contributionGrowthAnnual = Number(
    formData.get("contribution_growth_annual") ?? 0
  );
  if (
    !Number.isFinite(contributionGrowthAnnual) ||
    contributionGrowthAnnual < 0 ||
    contributionGrowthAnnual > 1
  ) {
    return { ok: false, error: "Contribution step-up must be 0–100%." };
  }

  const withdrawalMonthly = Number(formData.get("withdrawal_monthly") ?? 0);
  if (!Number.isFinite(withdrawalMonthly) || withdrawalMonthly < 0) {
    return { ok: false, error: "Invalid monthly withdrawal" };
  }

  const withdrawalStartRaw = String(
    formData.get("withdrawal_start_years") ?? ""
  ).trim();
  const withdrawalStartYears =
    withdrawalStartRaw === "" ? null : Number(withdrawalStartRaw);
  if (
    withdrawalStartYears != null &&
    (!Number.isFinite(withdrawalStartYears) || withdrawalStartYears < 0)
  ) {
    return { ok: false, error: "Withdrawal start must be 0 or more years." };
  }

  return {
    ok: true,
    contribution_type,
    contribution_duration_years,
    contribution_growth_annual: contributionGrowthAnnual,
    withdrawal_monthly: withdrawalMonthly,
    withdrawal_start_years: withdrawalStartYears,
  };
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
  // me + linkage + consent are independent reads (clientId is a param, the
  // advisor is the session user) — batch them.
  const [me, row, consent] = await Promise.all([
    getProfileById(supabase, user.id),
    getClientProfileForAdvisor(supabase, user.id, clientId),
    // Consent-first trust boundary: the advisor is resolved server-side from
    // the session above — never from client-supplied input.
    assertConsent(supabase, clientId),
  ]);
  if (!isAdvisor(me)) {
    return { ok: false, error: "Not allowed" };
  }
  if (!row) {
    return { ok: false, error: "Client not found" };
  }
  if (!consent.ok) return { ok: false, error: consent.error };
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

  const profile = await advisorReadProfile(supabase, clientId);
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
    // Capture the profile's version at suggest-time so accept can detect a
    // client interim edit (B4 optimistic concurrency). All rows target the
    // one profile, so they share its version.
    const baseVersion = profile.updated_at ?? null;
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      changes.map((c) => ({ ...c, baseVersion }))
    );
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

  const line =
    (await advisorReadBudgetLines(supabase, clientId)).find(
      (b) => b.id === lineId
    ) ?? null;
  if (!line) return { error: "Budget line not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "budget_line",
        entityId: lineId,
        fieldKey: "amount",
        oldValue: line.amount,
        newValue: amount,
        baseVersion: line.updated_at ?? null,
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

  const goal =
    (await advisorReadGoals(supabase, clientId)).find(
      (g) => g.id === goalId
    ) ?? null;
  if (!goal) return { error: "Goal not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "goal",
        entityId: goalId,
        fieldKey: "monthly_contribution",
        oldValue: goal.monthly_contribution,
        newValue: monthly_contribution,
        baseVersion: goal.updated_at ?? null,
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

  const planning = parseInvestmentPlanningFields(formData);
  if (!planning.ok) return { error: planning.error };

  // Explicit change_op='create' grouped by a server draft_entity_key (no
  // entity_id yet) — symmetric with budget/goal create; no reliance on the
  // fragile all-null legacy heuristic. base_version stays null (nothing to
  // conflict against for a brand-new entity).
  const draftEntityKey = randomUUID();
  const fields = [
    { fieldKey: "name", newValue: name },
    { fieldKey: "current_value", newValue: currentValue },
    { fieldKey: "monthly_contribution", newValue: monthlyContribution },
    { fieldKey: "expected_annual_return", newValue: expectedAnnualReturn },
    { fieldKey: "contribution_type", newValue: planning.contribution_type },
    {
      fieldKey: "contribution_duration_years",
      newValue: planning.contribution_duration_years,
    },
    {
      fieldKey: "contribution_growth_annual",
      newValue: planning.contribution_growth_annual,
    },
    { fieldKey: "withdrawal_monthly", newValue: planning.withdrawal_monthly },
    {
      fieldKey: "withdrawal_start_years",
      newValue: planning.withdrawal_start_years,
    },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "investment" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
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

  const existing =
    (await advisorReadInvestments(supabase, clientId)).find(
      (i) => i.id === idParsed.data
    ) ?? null;
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

  const planning = parseInvestmentPlanningFields(formData);
  if (!planning.ok) return { error: planning.error };

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
      newValue: planning.contribution_type,
    },
    {
      fieldKey: "contribution_duration_years",
      oldValue: existing.contribution_duration_years,
      newValue: planning.contribution_duration_years,
    },
    {
      fieldKey: "contribution_growth_annual",
      oldValue: existing.contribution_growth_annual,
      newValue: planning.contribution_growth_annual,
    },
    {
      fieldKey: "withdrawal_monthly",
      oldValue: existing.withdrawal_monthly,
      newValue: planning.withdrawal_monthly,
    },
    {
      fieldKey: "withdrawal_start_years",
      oldValue: existing.withdrawal_start_years,
      newValue: planning.withdrawal_start_years,
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
        baseVersion: existing.updated_at ?? null,
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

  const existing =
    (await advisorReadInvestments(supabase, clientId)).find(
      (i) => i.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Investment not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "investment",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        baseVersion: existing.updated_at ?? null,
        contextLabel: existing.name,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

/**
 * Compose a NEW budget line into the advisor's draft proposal. Explicit
 * change_op='create' grouped by a server-generated draft_entity_key (no
 * entity_id yet). Advisor budget management is monthly-only, so cadence is
 * fixed. Backend fails loud on missing required fields (e.g. category).
 */
export async function createAdvisorClientBudgetLineAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount"));
  if (!category) return { error: "Category is required" };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "category", newValue: category },
    { fieldKey: "amount", newValue: amount },
    { fieldKey: "cadence", newValue: "monthly" },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "budget_line" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: category,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

/**
 * Compose a NEW goal into the advisor's draft proposal. Explicit
 * change_op='create' grouped by a server-generated draft_entity_key.
 * Backend fails loud on missing required fields (e.g. title).
 */
export async function createAdvisorClientGoalAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const title = String(formData.get("title") ?? "").trim();
  const targetAmount = Number(formData.get("target_amount"));
  const monthlyContribution = Number(formData.get("monthly_contribution"));
  if (!title) return { error: "Goal name is required" };
  if (!Number.isFinite(targetAmount) || targetAmount < 0) {
    return { error: "Invalid target amount" };
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    return { error: "Invalid monthly contribution" };
  }

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "title", newValue: title },
    { fieldKey: "target_amount", newValue: targetAmount },
    { fieldKey: "monthly_contribution", newValue: monthlyContribution },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "goal" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: title,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

/**
 * Propose removal of an EXISTING goal (R-DEL). Explicit change_op='delete' +
 * base_version so accept conflict-guards the removal (a goal edited by the
 * client underneath surfaces a conflict instead of being silently deleted).
 * Mirrors deleteAdvisorClientInvestmentAction.
 */
export async function deleteAdvisorClientGoalAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("goal_id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid goal" };

  const existing =
    (await advisorReadGoals(supabase, clientId)).find(
      (g) => g.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Goal not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "goal",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        baseVersion: existing.updated_at ?? null,
        contextLabel: existing.title,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

/**
 * Propose removal of an EXISTING budget line (R-DEL). Explicit
 * change_op='delete' + base_version (conflict-guarded). Mirrors
 * deleteAdvisorClientInvestmentAction.
 */
export async function deleteAdvisorClientBudgetLineAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid budget line" };

  const existing =
    (await advisorReadBudgetLines(supabase, clientId)).find(
      (b) => b.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Budget line not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "budget_line",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        baseVersion: existing.updated_at ?? null,
        contextLabel: existing.category,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}
