"use server";

import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { redirect } from "next/navigation";
import {
  deleteBudgetLineMonthOverride,
  upsertBudgetLineMonthOverride,
} from "@/data/repositories/budget-line-overrides";
import {
  deleteBudgetLine,
  insertBudgetLine,
  listBudgetLines,
  updateBudgetLine,
} from "@/data/repositories/budget-lines";
import { getProfileById, updateProfile } from "@/data/repositories/profiles";
import { profileSalaryTakeHomeMonthly } from "@/data/mappers";
import { isValidYearMonth } from "@/domain/finance";
import { formatYearMonth } from "@/lib/dates";
import {
  generateGuidedMonthlyBudgetLines,
  isPreservedOnGuidedBudgetReplace,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
} from "@/domain/finance/budget-guided-setup";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  insertFinancialGoal,
  reorderFinancialGoal,
  updateFinancialGoal,
} from "@/data/repositories/goals";
import {
  deleteCashAccount,
  insertCashAccount,
  updateCashAccount,
} from "@/data/repositories/cash-accounts";
import {
  deleteLiability,
  insertLiability,
  updateLiability,
} from "@/data/repositories/liabilities";
import {
  removeLiabilityBudgetLines,
  syncLiabilityBudgetLine,
} from "@/data/liability-budget-sync";
import { parseLiabilityFormData } from "@/server/liability-form";
import {
  deleteVehicle,
  insertVehicle,
  updateVehicle,
} from "@/data/repositories/vehicles";
import {
  deleteCpfBalance,
  upsertCpfBalance,
} from "@/data/repositories/cpf-balances";
import {
  deleteHousingLoan,
  insertHousingLoan,
  updateHousingLoan,
} from "@/data/repositories/housing-loans";
import {
  deleteProperty,
  insertProperty,
  updateProperty,
} from "@/data/repositories/properties";
import {
  deleteInvestment,
  insertInvestment,
  updateInvestment,
} from "@/data/repositories/investments";
import { acknowledgeInvestmentReview } from "@/server/inbox/acknowledge-investment-review";
import { acknowledgeCpfRulesReview } from "@/server/inbox/acknowledge-cpf-rules-review";
import {
  deriveQuickHousingLoanRow,
  HDB_CONCESSIONARY_RATE_ANNUAL,
  oaInstalmentShareFromPreset,
} from "@/domain/finance/housing-loan-quick";
import {
  normalizeHousingPaymentForPersist,
  paymentSourceFromLegacyPreset,
} from "@/domain/finance/housing-loan-payments";
import { resolveGuidedCashDownpayment } from "@/domain/finance/property-financing-plan";
import { computeSingaporeResidentialBuyersStampDuty } from "@/domain/finance/singapore-residential-bsd";
import {
  housingDownpaymentGuidancePresetSchema,
  housingLenderTypeSchema,
  housingPaymentSourceSchema,
  housingPropertyKindSchema,
  housingPropertyStatusSchema,
  housingPropertyTypeSchema,
  yearMonthSchema,
  cashAccountWriteSchema,
} from "@/lib/validation";
import { z } from "zod";

function toClientErrorMessage(e: unknown): string {
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

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
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

  const planning = parseInvestmentPlanningFields(formData);
  if (!planning.ok) return { error: planning.error };

  try {
    await insertInvestment(supabase, user.id, {
      name,
      current_value: currentValue,
      monthly_contribution: monthlyContribution,
      expected_annual_return: expectedAnnualReturn,
      contribution_type: planning.contribution_type,
      contribution_duration_years: planning.contribution_duration_years,
      contribution_growth_annual: planning.contribution_growth_annual,
      withdrawal_monthly: planning.withdrawal_monthly,
      withdrawal_start_years: planning.withdrawal_start_years,
    });
    await acknowledgeInvestmentReview(supabase, user.id);
  } catch (e) {
    return { error: toClientErrorMessage(e) };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  revalidatePath("/planning/future");
  return { error: null as string | null };
}

export async function updateInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

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

  const planning = parseInvestmentPlanningFields(formData);
  if (!planning.ok) return { error: planning.error };

  try {
    await updateInvestment(supabase, user.id, idParsed.data, {
      name,
      current_value: currentValue,
      monthly_contribution: monthlyContribution,
      expected_annual_return: expectedAnnualReturn,
      contribution_type: planning.contribution_type,
      contribution_duration_years: planning.contribution_duration_years,
      contribution_growth_annual: planning.contribution_growth_annual,
      withdrawal_monthly: planning.withdrawal_monthly,
      withdrawal_start_years: planning.withdrawal_start_years,
    });
    await acknowledgeInvestmentReview(supabase, user.id);
  } catch (e) {
    return { error: toClientErrorMessage(e) };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  revalidatePath("/planning/future");
  return { error: null as string | null };
}

export async function deleteInvestmentAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  const idRaw = String(formData.get("id") ?? "").trim();
  const idParsed = z.string().uuid().safeParse(idRaw);
  if (!idParsed.success) {
    return { error: "Invalid investment" };
  }

  try {
    await deleteInvestment(supabase, user.id, idParsed.data);
    await acknowledgeInvestmentReview(supabase, user.id);
  } catch (e) {
    return { error: toClientErrorMessage(e) };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  revalidatePath("/planning/future");
  return { error: null as string | null };
}

export async function confirmInvestmentReviewAction(): Promise<{
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  try {
    await acknowledgeInvestmentReview(supabase, user.id);
  } catch (e) {
    return { error: toClientErrorMessage(e) };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  revalidatePath("/planning/future");
  return { error: null };
}

export async function confirmCpfRulesReviewAction(): Promise<{
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  try {
    await acknowledgeCpfRulesReview(supabase, user.id);
  } catch (e) {
    return { error: toClientErrorMessage(e) };
  }

  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  return { error: null };
}

function parseCashAccountForm(formData: FormData) {
  const parsed = cashAccountWriteSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    balance: Number(formData.get("balance")),
    purpose: String(formData.get("purpose") ?? "other"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid cash account";
    return { error: msg as string, data: null };
  }
  return { error: null, data: parsed.data };
}

export async function createCashAccountAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const body = parseCashAccountForm(formData);
  if (body.error || !body.data) return { error: body.error ?? "Invalid cash account" };

  await insertCashAccount(supabase, user.id, body.data);
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  return { error: null as string | null };
}

export async function updateCashAccountAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid account" };

  const body = parseCashAccountForm(formData);
  if (body.error || !body.data) return { error: body.error ?? "Invalid cash account" };

  await updateCashAccount(supabase, user.id, idParsed.data, body.data);
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
  return { error: null as string | null };
}

export async function deleteCashAccountAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return;

  try {
    await deleteCashAccount(supabase, user.id, parsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidateSetupAndPlanning();
}

export async function createLiabilityAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const parsed = parseLiabilityFormData(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const row = await insertLiability(supabase, user.id, parsed.data);
    await syncLiabilityBudgetLine(supabase, user.id, row);
  } catch (e) {
    console.error(e);
    return { error: "Could not save debt" };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  return { error: null as string | null };
}

export async function updateLiabilityAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid liability" };

  const parsed = parseLiabilityFormData(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const row = await updateLiability(
      supabase,
      user.id,
      idParsed.data,
      parsed.data
    );
    await syncLiabilityBudgetLine(supabase, user.id, row);
  } catch (e) {
    console.error(e);
    return { error: "Could not save debt" };
  }

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  return { error: null as string | null };
}

export async function deleteLiabilityAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return;

  try {
    await removeLiabilityBudgetLines(supabase, user.id, parsed.data);
    await deleteLiability(supabase, user.id, parsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidateSetupAndPlanning();
}

function optionalYearMonth(
  raw: string
): { ok: true; value: string | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!yearMonthSchema.safeParse(t).success) return { ok: false };
  return { ok: true, value: t };
}

export async function createVehicleAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const label = String(formData.get("label") ?? "").trim() || "Vehicle";
  const statusRaw = String(formData.get("vehicle_status") ?? "active").trim();
  const vehicle_status =
    statusRaw === "planned" ? "planned" : ("active" as const);
  const marketStr = String(formData.get("current_market_value") ?? "").trim();
  const current_market_value =
    marketStr === "" ? null : Number(marketStr);
  if (
    current_market_value != null &&
    (!Number.isFinite(current_market_value) || current_market_value < 0)
  ) {
    return { error: "Invalid current market value" };
  }
  const regParsed = optionalYearMonth(
    String(formData.get("first_registration_ym") ?? "")
  );
  if (!regParsed.ok) {
    return { error: "First registration must be YYYY-MM or blank" };
  }
  const first_registration_ym = regParsed.value;

  const otr = Number(formData.get("on_the_road_paid"));
  if (!Number.isFinite(otr) || otr < 0) {
    return { error: "Invalid on-the-road / purchase amount" };
  }
  const arfRaw = String(formData.get("arf_for_parf") ?? "").trim();
  const arf_for_parf =
    arfRaw === "" ? null : Number(arfRaw);
  if (arf_for_parf != null && (!Number.isFinite(arf_for_parf) || arf_for_parf < 0)) {
    return { error: "Invalid ARF for PARF" };
  }
  const bodyRaw = String(formData.get("body_open_market_at_purchase") ?? "").trim();
  const body_open_market_at_purchase =
    bodyRaw === "" ? null : Number(bodyRaw);
  if (
    body_open_market_at_purchase != null &&
    (!Number.isFinite(body_open_market_at_purchase) ||
      body_open_market_at_purchase < 0)
  ) {
    return { error: "Invalid body value at purchase" };
  }
  const body_depreciation_years = Math.round(
    Number(formData.get("body_depreciation_years"))
  );
  if (
    !Number.isFinite(body_depreciation_years) ||
    body_depreciation_years < 1 ||
    body_depreciation_years > 20
  ) {
    return { error: "Body depreciation years must be 1–20" };
  }
  const loanBalRaw = String(formData.get("loan_balance") ?? "").trim();
  const loan_balance = loanBalRaw === "" ? 0 : Number(loanBalRaw);
  const loan_monthly_payment = Number(formData.get("loan_monthly_payment"));
  if (!Number.isFinite(loan_balance) || loan_balance < 0) {
    return { error: "Invalid loan balance" };
  }
  if (!Number.isFinite(loan_monthly_payment) || loan_monthly_payment < 0) {
    return { error: "Invalid monthly payment" };
  }
  const remRaw = String(formData.get("loan_months_remaining") ?? "").trim();
  const loan_months_remaining =
    remRaw === "" ? null : Math.round(Number(remRaw));
  if (
    loan_months_remaining != null &&
    (!Number.isFinite(loan_months_remaining) || loan_months_remaining < 0)
  ) {
    return { error: "Invalid months remaining on loan" };
  }
  const rateRaw = String(formData.get("loan_annual_nominal_rate") ?? "").trim();
  const loan_annual_nominal_rate =
    rateRaw === "" ? null : Number(rateRaw);
  if (
    loan_annual_nominal_rate != null &&
    (!Number.isFinite(loan_annual_nominal_rate) ||
      loan_annual_nominal_rate < 0 ||
      loan_annual_nominal_rate > 0.5)
  ) {
    return { error: "Loan rate must be blank or 0–0.5 (decimal annual)" };
  }

  const coeExpParsed = optionalYearMonth(
    String(formData.get("coe_expiry_ym") ?? "")
  );
  if (!coeExpParsed.ok) {
    return { error: "COE expiry must be YYYY-MM or blank" };
  }
  const parfDeregStr = String(
    formData.get("parf_if_deregistered_today") ?? ""
  ).trim();
  const parf_if_deregistered_today =
    parfDeregStr === "" ? null : Number(parfDeregStr);
  if (
    parf_if_deregistered_today != null &&
    (!Number.isFinite(parf_if_deregistered_today) ||
      parf_if_deregistered_today < 0)
  ) {
    return { error: "Invalid PARF if deregistered today" };
  }
  const coeDeregStr = String(
    formData.get("coe_if_deregistered_today") ?? ""
  ).trim();
  const coe_if_deregistered_today =
    coeDeregStr === "" ? null : Number(coeDeregStr);
  if (
    coe_if_deregistered_today != null &&
    (!Number.isFinite(coe_if_deregistered_today) || coe_if_deregistered_today < 0)
  ) {
    return { error: "Invalid COE if deregistered today" };
  }
  const bodyScrapStr = String(
    formData.get("body_scrap_if_deregistered_today") ?? ""
  ).trim();
  const body_scrap_if_deregistered_today =
    bodyScrapStr === "" ? null : Number(bodyScrapStr);
  if (
    body_scrap_if_deregistered_today != null &&
    (!Number.isFinite(body_scrap_if_deregistered_today) ||
      body_scrap_if_deregistered_today < 0)
  ) {
    return { error: "Invalid body/scrap if deregistered today" };
  }
  const loan_prefer_stored_balance =
    formData.get("loan_prefer_stored_balance") === "on";
  const loan_simple_remaining_estimate =
    loan_prefer_stored_balance
      ? false
      : formData.get("loan_simple_remaining_estimate") === "on";
  const termRecStr = String(
    formData.get("terminal_recovery_at_coe_expiry") ?? ""
  ).trim();
  const terminal_recovery_at_coe_expiry =
    termRecStr === "" ? null : Number(termRecStr);
  if (
    terminal_recovery_at_coe_expiry != null &&
    (!Number.isFinite(terminal_recovery_at_coe_expiry) ||
      terminal_recovery_at_coe_expiry < 0)
  ) {
    return { error: "Invalid terminal recovery at COE expiry" };
  }
  const loanEndParsed = optionalYearMonth(
    String(formData.get("loan_end_ym") ?? "")
  );
  if (!loanEndParsed.ok) {
    return { error: "Loan end month must be YYYY-MM or blank" };
  }

  try {
    await insertVehicle(supabase, user.id, {
      label,
      vehicle_status,
      current_market_value,
      first_registration_ym,
      on_the_road_paid: otr,
      arf_for_parf,
      body_open_market_at_purchase,
      body_depreciation_years,
      coe_expiry_ym: coeExpParsed.value,
      parf_if_deregistered_today,
      coe_if_deregistered_today,
      body_scrap_if_deregistered_today,
      loan_balance,
      loan_monthly_payment,
      loan_months_remaining,
      loan_end_ym: loanEndParsed.value,
      loan_prefer_stored_balance,
      loan_simple_remaining_estimate,
      terminal_recovery_at_coe_expiry,
      loan_annual_nominal_rate,
      display_order: 0,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not save vehicle" };
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  return { error: null as string | null };
}

export async function updateVehicleAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid vehicle" };

  const label = String(formData.get("label") ?? "").trim() || "Vehicle";
  const statusRaw = String(formData.get("vehicle_status") ?? "active").trim();
  const vehicle_status =
    statusRaw === "planned" ? "planned" : ("active" as const);
  const marketStr = String(formData.get("current_market_value") ?? "").trim();
  const current_market_value =
    marketStr === "" ? null : Number(marketStr);
  if (
    current_market_value != null &&
    (!Number.isFinite(current_market_value) || current_market_value < 0)
  ) {
    return { error: "Invalid current market value" };
  }
  const regParsed = optionalYearMonth(
    String(formData.get("first_registration_ym") ?? "")
  );
  if (!regParsed.ok) {
    return { error: "First registration must be YYYY-MM or blank" };
  }

  const otr = Number(formData.get("on_the_road_paid"));
  if (!Number.isFinite(otr) || otr < 0) {
    return { error: "Invalid on-the-road / purchase amount" };
  }
  const arfRaw = String(formData.get("arf_for_parf") ?? "").trim();
  const arf_for_parf =
    arfRaw === "" ? null : Number(arfRaw);
  if (arf_for_parf != null && (!Number.isFinite(arf_for_parf) || arf_for_parf < 0)) {
    return { error: "Invalid ARF for PARF" };
  }
  const bodyRaw = String(formData.get("body_open_market_at_purchase") ?? "").trim();
  const body_open_market_at_purchase =
    bodyRaw === "" ? null : Number(bodyRaw);
  if (
    body_open_market_at_purchase != null &&
    (!Number.isFinite(body_open_market_at_purchase) ||
      body_open_market_at_purchase < 0)
  ) {
    return { error: "Invalid body value at purchase" };
  }
  const body_depreciation_years = Math.round(
    Number(formData.get("body_depreciation_years"))
  );
  if (
    !Number.isFinite(body_depreciation_years) ||
    body_depreciation_years < 1 ||
    body_depreciation_years > 20
  ) {
    return { error: "Body depreciation years must be 1–20" };
  }
  const loanBalRawUpd = String(formData.get("loan_balance") ?? "").trim();
  const loan_balance = loanBalRawUpd === "" ? 0 : Number(loanBalRawUpd);
  const loan_monthly_payment = Number(formData.get("loan_monthly_payment"));
  if (!Number.isFinite(loan_balance) || loan_balance < 0) {
    return { error: "Invalid loan balance" };
  }
  if (!Number.isFinite(loan_monthly_payment) || loan_monthly_payment < 0) {
    return { error: "Invalid monthly payment" };
  }
  const remRaw = String(formData.get("loan_months_remaining") ?? "").trim();
  const loan_months_remaining =
    remRaw === "" ? null : Math.round(Number(remRaw));
  if (
    loan_months_remaining != null &&
    (!Number.isFinite(loan_months_remaining) || loan_months_remaining < 0)
  ) {
    return { error: "Invalid months remaining on loan" };
  }
  const rateRaw = String(formData.get("loan_annual_nominal_rate") ?? "").trim();
  const loan_annual_nominal_rate =
    rateRaw === "" ? null : Number(rateRaw);
  if (
    loan_annual_nominal_rate != null &&
    (!Number.isFinite(loan_annual_nominal_rate) ||
      loan_annual_nominal_rate < 0 ||
      loan_annual_nominal_rate > 0.5)
  ) {
    return { error: "Loan rate must be blank or 0–0.5 (decimal annual)" };
  }

  const coeExpParsed = optionalYearMonth(
    String(formData.get("coe_expiry_ym") ?? "")
  );
  if (!coeExpParsed.ok) {
    return { error: "COE expiry must be YYYY-MM or blank" };
  }
  const parfDeregStr = String(
    formData.get("parf_if_deregistered_today") ?? ""
  ).trim();
  const parf_if_deregistered_today =
    parfDeregStr === "" ? null : Number(parfDeregStr);
  if (
    parf_if_deregistered_today != null &&
    (!Number.isFinite(parf_if_deregistered_today) ||
      parf_if_deregistered_today < 0)
  ) {
    return { error: "Invalid PARF if deregistered today" };
  }
  const coeDeregStr = String(
    formData.get("coe_if_deregistered_today") ?? ""
  ).trim();
  const coe_if_deregistered_today =
    coeDeregStr === "" ? null : Number(coeDeregStr);
  if (
    coe_if_deregistered_today != null &&
    (!Number.isFinite(coe_if_deregistered_today) || coe_if_deregistered_today < 0)
  ) {
    return { error: "Invalid COE if deregistered today" };
  }
  const bodyScrapStr = String(
    formData.get("body_scrap_if_deregistered_today") ?? ""
  ).trim();
  const body_scrap_if_deregistered_today =
    bodyScrapStr === "" ? null : Number(bodyScrapStr);
  if (
    body_scrap_if_deregistered_today != null &&
    (!Number.isFinite(body_scrap_if_deregistered_today) ||
      body_scrap_if_deregistered_today < 0)
  ) {
    return { error: "Invalid body/scrap if deregistered today" };
  }
  const loan_prefer_stored_balance =
    formData.get("loan_prefer_stored_balance") === "on";
  const loan_simple_remaining_estimate =
    loan_prefer_stored_balance
      ? false
      : formData.get("loan_simple_remaining_estimate") === "on";
  const termRecStr = String(
    formData.get("terminal_recovery_at_coe_expiry") ?? ""
  ).trim();
  const terminal_recovery_at_coe_expiry =
    termRecStr === "" ? null : Number(termRecStr);
  if (
    terminal_recovery_at_coe_expiry != null &&
    (!Number.isFinite(terminal_recovery_at_coe_expiry) ||
      terminal_recovery_at_coe_expiry < 0)
  ) {
    return { error: "Invalid terminal recovery at COE expiry" };
  }
  const loanEndParsed = optionalYearMonth(
    String(formData.get("loan_end_ym") ?? "")
  );
  if (!loanEndParsed.ok) {
    return { error: "Loan end month must be YYYY-MM or blank" };
  }

  try {
    await updateVehicle(supabase, user.id, idParsed.data, {
      label,
      vehicle_status,
      current_market_value,
      first_registration_ym: regParsed.value,
      on_the_road_paid: otr,
      arf_for_parf,
      body_open_market_at_purchase,
      body_depreciation_years,
      coe_expiry_ym: coeExpParsed.value,
      parf_if_deregistered_today,
      coe_if_deregistered_today,
      body_scrap_if_deregistered_today,
      loan_balance,
      loan_monthly_payment,
      loan_months_remaining,
      loan_end_ym: loanEndParsed.value,
      loan_prefer_stored_balance,
      loan_simple_remaining_estimate,
      terminal_recovery_at_coe_expiry,
      loan_annual_nominal_rate,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not update vehicle" };
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
  return { error: null as string | null };
}

export async function deleteVehicleAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return;

  try {
    await deleteVehicle(supabase, user.id, idParsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
}

export async function createGoalAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const targetAmount = Number(formData.get("target_amount"));
  const currentAmount = Number(formData.get("current_amount"));
  const monthlyContribution = Number(formData.get("monthly_contribution"));
  const expectedAnnualReturn = Number(formData.get("expected_annual_return"));
  const targetDateRaw = String(formData.get("target_date") ?? "").trim();
  const linkedRaw = String(formData.get("linked_investment_id") ?? "").trim();

  if (!title) return { error: "Title is required" };
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Invalid target amount" };
  }
  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return { error: "Invalid current amount" };
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    return { error: "Invalid monthly contribution" };
  }
  if (
    !Number.isFinite(expectedAnnualReturn) ||
    expectedAnnualReturn < 0 ||
    expectedAnnualReturn > 1
  ) {
    return {
      error: "Invalid expected return (use 0–1 decimal, e.g. 0.07 for 7%)",
    };
  }

  await insertFinancialGoal(supabase, user.id, {
    title,
    target_amount: targetAmount,
    target_date: targetDateRaw || null,
    linked_investment_id: linkedRaw || null,
    current_amount: currentAmount,
    monthly_contribution: monthlyContribution,
    expected_annual_return: expectedAnnualReturn,
  });

  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null as string | null };
}

export async function reorderFinancialGoalAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  const goalId = String(formData.get("goal_id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!goalId) return { error: "Missing goal" };
  if (direction !== "up" && direction !== "down") {
    return { error: "Invalid direction" };
  }

  try {
    await reorderFinancialGoal(supabase, user.id, goalId, direction);
  } catch (e) {
    console.error(e);
    return { error: "Could not reorder goal" };
  }

  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateGoalAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in required" };
  }

  const goalId = String(formData.get("goal_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const targetAmount = Number(formData.get("target_amount"));
  const currentAmount = Number(formData.get("current_amount"));
  const monthlyContribution = Number(formData.get("monthly_contribution"));
  const expectedAnnualReturn = Number(formData.get("expected_annual_return"));
  const targetDateRaw = String(formData.get("target_date") ?? "").trim();
  const linkedRaw = String(formData.get("linked_investment_id") ?? "").trim();

  if (!goalId) return { error: "Missing goal" };
  if (!title) return { error: "Title is required" };
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Invalid target amount" };
  }
  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return { error: "Invalid current amount" };
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    return { error: "Invalid monthly contribution" };
  }
  if (
    !Number.isFinite(expectedAnnualReturn) ||
    expectedAnnualReturn < 0 ||
    expectedAnnualReturn > 1
  ) {
    return {
      error: "Invalid expected return (use 0–1 decimal, e.g. 0.07 for 7%)",
    };
  }

  try {
    await updateFinancialGoal(supabase, user.id, goalId, {
      title,
      target_amount: targetAmount,
      current_amount: currentAmount,
      monthly_contribution: monthlyContribution,
      expected_annual_return: expectedAnnualReturn,
      target_date: targetDateRaw || null,
      linked_investment_id: linkedRaw || null,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not update goal" };
  }

  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null as string | null };
}

export async function createBudgetLineAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const category = String(formData.get("category") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "");
  const amount = Number(formData.get("amount"));
  const yearRaw = formData.get("calendar_year");

  if (!category) return { error: "Category is required" };
  if (cadence !== "monthly" && cadence !== "annual") {
    return { error: "Invalid cadence" };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  let calendar_year: number | null = null;
  if (cadence === "annual") {
    const y = Number(yearRaw);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) {
      return { error: "Valid year is required for annual budgets" };
    }
    calendar_year = y;
  }

  let start_year_month: string | null = null;
  let end_year_month: string | null = null;
  if (cadence === "monthly") {
    const s = String(formData.get("start_year_month") ?? "").trim();
    const e = String(formData.get("end_year_month") ?? "").trim();
    start_year_month = s || null;
    end_year_month = e || null;
    if (start_year_month && !isValidYearMonth(start_year_month)) {
      return { error: "First month must be YYYY-MM" };
    }
    if (end_year_month && !isValidYearMonth(end_year_month)) {
      return { error: "Last month must be YYYY-MM" };
    }
    if (
      start_year_month &&
      end_year_month &&
      start_year_month > end_year_month
    ) {
      return { error: "First month cannot be after last month" };
    }
  }

  try {
    await insertBudgetLine(supabase, user.id, {
      category,
      cadence,
      amount,
      calendar_year,
      start_year_month,
      end_year_month,
    });
  } catch (e) {
    console.error(e);
    return {
      error:
        "Could not save budget line. It may already exist for this category and period.",
    };
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null };
}

const LIFESTYLE_IDS: LifestyleProfileId[] = [
  "student",
  "fresh_graduate",
  "young_professional",
  "married_couple",
  "young_family",
  "high_saver",
  "flexible_lifestyle",
  "freelancer",
  "business_owner",
];

const STRATEGY_IDS: BudgetingStrategyId[] = [
  "balanced",
  "aggressive_saver",
  "flexible_lifestyle",
  "custom",
];

function coerceLifestyle(
  raw: string | null | undefined
): LifestyleProfileId {
  return LIFESTYLE_IDS.includes(raw as LifestyleProfileId)
    ? (raw as LifestyleProfileId)
    : "young_professional";
}

function coerceStrategy(
  raw: string | null | undefined
): BudgetingStrategyId {
  return STRATEGY_IDS.includes(raw as BudgetingStrategyId)
    ? (raw as BudgetingStrategyId)
    : "balanced";
}

function coerceFoodBand(
  raw: string | null | undefined
): FoodSpendBandId | null {
  if (!raw || raw === "unknown") return null;
  const bands: FoodSpendBandId[] = [
    "under_300",
    "range_300_600",
    "range_600_1000",
    "above_1000",
    "unknown",
  ];
  return bands.includes(raw as FoodSpendBandId)
    ? (raw as FoodSpendBandId)
    : null;
}

/**
 * Seeds monthly `financial_budget_lines` from guided-setup heuristics.
 * When monthly lines already exist, pass `replaceExisting=true` in form data to
 * remove replaceable lines (keeps debt repayment and income tax categories).
 */
export async function applyGuidedBudgetLinesAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const replaceExisting = formData.get("replaceExisting") === "true";

  const [profile, existingLines] = await Promise.all([
    getProfileById(supabase, user.id),
    listBudgetLines(supabase, user.id),
  ]);

  const monthlyExisting = existingLines.filter((l) => l.cadence === "monthly");
  const replaceable = monthlyExisting.filter(
    (l) => !isPreservedOnGuidedBudgetReplace(l.category)
  );

  if (replaceable.length > 0 && !replaceExisting) {
    return {
      error:
        "You already have monthly budget lines. Confirm replace on Budget lens to rebuild from your current settings.",
    };
  }

  const income = profileSalaryTakeHomeMonthly(
    profile,
    formatYearMonth(new Date())
  );
  if (income == null || income <= 0) {
    return {
      error: "Set a positive monthly income first, then try again.",
    };
  }

  const drafts = generateGuidedMonthlyBudgetLines({
    monthlyIncome: income,
    lifestyle: coerceLifestyle(profile?.lifestyle_profile),
    strategy: coerceStrategy(profile?.budgeting_strategy),
    foodSpendBand: coerceFoodBand(profile?.food_spend_band),
  });

  if (drafts.length === 0) {
    return {
      error: "Could not build a plan from your income. Check your profile.",
    };
  }

  try {
    if (replaceExisting) {
      for (const line of replaceable) {
        await deleteBudgetLine(supabase, user.id, line.id);
      }
    }
    for (const row of drafts) {
      await insertBudgetLine(supabase, user.id, {
        category: row.category,
        cadence: "monthly",
        amount: row.amount,
        calendar_year: null,
        start_year_month: null,
        end_year_month: null,
      });
    }
    await updateProfile(supabase, user.id, {
      budget_generation_source: "guided_setup",
    });
  } catch (e) {
    console.error(e);
    return {
      error:
        "Could not save all budget lines. If some were created, finish editing on the Budget page.",
    };
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  revalidatePath("/expenses");
  return { error: null };
}

export async function updateBudgetLineAmountAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const id = String(formData.get("id") ?? "");
  const amount = Number(formData.get("amount"));
  if (!id) return { error: "Missing line" };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  try {
    await updateBudgetLine(supabase, user.id, id, { amount });
  } catch (e) {
    console.error(e);
    return { error: "Could not update budget line" };
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteBudgetLineAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await deleteBudgetLine(supabase, user.id, id);
  } catch (e) {
    console.error(e);
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
}

export async function setBudgetMonthOverrideAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const budget_line_id = String(formData.get("budget_line_id") ?? "");
  const year_month = String(formData.get("year_month") ?? "").trim();
  const amount = Number(formData.get("amount"));

  if (!budget_line_id) return { error: "Missing line" };
  if (!isValidYearMonth(year_month)) return { error: "Invalid month" };
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  try {
    await upsertBudgetLineMonthOverride(supabase, user.id, {
      budget_line_id,
      year_month,
      amount,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not save override" };
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null };
}

export async function clearBudgetMonthOverrideAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const budget_line_id = String(formData.get("budget_line_id") ?? "");
  const year_month = String(formData.get("year_month") ?? "").trim();
  if (!budget_line_id || !isValidYearMonth(year_month)) return;

  try {
    await deleteBudgetLineMonthOverride(
      supabase,
      user.id,
      budget_line_id,
      year_month
    );
  } catch (e) {
    console.error(e);
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
}

export async function updateBudgetLineScheduleAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const id = String(formData.get("id") ?? "");
  const startRaw = String(formData.get("start_year_month") ?? "").trim();
  const endRaw = String(formData.get("end_year_month") ?? "").trim();
  const start_year_month = startRaw === "" ? null : startRaw;
  const end_year_month = endRaw === "" ? null : endRaw;

  if (!id) return { error: "Missing line" };
  if (start_year_month && !isValidYearMonth(start_year_month)) {
    return { error: "First month must be YYYY-MM" };
  }
  if (end_year_month && !isValidYearMonth(end_year_month)) {
    return { error: "Last month must be YYYY-MM" };
  }
  if (
    start_year_month &&
    end_year_month &&
    start_year_month > end_year_month
  ) {
    return { error: "First month cannot be after last month" };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("financial_budget_lines")
    .select("cadence")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr || !row) return { error: "Line not found" };
  if (row.cadence !== "monthly") {
    return { error: "Only monthly lines use a schedule" };
  }

  try {
    await updateBudgetLine(supabase, user.id, id, {
      start_year_month,
      end_year_month,
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not update schedule" };
  }

  revalidatePath("/budget");
  revalidateSetupAndPlanning();
  revalidatePath("/dashboard");
  return { error: null };
}

export async function upsertCpfBalanceAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const oa = Number(formData.get("oa"));
  const sa = Number(formData.get("sa"));
  const ma = Number(formData.get("ma"));
  const oaRRaw = String(formData.get("oa_annual_rate") ?? "").trim();
  const saRRaw = String(formData.get("sa_annual_rate") ?? "").trim();
  const maRRaw = String(formData.get("ma_annual_rate") ?? "").trim();
  const oaR = oaRRaw === "" ? NaN : Number(oaRRaw);
  const saR = saRRaw === "" ? NaN : Number(saRRaw);
  const maR = maRRaw === "" ? NaN : Number(maRRaw);
  const cpfisM = Number(formData.get("cpfis_monthly_from_oa"));
  const cpfisB = Number(formData.get("cpfis_notional_balance"));
  const cpfisRet = Number(formData.get("cpfis_annual_return"));

  if (![oa, sa, ma].every((n) => Number.isFinite(n) && n >= 0)) {
    return { error: "OA, SA, and MA must be numbers ≥ 0" };
  }
  const optRate = (v: number) =>
    !Number.isFinite(v) || v < 0 || v > 0.25 ? null : v;
  const oa_annual_rate = optRate(oaR);
  const sa_annual_rate = optRate(saR);
  const ma_annual_rate = optRate(maR);
  if (!Number.isFinite(cpfisM) || cpfisM < 0) {
    return { error: "Invalid CPFIS monthly from OA" };
  }
  if (!Number.isFinite(cpfisB) || cpfisB < 0) {
    return { error: "Invalid CPFIS notional balance" };
  }
  if (!Number.isFinite(cpfisRet) || cpfisRet < 0 || cpfisRet > 1) {
    return { error: "CPFIS annual return must be 0–1" };
  }

  await upsertCpfBalance(supabase, user.id, {
    oa,
    sa,
    ma,
    oa_annual_rate,
    sa_annual_rate,
    ma_annual_rate,
    cpfis_monthly_from_oa: cpfisM,
    cpfis_notional_balance: cpfisB,
    cpfis_annual_return: cpfisRet,
  });
  revalidatePath("/dashboard");
  revalidatePath("/balances");
  revalidateSetupAndPlanning();
  return { error: null };
}

export async function clearCpfBalanceAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await deleteCpfBalance(supabase, user.id);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/dashboard");
  revalidatePath("/balances");
  revalidateSetupAndPlanning();
}

function parseHousingPaymentForm(
  formData: FormData,
  loanBase: {
    principal: number;
    annual_nominal_rate: number;
    term_months: number;
    first_payment_month: string;
    oa_share_of_payment: number;
  }
):
  | {
      payment_source: "cash" | "cpf_oa" | "split";
      cpf_oa_payment: number | null;
      cash_payment: number | null;
      oa_share_of_payment: number;
    }
  | { error: string } {
  const sourceRaw = String(formData.get("payment_source") ?? "").trim();
  const legacyShareRaw = String(formData.get("oa_inst_share") ?? "").trim();
  const sourceParsed =
    sourceRaw !== ""
      ? housingPaymentSourceSchema.safeParse(sourceRaw)
      : legacyShareRaw !== ""
        ? { success: true as const, data: paymentSourceFromLegacyPreset(legacyShareRaw) }
        : null;

  if (!sourceParsed || !sourceParsed.success) {
    return { error: "Invalid instalment payment source" };
  }

  const cpfRaw = String(formData.get("cpf_oa_payment") ?? "").trim();
  const cashRaw = String(formData.get("cash_payment") ?? "").trim();
  const cpfOaPayment = cpfRaw === "" ? null : Number(cpfRaw);
  const cashPayment = cashRaw === "" ? null : Number(cashRaw);

  if (
    cpfOaPayment != null &&
    (!Number.isFinite(cpfOaPayment) || cpfOaPayment < 0)
  ) {
    return { error: "CPF OA payment must be blank or ≥ 0" };
  }
  if (
    cashPayment != null &&
    (!Number.isFinite(cashPayment) || cashPayment < 0)
  ) {
    return { error: "Cash payment must be blank or ≥ 0" };
  }

  const normalized = normalizeHousingPaymentForPersist(
    {
      ...loanBase,
      payment_source: sourceParsed.data,
      cpf_oa_payment: cpfOaPayment,
      cash_payment: cashPayment,
    },
    {
      paymentSource: sourceParsed.data,
      cpfOaPayment,
      cashPayment,
    }
  );

  if ("error" in normalized) return normalized;
  return normalized;
}

function revalidateHousingPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/balances");
  revalidatePath("/budget");
  revalidatePath("/setup");
  revalidatePath("/planning/wealth");
}

async function insertPropertyForLoan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  opts: {
    name: string;
    property_type?: import("@/data/supabase/types").PropertyRow["property_type"];
    purchase_price?: number | null;
    status?: import("@/data/supabase/types").PropertyRow["status"];
  }
) {
  return insertProperty(supabase, userId, {
    name: opts.name,
    property_type: opts.property_type ?? "unknown",
    purchase_price: opts.purchase_price ?? null,
    current_valuation: null,
    ownership_percent: 1,
    status: opts.status ?? "living_in",
    rental_income_monthly: 0,
    planning_scope: "current",
  });
}

export async function createHousingPropertyAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const name = String(formData.get("name") ?? "").trim() || "Property";
  const propertyTypeRaw = String(formData.get("property_type") ?? "unknown").trim();
  const propertyTypeParsed = housingPropertyTypeSchema.safeParse(propertyTypeRaw);
  if (!propertyTypeParsed.success) {
    return { error: "Invalid property type" };
  }
  const statusRaw = String(formData.get("status") ?? "living_in").trim();
  const statusParsed = housingPropertyStatusSchema.safeParse(statusRaw);
  if (!statusParsed.success) {
    return { error: "Invalid property status" };
  }

  const purchaseRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchase_price =
    purchaseRaw === "" ? null : Number(purchaseRaw);
  const valuationRaw = String(formData.get("current_valuation") ?? "").trim();
  const current_valuation =
    valuationRaw === "" ? null : Number(valuationRaw);
  const ownershipRaw = String(formData.get("ownership_percent") ?? "100").trim();
  const ownership_percent = Number(ownershipRaw) / 100;
  const rentalRaw = String(formData.get("rental_income_monthly") ?? "").trim();
  const rental_income_monthly =
    rentalRaw === "" ? 0 : Number(rentalRaw);
  const hasLoan = String(formData.get("has_loan") ?? "no").trim() === "yes";

  if (
    purchase_price != null &&
    (!Number.isFinite(purchase_price) || purchase_price <= 0)
  ) {
    return { error: "Purchase price must be blank or positive" };
  }
  if (
    current_valuation != null &&
    (!Number.isFinite(current_valuation) || current_valuation <= 0)
  ) {
    return { error: "Current valuation must be blank or positive" };
  }
  if (
    !Number.isFinite(ownership_percent) ||
    ownership_percent <= 0 ||
    ownership_percent > 1
  ) {
    return { error: "Ownership % must be between 1 and 100" };
  }
  if (!Number.isFinite(rental_income_monthly) || rental_income_monthly < 0) {
    return { error: "Rental income must be ≥ 0" };
  }

  const property = await insertProperty(supabase, user.id, {
    name,
    property_type: propertyTypeParsed.data,
    purchase_price,
    current_valuation,
    ownership_percent,
    status: statusParsed.data,
    rental_income_monthly,
    planning_scope: "current",
  });

  if (!hasLoan) {
    revalidateHousingPaths();
    return { error: null };
  }

  const label = String(formData.get("loan_label") ?? "").trim() || name;
  const principal = Number(formData.get("principal"));
  const annual_nominal_rate = Number(formData.get("annual_nominal_rate"));
  const term_months = Math.round(Number(formData.get("term_months")));
  const completion_month = String(formData.get("completion_month") ?? "").trim();
  const first_payment_month = String(
    formData.get("first_payment_month") ?? ""
  ).trim();
  const downpayment_from_oa = Number(formData.get("downpayment_from_oa"));
  const fees_from_oa = Number(formData.get("fees_from_oa"));
  const maxRaw = String(formData.get("max_oa_per_month") ?? "").trim();
  const max_oa_per_month = maxRaw === "" ? null : Number(maxRaw);
  const lenderRaw = String(formData.get("lender_type") ?? "hdb").trim();
  const lenderParsed = housingLenderTypeSchema.safeParse(lenderRaw);
  const lender_type = lenderParsed.success ? lenderParsed.data : "hdb";
  const origRaw = String(formData.get("original_loan_principal") ?? "").trim();
  const original_loan_principal = origRaw === "" ? null : Number(origRaw);
  const repaidRaw = String(
    formData.get("principal_repaid_before_schedule") ?? ""
  ).trim();
  const principal_repaid_before_schedule =
    repaidRaw === "" ? 0 : Number(repaidRaw);

  if (!Number.isFinite(principal) || principal <= 0) {
    return { error: "Outstanding principal must be positive when a loan exists" };
  }
  if (!Number.isFinite(annual_nominal_rate) || annual_nominal_rate < 0) {
    return { error: "Annual rate must be ≥ 0" };
  }
  if (!Number.isFinite(term_months) || term_months <= 0 || term_months > 600) {
    return { error: "Term must be 1–600 months" };
  }
  if (!yearMonthSchema.safeParse(completion_month).success) {
    return { error: "Completion month must be YYYY-MM" };
  }
  if (!yearMonthSchema.safeParse(first_payment_month).success) {
    return { error: "First payment month must be YYYY-MM" };
  }
  if (!Number.isFinite(downpayment_from_oa) || downpayment_from_oa < 0) {
    return { error: "Invalid downpayment from OA" };
  }
  if (!Number.isFinite(fees_from_oa) || fees_from_oa < 0) {
    return { error: "Invalid fees from OA" };
  }

  const annual_nominal_rate_effective =
    lender_type === "hdb" ? HDB_CONCESSIONARY_RATE_ANNUAL : annual_nominal_rate;

  const paymentParsed = parseHousingPaymentForm(formData, {
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    first_payment_month,
    oa_share_of_payment: Number(formData.get("oa_share_of_payment")) || 0,
  });
  if ("error" in paymentParsed) return paymentParsed;

  await insertHousingLoan(supabase, user.id, {
    property_id: property.id,
    label,
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    completion_month,
    first_payment_month,
    downpayment_from_oa,
    fees_from_oa,
    oa_share_of_payment: paymentParsed.oa_share_of_payment,
    max_oa_per_month,
    lender_type,
    original_loan_principal,
    principal_repaid_before_schedule,
    property_purchase_price: purchase_price,
    property_kind:
      propertyTypeParsed.data === "unknown" ||
      propertyTypeParsed.data === "overseas" ||
      propertyTypeParsed.data === "other"
        ? null
        : propertyTypeParsed.data,
    payment_source: paymentParsed.payment_source,
    cpf_oa_payment: paymentParsed.cpf_oa_payment,
    cash_payment: paymentParsed.cash_payment,
  });

  revalidateHousingPaths();
  return { error: null };
}

export async function updateHousingPropertyAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid property" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Property name is required" };

  const propertyTypeParsed = housingPropertyTypeSchema.safeParse(
    String(formData.get("property_type") ?? "unknown").trim()
  );
  const statusParsed = housingPropertyStatusSchema.safeParse(
    String(formData.get("status") ?? "living_in").trim()
  );
  if (!propertyTypeParsed.success || !statusParsed.success) {
    return { error: "Invalid property details" };
  }

  const purchaseRaw = String(formData.get("purchase_price") ?? "").trim();
  const purchase_price = purchaseRaw === "" ? null : Number(purchaseRaw);
  const valuationRaw = String(formData.get("current_valuation") ?? "").trim();
  const current_valuation =
    valuationRaw === "" ? null : Number(valuationRaw);
  const ownership_percent =
    Number(String(formData.get("ownership_percent") ?? "100").trim()) / 100;
  const rental_income_monthly = Number(
    String(formData.get("rental_income_monthly") ?? "0").trim()
  );

  await updateProperty(supabase, user.id, idParsed.data, {
    name,
    property_type: propertyTypeParsed.data,
    purchase_price,
    current_valuation,
    ownership_percent,
    status: statusParsed.data,
    rental_income_monthly,
  });

  revalidateHousingPaths();
  return { error: null };
}

export async function deleteHousingPropertyAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return;
  try {
    await deleteProperty(supabase, user.id, idParsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidateHousingPaths();
}

export async function createHousingLoanAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const label = String(formData.get("label") ?? "").trim() || "Home loan";
  const principal = Number(formData.get("principal"));
  const annual_nominal_rate = Number(formData.get("annual_nominal_rate"));
  const term_months = Math.round(Number(formData.get("term_months")));
  const completion_month = String(formData.get("completion_month") ?? "").trim();
  const first_payment_month = String(
    formData.get("first_payment_month") ?? ""
  ).trim();
  const downpayment_from_oa = Number(formData.get("downpayment_from_oa"));
  const fees_from_oa = Number(formData.get("fees_from_oa"));
  const maxRaw = String(formData.get("max_oa_per_month") ?? "").trim();
  const max_oa_per_month =
    maxRaw === "" ? null : Number(maxRaw);
  const lenderRaw = String(formData.get("lender_type") ?? "hdb").trim();
  const lenderParsed = housingLenderTypeSchema.safeParse(lenderRaw);
  const lender_type = lenderParsed.success ? lenderParsed.data : "hdb";
  const origRaw = String(formData.get("original_loan_principal") ?? "").trim();
  const original_loan_principal =
    origRaw === "" ? null : Number(origRaw);
  const repaidRaw = String(
    formData.get("principal_repaid_before_schedule") ?? ""
  ).trim();
  const principal_repaid_before_schedule =
    repaidRaw === "" ? 0 : Number(repaidRaw);

  if (!Number.isFinite(principal) || principal <= 0) {
    return { error: "Outstanding principal must be positive" };
  }
  if (!Number.isFinite(annual_nominal_rate) || annual_nominal_rate < 0) {
    return { error: "Annual rate must be ≥ 0 (decimal, e.g. 0.025)" };
  }
  if (!Number.isFinite(term_months) || term_months <= 0 || term_months > 600) {
    return { error: "Term must be 1–600 months" };
  }
  if (!yearMonthSchema.safeParse(completion_month).success) {
    return { error: "Completion month must be YYYY-MM" };
  }
  if (!yearMonthSchema.safeParse(first_payment_month).success) {
    return { error: "First payment month must be YYYY-MM" };
  }
  if (!Number.isFinite(downpayment_from_oa) || downpayment_from_oa < 0) {
    return { error: "Invalid downpayment from OA" };
  }
  if (!Number.isFinite(fees_from_oa) || fees_from_oa < 0) {
    return { error: "Invalid fees from OA" };
  }

  const annual_nominal_rate_effective =
    lender_type === "hdb" ? HDB_CONCESSIONARY_RATE_ANNUAL : annual_nominal_rate;

  const paymentParsed = parseHousingPaymentForm(formData, {
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    first_payment_month,
    oa_share_of_payment: Number(formData.get("oa_share_of_payment")) || 0,
  });
  if ("error" in paymentParsed) return paymentParsed;
  const {
    payment_source,
    cpf_oa_payment,
    cash_payment,
    oa_share_of_payment,
  } = paymentParsed;
  if (
    max_oa_per_month != null &&
    (!Number.isFinite(max_oa_per_month) || max_oa_per_month < 0)
  ) {
    return { error: "Max OA per month must be blank or ≥ 0" };
  }
  if (
    original_loan_principal != null &&
    (!Number.isFinite(original_loan_principal) ||
      original_loan_principal <= 0)
  ) {
    return { error: "Original loan amount must be blank or positive" };
  }
  if (
    !Number.isFinite(principal_repaid_before_schedule) ||
    principal_repaid_before_schedule < 0
  ) {
    return { error: "Principal repaid must be ≥ 0" };
  }

  const property = await insertPropertyForLoan(supabase, user.id, {
    name: label,
    status: "living_in",
  });

  await insertHousingLoan(supabase, user.id, {
    property_id: property.id,
    label,
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    completion_month,
    first_payment_month,
    downpayment_from_oa,
    fees_from_oa,
    oa_share_of_payment,
    max_oa_per_month,
    lender_type,
    original_loan_principal,
    principal_repaid_before_schedule,
    payment_source,
    cpf_oa_payment,
    cash_payment,
  });
  revalidateHousingPaths();
  return { error: null };
}

export async function createHousingLoanQuickAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const label = String(formData.get("label") ?? "").trim();
  const purchasePrice = Number(formData.get("purchase_price"));
  const depositFromOaRaw = String(formData.get("deposit_from_oa") ?? "").trim();
  const feesFromOaRaw = String(formData.get("fees_from_oa") ?? "").trim();
  const depositFromOa =
    depositFromOaRaw === "" ? 0 : Number(depositFromOaRaw);
  const feesFromOa = feesFromOaRaw === "" ? 0 : Number(feesFromOaRaw);
  const loanTermYears = Number(formData.get("loan_term_years"));
  const first_payment_month = String(
    formData.get("first_payment_month") ?? ""
  ).trim();
  const lenderRaw = String(formData.get("lender_type") ?? "hdb").trim();
  const lenderParsed = housingLenderTypeSchema.safeParse(lenderRaw);
  const lenderType = lenderParsed.success ? lenderParsed.data : "hdb";
  const bankPctRaw = String(formData.get("bank_rate_percent") ?? "").trim();
  const bankAnnualRate =
    bankPctRaw === "" ? null : Number(bankPctRaw) / 100;
  const shareRaw = String(formData.get("oa_inst_share") ?? "cpf100").trim();
  const sourceRaw = String(formData.get("payment_source") ?? "").trim();
  const sourceParsed = housingPaymentSourceSchema.safeParse(sourceRaw);
  const paymentSourceQuick = sourceParsed.success
    ? sourceParsed.data
    : paymentSourceFromLegacyPreset(shareRaw);
  const oaShareOfPayment =
    paymentSourceQuick === "cash"
      ? 0
      : paymentSourceQuick === "cpf_oa"
        ? 1
        : oaInstalmentShareFromPreset(shareRaw);

  const guidedPresetRaw = String(formData.get("guided_dp_preset") ?? "").trim();
  const depositTotalLegacyRaw = String(formData.get("deposit_total") ?? "").trim();
  const bsdPaymentRaw = String(formData.get("bsd_payment") ?? "cpf_oa")
    .trim()
    .toLowerCase();
  const buyers_stamp_duty_paid_from_cpf_oa = bsdPaymentRaw !== "cash";

  const propertyKindRaw = String(formData.get("property_kind") ?? "").trim();
  let property_kind: string | null = null;
  if (propertyKindRaw !== "") {
    const pk = housingPropertyKindSchema.safeParse(propertyKindRaw);
    if (!pk.success) {
      return { error: "Invalid property type" };
    }
    property_kind = pk.data;
  }

  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { error: "Purchase price must be positive" };
  }

  if (
    lenderType !== "hdb" &&
    bankAnnualRate != null &&
    (!Number.isFinite(bankAnnualRate) || bankAnnualRate < 0 || bankAnnualRate > 0.2)
  ) {
    return { error: "Bank rate must be blank or between 0% and 20% p.a." };
  }

  if (!Number.isFinite(depositFromOa) || depositFromOa < 0) {
    return { error: "Invalid deposit from OA" };
  }
  if (!Number.isFinite(feesFromOa) || feesFromOa < 0) {
    return { error: "Invalid fees from OA" };
  }

  const bsdComputed = computeSingaporeResidentialBuyersStampDuty(purchasePrice);

  let depositTotal: number;
  let planning:
    | {
        property_purchase_price: number;
        property_kind: typeof property_kind;
        downpayment_guidance_preset: string;
        downpayment_guidance_custom_percent: number | null;
        downpayment_guidance_custom_amount: number | null;
        buyers_stamp_duty: number;
        buyers_stamp_duty_paid_from_cpf_oa: boolean;
      }
    | undefined;

  if (guidedPresetRaw === "") {
    const depositTotalLegacy =
      depositTotalLegacyRaw === "" ? NaN : Number(depositTotalLegacyRaw);
    if (!Number.isFinite(depositTotalLegacy) || depositTotalLegacy < 0) {
      return { error: "Total deposit must be a valid number ≥ 0" };
    }
    depositTotal = depositTotalLegacy;
    planning = undefined;
  } else {
    const presetParsed =
      housingDownpaymentGuidancePresetSchema.safeParse(guidedPresetRaw);
    if (!presetParsed.success) {
      return { error: "Invalid downpayment option" };
    }
    const preset = presetParsed.data;
    const customMode = String(formData.get("guided_dp_custom_mode") ?? "percent")
      .trim()
      .toLowerCase();
    const preferAmount = customMode === "amount";

    const customPctField = String(
      formData.get("guided_dp_custom_percent") ?? ""
    ).trim();
    const customAmtField = String(
      formData.get("guided_dp_custom_amount") ?? ""
    ).trim();
    const customPercentDec =
      customPctField === "" || preferAmount
        ? null
        : Number(customPctField) / 100;
    const customAmountVal =
      customAmtField === "" || !preferAmount
        ? null
        : Number(customAmtField);

    const resolved = resolveGuidedCashDownpayment({
      purchasePrice,
      preset,
      customPercent: customPercentDec,
      customAmount: customAmountVal,
    });
    if (!resolved.ok) {
      return { error: resolved.error };
    }
    depositTotal = resolved.depositTotal;

    planning = {
      property_purchase_price: purchasePrice,
      property_kind,
      downpayment_guidance_preset: preset,
      downpayment_guidance_custom_percent:
        preset === "custom" &&
        !preferAmount &&
        customPercentDec != null &&
        Number.isFinite(customPercentDec)
          ? customPercentDec
          : null,
      downpayment_guidance_custom_amount:
        preset === "custom" &&
        preferAmount &&
        customAmountVal != null &&
        Number.isFinite(customAmountVal)
          ? customAmountVal
          : null,
      buyers_stamp_duty: bsdComputed.total,
      buyers_stamp_duty_paid_from_cpf_oa,
    };
  }

  const derived = deriveQuickHousingLoanRow({
    label,
    purchasePrice,
    depositTotal,
    depositFromOa,
    feesFromOa,
    loanTermYears,
    firstPaymentMonth: first_payment_month,
    lenderType,
    bankAnnualRate:
      lenderType === "hdb"
        ? null
        : bankAnnualRate != null && Number.isFinite(bankAnnualRate)
          ? bankAnnualRate
          : null,
    oaShareOfPayment,
    buyersStampDuty: bsdComputed.total,
    payBuyersStampDutyFromCpfOa:
      planning != null ? planning.buyers_stamp_duty_paid_from_cpf_oa : false,
  });

  if (!derived.ok) {
    return { error: derived.error };
  }

  const paymentSource = paymentSourceQuick;
  const loanPaymentBase = {
    principal: derived.principal,
    annual_nominal_rate: derived.annual_nominal_rate,
    term_months: derived.term_months,
    first_payment_month: derived.first_payment_month,
    oa_share_of_payment: derived.oa_share_of_payment,
  };
  const cpfRaw = String(formData.get("cpf_oa_payment") ?? "").trim();
  const cashRaw = String(formData.get("cash_payment") ?? "").trim();
  const cpfOaPayment = cpfRaw === "" ? null : Number(cpfRaw);
  const cashPayment = cashRaw === "" ? null : Number(cashRaw);
  const paymentNormalized = normalizeHousingPaymentForPersist(
    {
      ...loanPaymentBase,
      payment_source: paymentSource,
      cpf_oa_payment: cpfOaPayment,
      cash_payment: cashPayment,
    },
    { paymentSource, cpfOaPayment, cashPayment }
  );
  if ("error" in paymentNormalized) {
    return { error: paymentNormalized.error };
  }

  const propertyTypeForQuick =
    property_kind != null &&
    housingPropertyTypeSchema.safeParse(property_kind).success
      ? (property_kind as import("@/data/supabase/types").PropertyRow["property_type"])
      : "unknown";

  const property = await insertPropertyForLoan(supabase, user.id, {
    name: derived.label,
    property_type: propertyTypeForQuick,
    purchase_price: purchasePrice,
    status: "living_in",
  });

  await insertHousingLoan(supabase, user.id, {
    property_id: property.id,
    label: derived.label,
    principal: derived.principal,
    annual_nominal_rate: derived.annual_nominal_rate,
    term_months: derived.term_months,
    completion_month: derived.completion_month,
    first_payment_month: derived.first_payment_month,
    downpayment_from_oa: derived.downpayment_from_oa,
    fees_from_oa: derived.fees_from_oa,
    oa_share_of_payment: paymentNormalized.oa_share_of_payment,
    max_oa_per_month: derived.max_oa_per_month,
    lender_type: derived.lender_type,
    original_loan_principal: derived.original_loan_principal,
    principal_repaid_before_schedule: derived.principal_repaid_before_schedule,
    property_purchase_price: planning?.property_purchase_price ?? null,
    property_kind: planning?.property_kind ?? null,
    downpayment_guidance_preset: planning?.downpayment_guidance_preset ?? null,
    downpayment_guidance_custom_percent:
      planning?.downpayment_guidance_custom_percent ?? null,
    downpayment_guidance_custom_amount:
      planning?.downpayment_guidance_custom_amount ?? null,
    buyers_stamp_duty: planning?.buyers_stamp_duty ?? null,
    financing_includes_bsd: false,
    buyers_stamp_duty_paid_from_cpf_oa:
      planning?.buyers_stamp_duty_paid_from_cpf_oa ?? false,
    payment_source: paymentNormalized.payment_source,
    cpf_oa_payment: paymentNormalized.cpf_oa_payment,
    cash_payment: paymentNormalized.cash_payment,
  });
  revalidateHousingPaths();
  return { error: null };
}

export async function updateHousingLoanAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return { error: "Invalid loan" };

  const label = String(formData.get("label") ?? "").trim() || "Home loan";
  const principal = Number(formData.get("principal"));
  const annual_nominal_rate = Number(formData.get("annual_nominal_rate"));
  const term_months = Math.round(Number(formData.get("term_months")));
  const completion_month = String(formData.get("completion_month") ?? "").trim();
  const first_payment_month = String(
    formData.get("first_payment_month") ?? ""
  ).trim();
  const downpayment_from_oa = Number(formData.get("downpayment_from_oa"));
  const fees_from_oa = Number(formData.get("fees_from_oa"));
  const maxRaw = String(formData.get("max_oa_per_month") ?? "").trim();
  const max_oa_per_month =
    maxRaw === "" ? null : Number(maxRaw);
  const lenderRaw = String(formData.get("lender_type") ?? "hdb").trim();
  const lenderParsed = housingLenderTypeSchema.safeParse(lenderRaw);
  const lender_type = lenderParsed.success ? lenderParsed.data : "hdb";
  const origRaw = String(formData.get("original_loan_principal") ?? "").trim();
  const original_loan_principal =
    origRaw === "" ? null : Number(origRaw);
  const repaidRaw = String(
    formData.get("principal_repaid_before_schedule") ?? ""
  ).trim();
  const principal_repaid_before_schedule =
    repaidRaw === "" ? 0 : Number(repaidRaw);

  if (!Number.isFinite(principal) || principal <= 0) {
    return { error: "Outstanding principal must be positive" };
  }
  if (!Number.isFinite(annual_nominal_rate) || annual_nominal_rate < 0) {
    return { error: "Annual rate must be ≥ 0 (decimal, e.g. 0.025)" };
  }
  if (!Number.isFinite(term_months) || term_months <= 0 || term_months > 600) {
    return { error: "Term must be 1–600 months" };
  }
  if (!yearMonthSchema.safeParse(completion_month).success) {
    return { error: "Completion month must be YYYY-MM" };
  }
  if (!yearMonthSchema.safeParse(first_payment_month).success) {
    return { error: "First payment month must be YYYY-MM" };
  }
  if (!Number.isFinite(downpayment_from_oa) || downpayment_from_oa < 0) {
    return { error: "Invalid downpayment from OA" };
  }
  if (!Number.isFinite(fees_from_oa) || fees_from_oa < 0) {
    return { error: "Invalid fees from OA" };
  }
  if (
    max_oa_per_month != null &&
    (!Number.isFinite(max_oa_per_month) || max_oa_per_month < 0)
  ) {
    return { error: "Max OA per month must be blank or ≥ 0" };
  }
  if (
    original_loan_principal != null &&
    (!Number.isFinite(original_loan_principal) ||
      original_loan_principal <= 0)
  ) {
    return { error: "Original loan amount must be blank or positive" };
  }
  if (
    !Number.isFinite(principal_repaid_before_schedule) ||
    principal_repaid_before_schedule < 0
  ) {
    return { error: "Principal repaid must be ≥ 0" };
  }

  const annual_nominal_rate_effective =
    lender_type === "hdb" ? HDB_CONCESSIONARY_RATE_ANNUAL : annual_nominal_rate;

  const paymentParsed = parseHousingPaymentForm(formData, {
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    first_payment_month,
    oa_share_of_payment: Number(formData.get("oa_share_of_payment")) || 0,
  });
  if ("error" in paymentParsed) return paymentParsed;
  const {
    payment_source,
    cpf_oa_payment,
    cash_payment,
    oa_share_of_payment,
  } = paymentParsed;

  await updateHousingLoan(supabase, user.id, idParsed.data, {
    label,
    principal,
    annual_nominal_rate: annual_nominal_rate_effective,
    term_months,
    completion_month,
    first_payment_month,
    downpayment_from_oa,
    fees_from_oa,
    oa_share_of_payment,
    max_oa_per_month,
    lender_type,
    original_loan_principal,
    principal_repaid_before_schedule,
    payment_source,
    cpf_oa_payment,
    cash_payment,
  });
  revalidateHousingPaths();
  return { error: null };
}

export async function deleteHousingLoanAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? "").trim());
  if (!idParsed.success) return;
  try {
    await deleteHousingLoan(supabase, user.id, idParsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidateHousingPaths();
}
