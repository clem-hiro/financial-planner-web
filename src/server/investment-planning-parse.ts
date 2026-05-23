export type InvestmentPlanNature =
  | "pure_investment"
  | "includes_insurance_coverage";

export type ParsedInvestmentPlanningFields = {
  contribution_type: string | null;
  contribution_duration_years: number | null;
  contribution_start_date: string | null;
  contribution_end_date: string | null;
  plan_nature: InvestmentPlanNature | null;
  contribution_growth_annual: number;
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
  const contributionTypeRaw = String(
    formData.get("contribution_type") ?? ""
  ).trim();
  const isFixed = contributionTypeRaw === "fixed_duration";
  const scheduleMode = String(formData.get("contribution_schedule_mode") ?? "")
    .trim();

  let contribution_type: string | null = null;
  let contribution_duration_years: number | null = null;
  let contribution_start_date: string | null = null;
  let contribution_end_date: string | null = null;

  if (isFixed) {
    contribution_type = "fixed_duration";

    if (scheduleMode === "calendar_dates") {
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

  const planNatureRaw = String(formData.get("plan_nature") ?? "").trim();
  let plan_nature: InvestmentPlanNature | null = null;
  if (planNatureRaw === "pure_investment") {
    plan_nature = "pure_investment";
  } else if (planNatureRaw === "includes_insurance_coverage") {
    plan_nature = "includes_insurance_coverage";
  } else if (planNatureRaw !== "") {
    return { ok: false, error: "Select what this plan is mainly for" };
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
  const withdrawal_start_years =
    withdrawalStartRaw === "" ? null : Number(withdrawalStartRaw);
  if (
    withdrawal_start_years != null &&
    (!Number.isFinite(withdrawal_start_years) || withdrawal_start_years < 0)
  ) {
    return { ok: false, error: "Withdrawal start must be 0 or more years." };
  }

  return {
    ok: true,
    contribution_type,
    contribution_duration_years,
    contribution_start_date,
    contribution_end_date,
    plan_nature,
    contribution_growth_annual: contributionGrowthAnnual,
    withdrawal_monthly: withdrawalMonthly,
    withdrawal_start_years,
  };
}
