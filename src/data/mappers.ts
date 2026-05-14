import type {
  BudgetLineRow,
  ExpenseRow,
  FinancialGoalRow,
  IncomeTaxConfigRow,
  InvestmentRow,
  ProfileRow,
  VehicleRow,
} from "@/data/supabase/types";
import type { VehicleValuationInput } from "@/domain/finance/vehicle-sg";
import {
  annualEmployeeCpfTakeHomeWithBonusSg,
  isSgCpfAgeBand,
  monthlyEmployeeCpfTakeHomeSg,
} from "@/domain/finance/sg-cpf";
import type {
  BudgetLineForDomain,
  ExpenseForBudget,
} from "@/domain/finance/budget";
import type { IncomeTaxReliefBundle } from "@/domain/finance/sg-income-tax";

export function num(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Sum of positive `monthly_contribution` across goals (same basis as dashboard). */
export function sumPlannedMonthlyGoalContributions(
  goals: FinancialGoalRow[]
): number {
  return goals.reduce(
    (sum, g) => sum + Math.max(0, num(g.monthly_contribution)),
    0
  );
}

export function profileMonthlyIncome(profile: ProfileRow | null): number | null {
  if (!profile?.monthly_income) return null;
  const n = num(profile.monthly_income);
  return n > 0 ? n : null;
}

/**
 * Monthly take-home used for budgeting and cash-flow summaries: salary only after
 * employee CPF when gross + age band are set; otherwise stored `monthly_income`.
 */
export function profileSalaryTakeHomeMonthly(
  profile: ProfileRow | null,
  cpfReferenceYearMonth: string
): number | null {
  const gross = profileMonthlyGross(profile);
  const bandRaw = profileCpfAgeBand(profile);
  if (
    gross != null &&
    gross > 0 &&
    bandRaw != null &&
    isSgCpfAgeBand(bandRaw) &&
    /^\d{4}-\d{2}$/.test(cpfReferenceYearMonth)
  ) {
    const { takeHome } = monthlyEmployeeCpfTakeHomeSg(
      gross,
      cpfReferenceYearMonth,
      bandRaw
    );
    return takeHome > 0 ? takeHome : null;
  }
  return profileMonthlyIncome(profile);
}

/**
 * Annual bonus as cash after employee CPF on AW (lump). When gross/CPF band are
 * missing, returns gross bonus unchanged (no AW CPF estimate).
 */
export function profileAnnualBonusTakeHomeCash(
  profile: ProfileRow | null,
  cpfReferenceYearMonth: string
): number {
  const bonus = profileAnnualBonus(profile);
  if (bonus <= 0) return 0;
  const gross = profileMonthlyGross(profile);
  const bandRaw = profileCpfAgeBand(profile);
  if (
    gross == null ||
    gross <= 0 ||
    bandRaw == null ||
    !isSgCpfAgeBand(bandRaw) ||
    !/^\d{4}-\d{2}$/.test(cpfReferenceYearMonth)
  ) {
    return bonus;
  }
  return annualEmployeeCpfTakeHomeWithBonusSg(
    gross,
    bonus,
    cpfReferenceYearMonth,
    bandRaw
  ).takeHomeFromBonusNetAnnual;
}

export function profileMonthlyGross(profile: ProfileRow | null): number | null {
  if (!profile?.monthly_gross_salary) return null;
  const n = num(profile.monthly_gross_salary);
  return n > 0 ? n : null;
}

export function profileAnnualBonus(profile: ProfileRow | null): number {
  if (!profile?.annual_bonus) return 0;
  const n = num(profile.annual_bonus);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function profileCpfAgeBand(
  profile: ProfileRow | null
): string | null {
  return profile?.cpf_age_band ?? null;
}

/** Clamped 0–25% nominal per year; null/blank in DB → 0. */
export function profileAnnualSalaryGrowthNominal(
  profile: ProfileRow | null
): number {
  if (!profile?.annual_salary_growth_nominal) return 0;
  const n = num(profile.annual_salary_growth_nominal);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(0.25, n);
}

/** Clamped 0–20% annual withdrawal rate; null/blank in DB uses 4% default at call-site. */
export function profileRetirementWithdrawalRateAnnual(
  profile: ProfileRow | null
): number | null {
  if (!profile?.retirement_withdrawal_rate_annual) return null;
  const n = num(profile.retirement_withdrawal_rate_annual);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(0.2, n);
}

export function vehicleRowToValuationInput(row: VehicleRow): VehicleValuationInput {
  const marketRaw = row.current_market_value;
  const arfRaw = row.arf_for_parf;
  const bodyRaw = row.body_open_market_at_purchase;
  const rateRaw = row.loan_annual_nominal_rate;
  const parfD = row.parf_if_deregistered_today;
  const coeD = row.coe_if_deregistered_today;
  const bodyScrapD = row.body_scrap_if_deregistered_today;
  const coeEx = row.coe_expiry_ym;
  const loanEnd = row.loan_end_ym;
  const termRec = row.terminal_recovery_at_coe_expiry;
  return {
    vehicleStatus: row.vehicle_status,
    currentMarketValue:
      marketRaw != null && String(marketRaw).trim() !== ""
        ? num(marketRaw)
        : null,
    firstRegistrationYm: row.first_registration_ym,
    onTheRoadPaid: num(row.on_the_road_paid),
    arfForParf:
      arfRaw != null && String(arfRaw).trim() !== "" ? num(arfRaw) : null,
    bodyOpenMarketAtPurchase:
      bodyRaw != null && String(bodyRaw).trim() !== ""
        ? num(bodyRaw)
        : null,
    bodyDepreciationYears: row.body_depreciation_years,
    coeExpiryYm:
      coeEx != null && String(coeEx).trim() !== "" ? String(coeEx).trim() : null,
    terminalRecoveryAtCoeExpiry:
      termRec != null && String(termRec).trim() !== ""
        ? num(termRec)
        : null,
    parfIfDeregisteredToday:
      parfD != null && String(parfD).trim() !== "" ? num(parfD) : null,
    coeIfDeregisteredToday:
      coeD != null && String(coeD).trim() !== "" ? num(coeD) : null,
    bodyScrapIfDeregisteredToday:
      bodyScrapD != null && String(bodyScrapD).trim() !== ""
        ? num(bodyScrapD)
        : null,
    loanBalanceStored: num(row.loan_balance),
    loanMonthlyPayment: num(row.loan_monthly_payment),
    loanMonthsRemaining: row.loan_months_remaining,
    loanEndYm:
      loanEnd != null && String(loanEnd).trim() !== ""
        ? String(loanEnd).trim()
        : null,
    loanAnnualNominalRate:
      rateRaw != null && String(rateRaw).trim() !== ""
        ? num(rateRaw)
        : null,
    loanPreferStoredBalance: row.loan_prefer_stored_balance === true,
    loanSimpleRemainingEstimate: row.loan_simple_remaining_estimate === true,
  };
}

export function sumExpenseAmounts(rows: ExpenseRow[]): number {
  return rows.reduce((acc, r) => acc + num(r.amount), 0);
}

export function investmentValues(rows: InvestmentRow[]): number[] {
  return rows.map((r) => num(r.current_value));
}

export function expenseRowToBudgetExpense(row: ExpenseRow): ExpenseForBudget {
  return {
    category: row.category,
    amount: num(row.amount),
    spendPeriod: row.spend_period ?? "monthly",
  };
}

/**
 * Camelcase relief bundle + rebate pair derived from a stored config row. Numeric
 * columns come back as strings from Supabase; `num()` parses them once at the seam
 * so the domain layer never deals with string-numerics. Annual income, age, and
 * CPF relief are added by callers — they live on the profile, not on this row.
 */
export type IncomeTaxConfigDomain = {
  yearOfAssessment: number;
  reliefs: IncomeTaxReliefBundle;
  rebatePercent: number | null;
  rebateCapSgd: number | null;
  paymentMethod: "monthly_giro" | "one_time";
};

export function incomeTaxConfigRowToDomain(
  row: IncomeTaxConfigRow
): IncomeTaxConfigDomain {
  return {
    yearOfAssessment: row.year_of_assessment,
    reliefs: {
      spouseReliefSgd: num(row.spouse_relief_sgd),
      qualifyingChildReliefSgd: num(row.qualifying_child_relief_sgd),
      handicappedChildReliefSgd: num(row.handicapped_child_relief_sgd),
      workingMotherChildReliefSgd: num(row.working_mother_child_relief_sgd),
      parentReliefSgd: num(row.parent_relief_sgd),
      grandparentCaregiverReliefSgd: num(row.grandparent_caregiver_relief_sgd),
      handicappedSiblingReliefSgd: num(row.handicapped_sibling_relief_sgd),
      cpfCashTopupSelfSgd: num(row.cpf_cash_topup_self_sgd),
      cpfCashTopupFamilySgd: num(row.cpf_cash_topup_family_sgd),
      srsContributionSgd: num(row.srs_contribution_sgd),
      cpfMedisaveVoluntarySgd: num(row.cpf_medisave_voluntary_sgd),
      nsmanSelfReliefSgd: num(row.nsman_self_relief_sgd),
      nsmanWifeReliefSgd: num(row.nsman_wife_relief_sgd),
      nsmanParentReliefSgd: num(row.nsman_parent_relief_sgd),
      courseFeesReliefSgd: num(row.course_fees_relief_sgd),
      lifeInsuranceReliefSgd: num(row.life_insurance_relief_sgd),
      otherReliefsAmountSgd: num(row.other_reliefs_amount_sgd),
    },
    rebatePercent: row.tax_rebate_percent != null ? num(row.tax_rebate_percent) : null,
    rebateCapSgd: row.tax_rebate_cap_sgd != null ? num(row.tax_rebate_cap_sgd) : null,
    paymentMethod: row.payment_method,
  };
}

export function budgetLineRowToDomain(row: BudgetLineRow): BudgetLineForDomain {
  return {
    id: row.id,
    category: row.category,
    cadence: row.cadence,
    amount: num(row.amount),
    calendarYear:
      row.calendar_year != null ? Number(row.calendar_year) : null,
    startYearMonth: row.start_year_month ?? null,
    endYearMonth: row.end_year_month ?? null,
  };
}
