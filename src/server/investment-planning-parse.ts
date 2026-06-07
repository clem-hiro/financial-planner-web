import type { InvestmentPlanNature } from "@/lib/investment-plan-nature";

export type { InvestmentPlanNature } from "@/lib/investment-plan-nature";

export type ParsedInvestmentPlanningFields = {
  contribution_type: string | null;
  contribution_duration_years: number | null;
  contribution_start_date: string | null;
  contribution_end_date: string | null;
  plan_nature: InvestmentPlanNature | null;
  investment_income_rate_annual: number;
  contribution_growth_annual: number;
  withdrawal_annual: number;
  withdrawal_monthly: number;
  withdrawal_start_years: number | null;
};

function parseIsoDateField(
  raw: string,
  label: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: `${label} must be YYYY-MM-DD` };
  }
  const d = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Invalid ${label.toLowerCase()}` };
  }
  return { ok: true, value: raw };
}

export function parseInvestmentPlanningFields(formData: FormData):
  | { ok: true } & ParsedInvestmentPlanningFields
  | { ok: false; error: string } {
  const planNatureRaw = String(formData.get("plan_nature") ?? "").trim();
  let plan_nature: InvestmentPlanNature | null = null;
  if (planNatureRaw === "pure_investment") {
    plan_nature = "pure_investment";
  } else if (planNatureRaw === "includes_insurance_coverage") {
    plan_nature = "includes_insurance_coverage";
  } else if (planNatureRaw !== "") {
    return { ok: false, error: "Select what this plan is mainly for" };
  }
  const isIlp = plan_nature === "includes_insurance_coverage";

  const contributionTypeRaw = String(
    formData.get("contribution_type") ?? ""
  ).trim();
  const isFixed = isIlp || contributionTypeRaw === "fixed_duration";
  const scheduleMode = String(formData.get("contribution_schedule_mode") ?? "")
    .trim();

  let contribution_type: string | null = null;
  let contribution_duration_years: number | null = null;
  let contribution_start_date: string | null = null;
  let contribution_end_date: string | null = null;

  if (isFixed) {
    contribution_type = "fixed_duration";

    if (scheduleMode === "calendar_dates" && !isIlp) {
      const startParsed = parseIsoDateField(
        String(formData.get("contribution_start_date") ?? "").trim(),
        "Start date"
      );
      if (!startParsed.ok) return startParsed;
      const endParsed = parseIsoDateField(
        String(formData.get("contribution_end_date") ?? "").trim(),
        "End date"
      );
      if (!endParsed.ok) return endParsed;
      if (!endParsed.value) {
        return { ok: false, error: "Enter the last premium or contribution date" };
      }
      contribution_start_date = startParsed.value;
      contribution_end_date = endParsed.value;
      if (
        contribution_start_date &&
        contribution_end_date < contribution_start_date
      ) {
        return {
          ok: false,
          error: "End date must be on or after the start date",
        };
      }
    } else {
      if (isIlp) {
        const startParsed = parseIsoDateField(
          String(formData.get("contribution_start_date") ?? "").trim(),
          "Plan start date"
        );
        if (!startParsed.ok) return startParsed;
        if (!startParsed.value) {
          return { ok: false, error: "Enter the ILP plan start date" };
        }
        contribution_start_date = startParsed.value;
        contribution_end_date = null;
      }
      const y = Number(formData.get("contribution_duration_years"));
      if (!Number.isFinite(y) || y <= 0 || y > 80) {
        return {
          ok: false,
          error: "Enter contribution duration in years (between 0.25 and 80)",
        };
      }
      contribution_duration_years = y;
    }
  } else if (contributionTypeRaw === "until_retirement") {
    contribution_type = "until_retirement";
    contribution_duration_years = null;
    contribution_start_date = null;
    contribution_end_date = null;
  }

  const investmentIncomeRateAnnual = Number(
    formData.get("investment_income_rate_annual") ?? 0
  );
  if (
    !Number.isFinite(investmentIncomeRateAnnual) ||
    investmentIncomeRateAnnual < 0 ||
    investmentIncomeRateAnnual > 1
  ) {
    return { ok: false, error: "Investment income rate must be 0-100%." };
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

  const withdrawalAnnualRaw = formData.get("withdrawal_annual");
  const withdrawalAnnual =
    withdrawalAnnualRaw == null
      ? Number(formData.get("withdrawal_monthly") ?? 0) * 12
      : Number(withdrawalAnnualRaw);
  if (!Number.isFinite(withdrawalAnnual) || withdrawalAnnual < 0) {
    return { ok: false, error: "Invalid yearly withdrawal" };
  }
  const withdrawalMonthly = withdrawalAnnual / 12;

  const withdrawalStartRaw = String(
    formData.get("withdrawal_start_years") ?? ""
  ).trim();
  const withdrawalStartAgeRaw = String(
    formData.get("withdrawal_start_age") ?? ""
  ).trim();
  const withdrawalCurrentAgeRaw = String(
    formData.get("withdrawal_current_age") ?? ""
  ).trim();
  let withdrawal_start_years =
    withdrawalStartRaw === "" ? null : Number(withdrawalStartRaw);

  if (withdrawalStartAgeRaw !== "") {
    const withdrawalStartAge = Number(withdrawalStartAgeRaw);
    const withdrawalCurrentAge = Number(withdrawalCurrentAgeRaw);
    if (
      !Number.isFinite(withdrawalStartAge) ||
      withdrawalStartAge < 0 ||
      withdrawalStartAge > 120 ||
      !Number.isFinite(withdrawalCurrentAge) ||
      withdrawalCurrentAge < 0 ||
      withdrawalCurrentAge > 120
    ) {
      return { ok: false, error: "Withdrawal start age must be a valid age." };
    }
    withdrawal_start_years = Math.max(0, withdrawalStartAge - withdrawalCurrentAge);
  }

  if (
    withdrawal_start_years != null &&
    (!Number.isFinite(withdrawal_start_years) || withdrawal_start_years < 0)
  ) {
    return { ok: false, error: "Withdrawal start must be 0 or more years." };
  }

  if (
    isIlp &&
    withdrawalAnnual > 0 &&
    contribution_start_date != null &&
    contribution_duration_years != null
  ) {
    const maturityYearsFromToday = Math.max(
      0,
      yearsFromTodayToIlpMaturity(
        contribution_start_date,
        contribution_duration_years
      )
    );
    if (withdrawal_start_years == null) {
      withdrawal_start_years = maturityYearsFromToday;
    } else if (withdrawal_start_years + 1e-9 < maturityYearsFromToday) {
      return {
        ok: false,
        error: "ILP yearly withdrawal cannot start before plan maturity.",
      };
    }
  }

  return {
    ok: true,
    contribution_type,
    contribution_duration_years,
    contribution_start_date,
    contribution_end_date,
    plan_nature,
    investment_income_rate_annual: investmentIncomeRateAnnual,
    contribution_growth_annual: contributionGrowthAnnual,
    withdrawal_annual: withdrawalAnnual,
    withdrawal_monthly: withdrawalMonthly,
    withdrawal_start_years,
  };
}

function yearsFromTodayToIlpMaturity(
  planStartDate: string,
  durationYears: number
): number {
  const start = new Date(`${planStartDate}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return 0;
  const maturity = new Date(start.getTime());
  maturity.setMonth(maturity.getMonth() + Math.round(durationYears * 12));
  const today = new Date();
  const months =
    (maturity.getFullYear() - today.getFullYear()) * 12 +
    (maturity.getMonth() - today.getMonth()) -
    (maturity.getDate() < today.getDate() ? 1 : 0);
  return Math.max(0, months) / 12;
}
