"use server";

import { revalidatePath } from "next/cache";
import {
  advisorCanReadCategory,
  getClientProfileForAdvisor,
} from "@/data/repositories/advisor-clients";
import { assertConsent } from "@/server/advisor-consent";
// Client read-backs MUST route through the consent-gated SECURITY DEFINER
// advisor_read_* RPCs: consent-Phase-2 dropped the advisor's direct SELECT
// RLS on financial_*, so a direct .from() returns "not found" for a
// legitimately-linked advisor and silently breaks authoring (security-Medium).
import { advisorReadBudgetLines } from "@/data/repositories/budget-lines";
import { advisorReadCashAccounts } from "@/data/repositories/cash-accounts";
import { advisorReadGoals } from "@/data/repositories/goals";
import { advisorReadInvestments } from "@/data/repositories/investments";
import { advisorReadHousingLoans } from "@/data/repositories/housing-loans";
import { advisorReadLiabilities } from "@/data/repositories/liabilities";
import { advisorReadProperties } from "@/data/repositories/properties";
import { advisorReadVehicles } from "@/data/repositories/vehicles";
import { advisorReadProfile, getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { recordAdvisorProposalChanges } from "@/server/advisor-proposal-recording";
import {
  getDraftProposalForClient,
  listChangesForProposal,
} from "@/data/repositories/advisor-proposals";
import {
  cashAccountWriteSchema,
  entityNameUniquenessError,
  housingLoanWriteSchema,
  propertyWriteSchema,
  vehicleWriteSchema,
} from "@/lib/validation";
import { parseLiabilityFormData } from "@/server/liability-form";
import type { AdvisorVisibilityCategory } from "@/lib/advisor-visibility";
import { isAdvisor } from "@/lib/profile-role";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

// Names of not-yet-accepted entities of `entityType` already pending in this
// advisor↔client draft. Compose must reject a second new entity that collides
// with one already staged — the DB index only sees them once accepted.
async function pendingCreateNames(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientId: string,
  entityType: AdvisorProposalChangeRow["entity_type"],
  nameFieldKey: string
): Promise<string[]> {
  const draft = await getDraftProposalForClient(supabase, advisorUserId, clientId);
  if (!draft) return [];
  const changes = await listChangesForProposal(supabase, draft.id);
  return changes
    .filter(
      (c) =>
        c.entity_type === entityType &&
        c.change_op === "create" &&
        c.field_key === nameFieldKey &&
        c.new_value != null
    )
    .map((c) => c.new_value as string);
}

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

  const existingInvestmentNames = (
    await advisorReadInvestments(supabase, clientId)
  ).map((i) => i.name);
  const pendingInvestmentNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "investment",
    "name"
  );
  const investmentNameError = entityNameUniquenessError(
    name,
    [...existingInvestmentNames, ...pendingInvestmentNames],
    "an investment"
  );
  if (investmentNameError) return { error: investmentNameError };

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

// Sensitive categories are gated behind the client's per-category visibility
// opt-in (Phase 1) in ADDITION to master consent. The advisor UI hides the
// form when private; this is the server-side backstop.
async function assertCategoryVisible(
  supabase: SupabaseClient,
  clientId: string,
  category: AdvisorVisibilityCategory
): Promise<string | null> {
  const ok = await advisorCanReadCategory(supabase, clientId, category);
  return ok ? null : "This category is private — the client hasn't shared it.";
}

export async function createAdvisorClientCashAccountAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "cash_accounts");
  if (gate) return { error: gate };

  const parsed = cashAccountWriteSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    balance: Number(formData.get("balance")),
    purpose: String(formData.get("purpose") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cash account" };
  }
  const { name, balance, purpose } = parsed.data;

  const existingCashNames = (
    await advisorReadCashAccounts(supabase, clientId)
  ).map((c) => c.name);
  const pendingCashNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "cash_account",
    "name"
  );
  const cashNameError = entityNameUniquenessError(
    name,
    [...existingCashNames, ...pendingCashNames],
    "a cash account"
  );
  if (cashNameError) return { error: cashNameError };

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "name", newValue: name },
    { fieldKey: "balance", newValue: balance },
    { fieldKey: "purpose", newValue: purpose },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "cash_account" as const,
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

export async function updateAdvisorClientCashAccountAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "cash_accounts");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid cash account" };

  const existing =
    (await advisorReadCashAccounts(supabase, clientId)).find(
      (c) => c.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Cash account not found" };

  const parsed = cashAccountWriteSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    balance: Number(formData.get("balance")),
    purpose: String(formData.get("purpose") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid cash account" };
  }
  const { name, balance, purpose } = parsed.data;

  const updates = [
    { fieldKey: "name", oldValue: existing.name, newValue: name },
    { fieldKey: "balance", oldValue: existing.balance, newValue: balance },
    { fieldKey: "purpose", oldValue: existing.purpose, newValue: purpose },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "cash_account" as const,
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

export async function deleteAdvisorClientCashAccountAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "cash_accounts");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid cash account" };

  const existing =
    (await advisorReadCashAccounts(supabase, clientId)).find(
      (c) => c.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Cash account not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "cash_account",
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

export async function createAdvisorClientLiabilityAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "liabilities");
  if (gate) return { error: gate };

  const parsed = parseLiabilityFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  const existingNames = (await advisorReadLiabilities(supabase, clientId)).map(
    (l) => l.name
  );
  const pendingNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "liability",
    "name"
  );
  const nameError = entityNameUniquenessError(
    d.name,
    [...existingNames, ...pendingNames],
    "a liability"
  );
  if (nameError) return { error: nameError };

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "name", newValue: d.name },
    { fieldKey: "balance", newValue: d.balance },
  ];
  if (d.category != null) fields.push({ fieldKey: "category", newValue: d.category });
  if (d.loan_type != null) fields.push({ fieldKey: "loan_type", newValue: d.loan_type });
  if (d.interest_rate_annual != null)
    fields.push({ fieldKey: "interest_rate_annual", newValue: d.interest_rate_annual });
  if (d.remaining_tenure_months != null)
    fields.push({ fieldKey: "remaining_tenure_months", newValue: d.remaining_tenure_months });
  if (d.monthly_repayment != null)
    fields.push({ fieldKey: "monthly_repayment", newValue: d.monthly_repayment });
  if (d.repayment_override) fields.push({ fieldKey: "repayment_override", newValue: "true" });
  if (d.start_date != null) fields.push({ fieldKey: "start_date", newValue: d.start_date });
  if (d.notes != null) fields.push({ fieldKey: "notes", newValue: d.notes });

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "liability" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: d.name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function updateAdvisorClientLiabilityAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "liabilities");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid liability" };

  const existing =
    (await advisorReadLiabilities(supabase, clientId)).find(
      (l) => l.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Liability not found" };

  const parsed = parseLiabilityFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const d = parsed.data;

  // No updated_at on financial_liabilities → no base_version concurrency token
  // (the accept conflict check skips null base_version rows).
  const updates: { fieldKey: string; oldValue: unknown; newValue: unknown }[] = [
    { fieldKey: "name", oldValue: existing.name, newValue: d.name },
    { fieldKey: "balance", oldValue: existing.balance, newValue: d.balance },
    { fieldKey: "category", oldValue: existing.category ?? null, newValue: d.category ?? null },
    { fieldKey: "loan_type", oldValue: existing.loan_type ?? null, newValue: d.loan_type ?? null },
    {
      fieldKey: "interest_rate_annual",
      oldValue: existing.interest_rate_annual ?? null,
      newValue: d.interest_rate_annual ?? null,
    },
    {
      fieldKey: "remaining_tenure_months",
      oldValue: existing.remaining_tenure_months ?? null,
      newValue: d.remaining_tenure_months ?? null,
    },
    {
      fieldKey: "monthly_repayment",
      oldValue: existing.monthly_repayment ?? null,
      newValue: d.monthly_repayment ?? null,
    },
    {
      fieldKey: "repayment_override",
      oldValue: existing.repayment_override ? "true" : null,
      newValue: d.repayment_override ? "true" : null,
    },
    { fieldKey: "start_date", oldValue: existing.start_date ?? null, newValue: d.start_date ?? null },
    { fieldKey: "notes", oldValue: existing.notes ?? null, newValue: d.notes ?? null },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "liability" as const,
        entityId: idParsed.data,
        fieldKey: u.fieldKey,
        oldValue: u.oldValue,
        newValue: u.newValue,
        contextLabel: d.name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function deleteAdvisorClientLiabilityAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "liabilities");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid liability" };

  const existing =
    (await advisorReadLiabilities(supabase, clientId)).find(
      (l) => l.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Liability not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "liability",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        contextLabel: existing.name,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

function optionalFormNumber(formData: FormData, key: string): number | null {
  const s = String(formData.get(key) ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePropertyForm(formData: FormData) {
  const ownershipRaw = optionalFormNumber(formData, "ownership_percent");
  const rentalRaw = optionalFormNumber(formData, "rental_income_monthly");
  return propertyWriteSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    property_type: String(formData.get("property_type") ?? "unknown").trim(),
    purchase_price: optionalFormNumber(formData, "purchase_price"),
    current_valuation: optionalFormNumber(formData, "current_valuation"),
    ownership_percent: ownershipRaw ?? 100,
    status: String(formData.get("status") ?? "living_in").trim(),
    rental_income_monthly: rentalRaw ?? 0,
    planning_scope: String(formData.get("planning_scope") ?? "current").trim(),
  });
}

function parseHousingLoanForm(formData: FormData) {
  const ratePct = optionalFormNumber(formData, "interest_rate_percent");
  const propertyIdRaw = String(formData.get("property_id") ?? "").trim();
  return housingLoanWriteSchema.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    property_id: propertyIdRaw === "" ? null : propertyIdRaw,
    principal: Number(formData.get("principal")),
    annual_nominal_rate: ratePct != null ? ratePct / 100 : 0,
    term_months: Number(formData.get("term_months")),
    first_payment_month: String(formData.get("first_payment_month") ?? "").trim(),
    lender_type: String(formData.get("lender_type") ?? "bank").trim(),
  });
}

export async function createAdvisorClientHousingLoanAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "housing_loans");
  if (gate) return { error: gate };

  const parsed = parseHousingLoanForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid housing loan" };
  }
  const d = parsed.data;

  // Name field is `label`.
  const existingNames = (await advisorReadHousingLoans(supabase, clientId)).map(
    (h) => h.label
  );
  const pendingNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "housing_loan",
    "label"
  );
  const nameError = entityNameUniquenessError(
    d.label,
    [...existingNames, ...pendingNames],
    "a housing loan"
  );
  if (nameError) return { error: nameError };

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "label", newValue: d.label },
    { fieldKey: "principal", newValue: d.principal },
    { fieldKey: "annual_nominal_rate", newValue: d.annual_nominal_rate },
    { fieldKey: "term_months", newValue: d.term_months },
    { fieldKey: "first_payment_month", newValue: d.first_payment_month },
    { fieldKey: "lender_type", newValue: d.lender_type },
  ];
  if (d.property_id != null)
    fields.push({ fieldKey: "property_id", newValue: d.property_id });

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "housing_loan" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: d.label,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function updateAdvisorClientHousingLoanAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "housing_loans");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid housing loan" };

  const existing =
    (await advisorReadHousingLoans(supabase, clientId)).find(
      (h) => h.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Housing loan not found" };

  const parsed = parseHousingLoanForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid housing loan" };
  }
  const d = parsed.data;

  // No updated_at on financial_housing_loans → no base_version token.
  const ratePct =
    existing.annual_nominal_rate != null
      ? Number(existing.annual_nominal_rate)
      : null;
  const updates: { fieldKey: string; oldValue: unknown; newValue: unknown }[] = [
    { fieldKey: "label", oldValue: existing.label, newValue: d.label },
    {
      fieldKey: "property_id",
      oldValue: existing.property_id ?? null,
      newValue: d.property_id ?? null,
    },
    { fieldKey: "principal", oldValue: existing.principal, newValue: d.principal },
    {
      fieldKey: "annual_nominal_rate",
      oldValue: ratePct,
      newValue: d.annual_nominal_rate,
    },
    { fieldKey: "term_months", oldValue: existing.term_months, newValue: d.term_months },
    {
      fieldKey: "first_payment_month",
      oldValue: existing.first_payment_month,
      newValue: d.first_payment_month,
    },
    { fieldKey: "lender_type", oldValue: existing.lender_type, newValue: d.lender_type },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "housing_loan" as const,
        entityId: idParsed.data,
        fieldKey: u.fieldKey,
        oldValue: u.oldValue,
        newValue: u.newValue,
        contextLabel: d.label,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function deleteAdvisorClientHousingLoanAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "housing_loans");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid housing loan" };

  const existing =
    (await advisorReadHousingLoans(supabase, clientId)).find(
      (h) => h.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Housing loan not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "housing_loan",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        contextLabel: existing.label,
      },
    ]);
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function createAdvisorClientPropertyAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "properties");
  if (gate) return { error: gate };

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid property" };
  }
  const d = parsed.data;

  const existingNames = (await advisorReadProperties(supabase, clientId)).map(
    (p) => p.name
  );
  const pendingNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "property",
    "name"
  );
  const nameError = entityNameUniquenessError(
    d.name,
    [...existingNames, ...pendingNames],
    "a property"
  );
  if (nameError) return { error: nameError };

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "name", newValue: d.name },
    { fieldKey: "property_type", newValue: d.property_type },
    { fieldKey: "ownership_percent", newValue: d.ownership_percent },
    { fieldKey: "status", newValue: d.status },
    { fieldKey: "rental_income_monthly", newValue: d.rental_income_monthly },
    { fieldKey: "planning_scope", newValue: d.planning_scope },
  ];
  if (d.purchase_price != null)
    fields.push({ fieldKey: "purchase_price", newValue: d.purchase_price });
  if (d.current_valuation != null)
    fields.push({ fieldKey: "current_valuation", newValue: d.current_valuation });

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "property" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: d.name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function updateAdvisorClientPropertyAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "properties");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid property" };

  const existing =
    (await advisorReadProperties(supabase, clientId)).find(
      (p) => p.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Property not found" };

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid property" };
  }
  const d = parsed.data;

  const updates: { fieldKey: string; oldValue: unknown; newValue: unknown }[] = [
    { fieldKey: "name", oldValue: existing.name, newValue: d.name },
    { fieldKey: "property_type", oldValue: existing.property_type, newValue: d.property_type },
    {
      fieldKey: "purchase_price",
      oldValue: existing.purchase_price ?? null,
      newValue: d.purchase_price ?? null,
    },
    {
      fieldKey: "current_valuation",
      oldValue: existing.current_valuation ?? null,
      newValue: d.current_valuation ?? null,
    },
    {
      fieldKey: "ownership_percent",
      oldValue: existing.ownership_percent,
      newValue: d.ownership_percent,
    },
    { fieldKey: "status", oldValue: existing.status, newValue: d.status },
    {
      fieldKey: "rental_income_monthly",
      oldValue: existing.rental_income_monthly,
      newValue: d.rental_income_monthly,
    },
    {
      fieldKey: "planning_scope",
      oldValue: existing.planning_scope,
      newValue: d.planning_scope,
    },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "property" as const,
        entityId: idParsed.data,
        fieldKey: u.fieldKey,
        oldValue: u.oldValue,
        newValue: u.newValue,
        baseVersion: existing.updated_at ?? null,
        contextLabel: d.name,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function deleteAdvisorClientPropertyAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "properties");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid property" };

  const existing =
    (await advisorReadProperties(supabase, clientId)).find(
      (p) => p.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Property not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "property",
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

function parseVehicleForm(formData: FormData) {
  return vehicleWriteSchema.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    vehicle_status:
      String(formData.get("vehicle_status") ?? "").trim() === "planned"
        ? "planned"
        : "active",
    current_market_value: optionalFormNumber(formData, "current_market_value"),
    on_the_road_paid: optionalFormNumber(formData, "on_the_road_paid"),
    loan_balance: optionalFormNumber(formData, "loan_balance"),
    loan_monthly_payment: optionalFormNumber(formData, "loan_monthly_payment"),
    loan_months_remaining: optionalFormNumber(formData, "loan_months_remaining"),
  });
}

export async function createAdvisorClientVehicleAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "vehicles");
  if (gate) return { error: gate };

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle" };
  }
  const d = parsed.data;

  // Name field is `label`.
  const existingNames = (await advisorReadVehicles(supabase, clientId)).map(
    (v) => v.label
  );
  const pendingNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "vehicle",
    "label"
  );
  const nameError = entityNameUniquenessError(
    d.label,
    [...existingNames, ...pendingNames],
    "a vehicle"
  );
  if (nameError) return { error: nameError };

  const draftEntityKey = randomUUID();
  const fields: { fieldKey: string; newValue: string | number }[] = [
    { fieldKey: "label", newValue: d.label },
    { fieldKey: "vehicle_status", newValue: d.vehicle_status },
  ];
  if (d.current_market_value != null)
    fields.push({ fieldKey: "current_market_value", newValue: d.current_market_value });
  if (d.on_the_road_paid != null)
    fields.push({ fieldKey: "on_the_road_paid", newValue: d.on_the_road_paid });
  if (d.loan_balance != null)
    fields.push({ fieldKey: "loan_balance", newValue: d.loan_balance });
  if (d.loan_monthly_payment != null)
    fields.push({ fieldKey: "loan_monthly_payment", newValue: d.loan_monthly_payment });
  if (d.loan_months_remaining != null)
    fields.push({ fieldKey: "loan_months_remaining", newValue: d.loan_months_remaining });

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      fields.map((f) => ({
        entityType: "vehicle" as const,
        entityId: null,
        fieldKey: f.fieldKey,
        oldValue: null,
        newValue: f.newValue,
        changeOp: "create" as const,
        draftEntityKey,
        contextLabel: d.label,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function updateAdvisorClientVehicleAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "vehicles");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid vehicle" };

  const existing =
    (await advisorReadVehicles(supabase, clientId)).find(
      (v) => v.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Vehicle not found" };

  const parsed = parseVehicleForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid vehicle" };
  }
  const d = parsed.data;

  // financial_vehicles has no updated_at → no base_version concurrency token.
  const updates: { fieldKey: string; oldValue: unknown; newValue: unknown }[] = [
    { fieldKey: "label", oldValue: existing.label, newValue: d.label },
    { fieldKey: "vehicle_status", oldValue: existing.vehicle_status, newValue: d.vehicle_status },
    {
      fieldKey: "current_market_value",
      oldValue: existing.current_market_value ?? null,
      newValue: d.current_market_value ?? null,
    },
    {
      fieldKey: "on_the_road_paid",
      oldValue: existing.on_the_road_paid,
      newValue: d.on_the_road_paid ?? null,
    },
    {
      fieldKey: "loan_balance",
      oldValue: existing.loan_balance,
      newValue: d.loan_balance ?? null,
    },
    {
      fieldKey: "loan_monthly_payment",
      oldValue: existing.loan_monthly_payment,
      newValue: d.loan_monthly_payment ?? null,
    },
    {
      fieldKey: "loan_months_remaining",
      oldValue: existing.loan_months_remaining ?? null,
      newValue: d.loan_months_remaining ?? null,
    },
  ];

  try {
    await recordAdvisorProposalChanges(
      supabase,
      advisorUserId,
      clientId,
      updates.map((u) => ({
        entityType: "vehicle" as const,
        entityId: idParsed.data,
        fieldKey: u.fieldKey,
        oldValue: u.oldValue,
        newValue: u.newValue,
        contextLabel: d.label,
      }))
    );
  } catch (e) {
    return { error: clientErrorFromUnknown(e) };
  }

  revalidateAdvisorClientViews(clientId);
  return { error: null, proposalRecorded: true };
}

export async function deleteAdvisorClientVehicleAction(
  _prev: { error: string | null; proposalRecorded?: boolean },
  formData: FormData
): Promise<{ error: string | null; proposalRecorded?: boolean }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) return { error: "Missing client" };

  const ctx = await requireAdvisorLinkedClient(clientId);
  if (!ctx.ok) return { error: ctx.error };
  const { supabase, advisorUserId } = ctx;

  const gate = await assertCategoryVisible(supabase, clientId, "vehicles");
  if (gate) return { error: gate };

  const idParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid vehicle" };

  const existing =
    (await advisorReadVehicles(supabase, clientId)).find(
      (v) => v.id === idParsed.data
    ) ?? null;
  if (!existing) return { error: "Vehicle not found" };

  try {
    await recordAdvisorProposalChanges(supabase, advisorUserId, clientId, [
      {
        entityType: "vehicle",
        entityId: idParsed.data,
        fieldKey: "_deleted",
        oldValue: null,
        newValue: "true",
        changeOp: "delete" as const,
        contextLabel: existing.label,
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

  const existingGoalNames = (await advisorReadGoals(supabase, clientId)).map(
    (g) => g.title
  );
  const pendingGoalNames = await pendingCreateNames(
    supabase,
    advisorUserId,
    clientId,
    "goal",
    "title"
  );
  const goalNameError = entityNameUniquenessError(
    title,
    [...existingGoalNames, ...pendingGoalNames],
    "a goal"
  );
  if (goalNameError) return { error: goalNameError };

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
