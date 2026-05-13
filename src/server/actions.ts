"use server";

import { revalidatePath } from "next/cache";
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
import { profileMonthlyIncome } from "@/data/mappers";
import { isValidYearMonth } from "@/domain/finance";
import {
  generateGuidedMonthlyBudgetLines,
  type BudgetingStrategyId,
  type FoodSpendBandId,
  type LifestyleProfileId,
} from "@/domain/finance/budget-guided-setup";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  insertFinancialGoal,
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
  insertInvestment,
  updateInvestment,
} from "@/data/repositories/investments";
import {
  deriveQuickHousingLoanRow,
  HDB_CONCESSIONARY_RATE_ANNUAL,
  oaInstalmentShareFromPreset,
} from "@/domain/finance/housing-loan-quick";
import { resolveGuidedCashDownpayment } from "@/domain/finance/property-financing-plan";
import { computeSingaporeResidentialBuyersStampDuty } from "@/domain/finance/singapore-residential-bsd";
import {
  housingDownpaymentGuidancePresetSchema,
  housingLenderTypeSchema,
  housingPropertyKindSchema,
  yearMonthSchema,
} from "@/lib/validation";
import { z } from "zod";

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
  }

  await insertInvestment(supabase, user.id, {
    name,
    current_value: currentValue,
    monthly_contribution: monthlyContribution,
    expected_annual_return: expectedAnnualReturn,
    contribution_type,
    contribution_duration_years,
  });

  revalidatePath("/balances");
  revalidatePath("/dashboard");
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
  }

  await updateInvestment(supabase, user.id, idParsed.data, {
    name,
    current_value: currentValue,
    monthly_contribution: monthlyContribution,
    expected_annual_return: expectedAnnualReturn,
    contribution_type,
    contribution_duration_years,
  });

  revalidatePath("/balances");
  revalidatePath("/dashboard");
  return { error: null as string | null };
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

  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance"));
  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "Invalid balance" };
  }

  await insertCashAccount(supabase, user.id, { name, balance });
  revalidatePath("/balances");
  revalidatePath("/dashboard");
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

  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance"));
  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "Invalid balance" };
  }

  await updateCashAccount(supabase, user.id, idParsed.data, { name, balance });
  revalidatePath("/balances");
  revalidatePath("/dashboard");
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

  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance"));
  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "Invalid balance (amount owed)" };
  }

  await insertLiability(supabase, user.id, { name, balance });
  revalidatePath("/balances");
  revalidatePath("/dashboard");
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

  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance"));
  if (!name) return { error: "Name is required" };
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "Invalid balance (amount owed)" };
  }

  await updateLiability(supabase, user.id, idParsed.data, { name, balance });
  revalidatePath("/balances");
  revalidatePath("/dashboard");
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
    await deleteLiability(supabase, user.id, parsed.data);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/balances");
  revalidatePath("/dashboard");
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

  revalidatePath("/goals");
  revalidatePath("/setup");
  revalidatePath("/dashboard");
  return { error: null as string | null };
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

  revalidatePath("/goals");
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
 * Skips when any monthly lines already exist (avoid duplicates / unique index).
 */
export async function applyGuidedBudgetLinesAction(
  _prev: { error: string | null },
  _formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const [profile, existingLines] = await Promise.all([
    getProfileById(supabase, user.id),
    listBudgetLines(supabase, user.id),
  ]);

  const monthlyExisting = existingLines.filter((l) => l.cadence === "monthly");
  if (monthlyExisting.length > 0) {
    return {
      error:
        "You already have monthly budget lines. Adjust or add categories on the Budget page instead.",
    };
  }

  const income = profileMonthlyIncome(profile);
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
  revalidatePath("/setup");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
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
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
  revalidatePath("/setup");
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
  const oa_share_of_payment = Number(formData.get("oa_share_of_payment"));
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
    !Number.isFinite(oa_share_of_payment) ||
    oa_share_of_payment < 0 ||
    oa_share_of_payment > 1
  ) {
    return { error: "OA share of payment must be 0–1" };
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

  await insertHousingLoan(supabase, user.id, {
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
  });
  revalidatePath("/dashboard");
  revalidatePath("/balances");
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
  const oaShareOfPayment = oaInstalmentShareFromPreset(shareRaw);

  const guidedPresetRaw = String(formData.get("guided_dp_preset") ?? "").trim();
  const depositTotalLegacyRaw = String(formData.get("deposit_total") ?? "").trim();
  const includeBsdRaw = String(formData.get("financing_include_bsd") ?? "").trim();
  const financing_include_bsd =
    includeBsdRaw === "1" || includeBsdRaw === "true" || includeBsdRaw === "on";

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
        financing_includes_bsd: boolean;
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
      financing_includes_bsd: financing_include_bsd,
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
    includeBuyersStampDutyInLoan:
      planning != null ? planning.financing_includes_bsd : false,
  });

  if (!derived.ok) {
    return { error: derived.error };
  }

  await insertHousingLoan(supabase, user.id, {
    label: derived.label,
    principal: derived.principal,
    annual_nominal_rate: derived.annual_nominal_rate,
    term_months: derived.term_months,
    completion_month: derived.completion_month,
    first_payment_month: derived.first_payment_month,
    downpayment_from_oa: derived.downpayment_from_oa,
    fees_from_oa: derived.fees_from_oa,
    oa_share_of_payment: derived.oa_share_of_payment,
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
    financing_includes_bsd: planning?.financing_includes_bsd ?? false,
  });
  revalidatePath("/dashboard");
  revalidatePath("/balances");
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
  const oa_share_of_payment = Number(formData.get("oa_share_of_payment"));
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
    !Number.isFinite(oa_share_of_payment) ||
    oa_share_of_payment < 0 ||
    oa_share_of_payment > 1
  ) {
    return { error: "OA share of payment must be 0–1 (e.g. 0.5 for half)" };
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
  });
  revalidatePath("/dashboard");
  revalidatePath("/balances");
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
  revalidatePath("/dashboard");
  revalidatePath("/balances");
}
