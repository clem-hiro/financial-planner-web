"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { markInboxItemReadByDedupeKeyAction } from "@/server/inbox-actions";
import { ageCompletedOnDate } from "@/domain/finance/age-projection";
import type { SgCpfAgeBand } from "@/domain/finance/sg-cpf";
import {
  annualEmployeeCpfTakeHomeWithBonusSg,
} from "@/domain/finance/sg-cpf";
import { sgCpfAgeBandForCompletedAge } from "@/domain/finance/sg-cpf-contribution-buckets";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpPrimaryButtonClass,
} from "@/ui/input-classes";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appCardClass } from "@/ui/surface-classes";

const CPF_BANDS: { value: SgCpfAgeBand; label: string }[] = [
  { value: "below_55", label: "Below 55" },
  { value: "above_55_to_60", label: "55 to below 60" },
  { value: "above_60_to_65", label: "60 to below 65" },
  { value: "above_65_to_70", label: "65 to below 70" },
  { value: "above_70", label: "70 and above" },
];

const MONTH_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 12 },
  (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }),
  })
);

function isSgCpfAgeBand(s: string | null): s is SgCpfAgeBand {
  return s != null && CPF_BANDS.some((b) => b.value === s);
}

function derivedCpfBandFromBirthDate(
  birthDate: string
): SgCpfAgeBand | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const age = ageCompletedOnDate(birthDate, new Date());
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  return sgCpfAgeBandForCompletedAge(age);
}

export function ProfileIncomeForm({
  initialIncome,
  initialGross,
  initialCpfAgeBand,
  initialBirthDate,
  initialTargetRetirementAge,
  initialRetirementMonthlySpendGoal,
  initialRetirementDividendYieldPercent,
  initialAnnualSalaryGrowthPercent = null,
  initialExpenseGrowthPercent = null,
  initialAnnualBonus = null,
  initialRetirementWithdrawalRatePercent = null,
  initialSalaryIncrementMonth = null,
  cpfYearMonth,
  currencyCode = DEFAULT_BASE_CURRENCY,
}: {
  initialIncome: number | null;
  initialGross: number | null;
  initialCpfAgeBand: string | null;
  /** `YYYY-MM-DD` for age-based projections; empty in DB means not set. */
  initialBirthDate: string | null;
  /** Stored 50–80; null means UI default 65 for projections. */
  initialTargetRetirementAge: number | null;
  /** Optional monthly spend goal in retirement (same currency as profile). */
  initialRetirementMonthlySpendGoal: number | null;
  /**
   * Annual dividend yield in retirement as a percent (e.g. 2 for 2%).
   * Null/empty means the dashboard uses its default (2%) until you save a value.
   */
  initialRetirementDividendYieldPercent: number | null;
  /**
   * Nominal annual salary growth as a percent (e.g. 2 for 2% each January in CPF projection).
   * Null/blank means no raise path.
   */
  initialAnnualSalaryGrowthPercent?: number | null;
  /**
   * Nominal annual expense growth as a percent (e.g. 2 for 2%). Null/blank
   * means the dashboard applies its 2% global default until you save a value.
   */
  initialExpenseGrowthPercent?: number | null;
  /** Annual bonus before employee CPF (optional). */
  initialAnnualBonus?: number | null;
  /** Annual withdrawal rate in percent for simplified retirement checks (e.g. 4 for 4%). */
  initialRetirementWithdrawalRatePercent?: number | null;
  /** Calendar month (1-12) the user expects their salary review; null = opt-out. */
  initialSalaryIncrementMonth?: number | null;
  /** `YYYY-MM` for OW ceiling / rates used in the estimate. */
  cpfYearMonth: string;
  currencyCode?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSalaryReviewMode = searchParams?.get("from") === "salary-review";
  const currentYear = new Date().getFullYear();
  const [salaryIncrementMonth, setSalaryIncrementMonth] = useState<string>(
    initialSalaryIncrementMonth != null
      ? String(initialSalaryIncrementMonth)
      : ""
  );
  const [grossRaw, setGrossRaw] = useState(
    initialGross != null ? String(initialGross) : ""
  );
  const [band, setBand] = useState<SgCpfAgeBand | "">(
    isSgCpfAgeBand(initialCpfAgeBand) ? initialCpfAgeBand : ""
  );
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const isBusy = submitting || isRefreshing;
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "");
  const [retAgeRaw, setRetAgeRaw] = useState(
    initialTargetRetirementAge != null
      ? String(initialTargetRetirementAge)
      : ""
  );
  const [retirementSpendGoalRaw, setRetirementSpendGoalRaw] = useState(
    initialRetirementMonthlySpendGoal != null
      ? String(initialRetirementMonthlySpendGoal)
      : ""
  );
  const [retDividendYieldPercentRaw, setRetDividendYieldPercentRaw] = useState(
    initialRetirementDividendYieldPercent != null
      ? String(initialRetirementDividendYieldPercent)
      : ""
  );
  const [salaryGrowthPctRaw, setSalaryGrowthPctRaw] = useState(
    initialAnnualSalaryGrowthPercent != null
      ? String(
          Math.round(initialAnnualSalaryGrowthPercent * 1000) / 1000
        )
      : ""
  );
  const [expenseGrowthPctRaw, setExpenseGrowthPctRaw] = useState(
    initialExpenseGrowthPercent != null
      ? String(Math.round(initialExpenseGrowthPercent * 1000) / 1000)
      : ""
  );
  const [annualBonusRaw, setAnnualBonusRaw] = useState(
    initialAnnualBonus != null ? String(initialAnnualBonus) : ""
  );
  const [retirementWithdrawalPctRaw, setRetirementWithdrawalPctRaw] = useState(
    initialRetirementWithdrawalRatePercent != null
      ? String(
          Math.round(initialRetirementWithdrawalRatePercent * 1000) / 1000
        )
      : ""
  );
  const [showCpfSalaryPath, setShowCpfSalaryPath] = useState(
    () => salaryGrowthPctRaw.trim() !== ""
  );
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(() => {
    return (
      retDividendYieldPercentRaw.trim() !== "" ||
      retirementWithdrawalPctRaw.trim() !== ""
    );
  });

  useEffect(() => {
    if (birthDate.trim() === "") return;
    const derived = derivedCpfBandFromBirthDate(birthDate.trim());
    if (derived != null) {
      setBand(derived);
    }
  }, [birthDate]);

  const grossNum = useMemo(() => {
    const t = grossRaw.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }, [grossRaw]);

  const cpfMode = grossNum != null && grossNum > 0;

  const breakdown = useMemo(() => {
    if (!cpfMode || !band) return null;
    const annualBonus = annualBonusRaw.trim() === "" ? 0 : Number(annualBonusRaw);
    if (!Number.isFinite(annualBonus) || annualBonus < 0) return null;
    return annualEmployeeCpfTakeHomeWithBonusSg(
      grossNum,
      annualBonus,
      cpfYearMonth,
      band
    );
  }, [annualBonusRaw, cpfMode, band, grossNum, cpfYearMonth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);
    const nativeEvt = e.nativeEvent as SubmitEvent;
    const submitter = nativeEvt.submitter as HTMLButtonElement | null;
    const submitterValue = submitter?.value ?? "income";
    const section =
      submitterValue === "retirement"
        ? "retirement"
        : submitterValue === "salary-confirm"
          ? "salary-confirm"
          : "income";

    const birthPayload = birthDate.trim() === "" ? null : birthDate.trim();
    if (
      birthPayload != null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(birthPayload)
    ) {
      setStatus("Birth date must be YYYY-MM-DD.");
      setSubmitting(false);
      return;
    }
    const patchBody: Record<string, unknown> = {};

    if (section === "salary-confirm") {
      patchBody.last_salary_review_at = new Date().toISOString();
    } else if (section === "income") {
      if (!cpfMode || grossNum == null || Number.isNaN(grossNum)) {
        setStatus("Enter your monthly gross salary to calculate take-home.");
        setSubmitting(false);
        return;
      }
      const annualBonusTrim = annualBonusRaw.trim();
      let annualBonus: number | null = null;
      if (annualBonusTrim !== "") {
        const n = Number(annualBonusTrim);
        if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
          setStatus("Annual bonus must be between 0 and 10,000,000.");
          setSubmitting(false);
          return;
        }
        annualBonus = n;
      }
      if (!band) {
        setStatus("Enter your birth date to auto-set CPF age band.");
        setSubmitting(false);
        return;
      }
      if (!breakdown) {
        setStatus("Unable to calculate take-home. Check gross salary and birth date.");
        setSubmitting(false);
        return;
      }
      patchBody.birth_date = birthPayload;
      patchBody.salary_frequency = "monthly";
      patchBody.monthly_gross_salary = grossNum;
      patchBody.annual_bonus = annualBonus;
      patchBody.cpf_age_band = band;
      patchBody.monthly_income = breakdown.takeHomeFromSalaryMonthly;

      const growthTrim = salaryGrowthPctRaw.trim();
      let annual_salary_growth_nominal: number | null = null;
      if (growthTrim !== "") {
        const p = Number(growthTrim);
        if (!Number.isFinite(p) || p < 0 || p > 25) {
          setStatus(
            "Annual salary growth must be between 0% and 25%, or leave blank for no growth in the CPF chart."
          );
          setSubmitting(false);
          return;
        }
        annual_salary_growth_nominal = p / 100;
      }
      patchBody.annual_salary_growth_nominal = annual_salary_growth_nominal;

      const expGrowthTrim = expenseGrowthPctRaw.trim();
      let expense_growth_nominal: number | null = null;
      if (expGrowthTrim !== "") {
        const p = Number(expGrowthTrim);
        if (!Number.isFinite(p) || p < 0 || p > 25) {
          setStatus(
            "Expense growth must be between 0% and 25%, or leave blank for the 2% default."
          );
          setSubmitting(false);
          return;
        }
        expense_growth_nominal = p / 100;
      }
      patchBody.expense_growth_nominal = expense_growth_nominal;

      const monthTrim = salaryIncrementMonth.trim();
      if (monthTrim === "") {
        patchBody.salary_increment_month = null;
      } else {
        const m = Number(monthTrim);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          setStatus("Salary increment month must be a whole number 1–12, or blank.");
          setSubmitting(false);
          return;
        }
        patchBody.salary_increment_month = m;
      }
      if (isSalaryReviewMode) {
        patchBody.last_salary_review_at = new Date().toISOString();
      }
    } else {
      const retTrim = retAgeRaw.trim();
      let targetRetirementAge: number | null = null;
      if (retTrim !== "") {
        const n = Number(retTrim);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 50 || n > 80) {
          setStatus(
            "Target retirement age must be a whole number from 50 to 80, or leave blank to use 65 in projections."
          );
          setSubmitting(false);
          return;
        }
        targetRetirementAge = n;
      }

      const spendTrim = retirementSpendGoalRaw.trim();
      let retirement_monthly_spend_goal: number | null = null;
      if (spendTrim !== "") {
        const n = Number(spendTrim);
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
          setStatus(
            "Retirement spend goal must be between 0 and 1,000,000, or leave blank to clear."
          );
          setSubmitting(false);
          return;
        }
        retirement_monthly_spend_goal = n;
      }

      const divTrim = retDividendYieldPercentRaw.trim();
      let retirement_dividend_yield_annual: number | null = null;
      if (divTrim !== "") {
        const p = Number(divTrim);
        if (!Number.isFinite(p) || p < 0 || p > 25) {
          setStatus(
            "Retirement dividend yield must be between 0% and 25%, or leave blank to clear (dashboard then uses 2% default)."
          );
          setSubmitting(false);
          return;
        }
        retirement_dividend_yield_annual = p / 100;
      }

      const withdrawalTrim = retirementWithdrawalPctRaw.trim();
      let retirement_withdrawal_rate_annual: number | null = null;
      if (withdrawalTrim !== "") {
        const p = Number(withdrawalTrim);
        if (!Number.isFinite(p) || p < 0 || p > 20) {
          setStatus(
            "Retirement withdrawal rate must be between 0% and 20%, or leave blank to use the default."
          );
          setSubmitting(false);
          return;
        }
        retirement_withdrawal_rate_annual = p / 100;
      }

      patchBody.target_retirement_age = targetRetirementAge;
      patchBody.retirement_monthly_spend_goal = retirement_monthly_spend_goal;
      patchBody.retirement_dividend_yield_annual = retirement_dividend_yield_annual;
      patchBody.retirement_withdrawal_rate_annual = retirement_withdrawal_rate_annual;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
          details?: { fieldErrors?: Record<string, string[]> };
        } | null;
        const zod =
          j?.details?.fieldErrors &&
          Object.values(j.details.fieldErrors).flat().join(" ");
        setStatus(zod || j?.error || "Failed to save");
        return;
      }
      setStatus("Saved");
      if (isSalaryReviewMode && section !== "retirement") {
        // Best-effort clear of the matching inbox row; ignore errors so save UX stays clean.
        markInboxItemReadByDedupeKeyAction(
          `salary_review_due:${currentYear}`
        ).catch(() => undefined);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-linear-to-br from-white via-white to-sky-50/30 shadow-sm divide-y divide-slate-200"
      {...(isBusy ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={isBusy} message="Saving profile…" />
      <section id="salary" className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Income & CPF</p>
          <p className="text-xs text-slate-500">
            Keep this up to date so your monthly plan and projections stay realistic.
          </p>
        </div>
        {isSalaryReviewMode ? (
          <div className={`${appCardClass} border-emerald-200/80 bg-emerald-50/70 p-4 text-sm text-emerald-900`}>
            <p className="font-semibold">Reviewing for {currentYear}</p>
            <p className="mt-1 text-emerald-900/85">
              Update your salary if it changed, otherwise confirm unchanged.
              Either action clears the reminder.
            </p>
          </div>
        ) : null}
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Monthly gross salary ({currencyCode})
                  <InfoTooltip ariaLabel="When to use gross salary">
                    <p className="text-[11px] leading-snug">
                      Uses <strong>employee</strong> CPF on ordinary wages up to the OW
                      ceiling for{" "}
                      <span className="font-mono">{cpfYearMonth}</span>. Excludes employer
                      CPF, tax, and other deductions.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="monthly_gross_salary"
                  type="number"
                  min={0}
                  step="0.01"
                  className={fpInputClass}
                  value={grossRaw}
                  onChange={(e) => setGrossRaw(e.target.value)}
                  placeholder="Leave empty for manual take-home only"
                />
              </label>
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Annual bonus ({currencyCode}, optional)
                  <InfoTooltip ariaLabel="How bonus is used in the app">
                    <p className="text-[11px] leading-snug">
                      Gross bonus before employee CPF. Your <strong>monthly</strong> plan
                      uses salary take-home only. Bonus is modeled as{" "}
                      <strong>cash savings</strong> once per year (December), after
                      employee CPF on additional wages (same AW ceiling logic as the CPF
                      chart). Not tax advice.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="annual_bonus"
                  type="number"
                  min={0}
                  max={10_000_000}
                  step="0.01"
                  className={fpInputClass}
                  value={annualBonusRaw}
                  onChange={(e) => setAnnualBonusRaw(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            {breakdown &&
              annualBonusRaw.trim() !== "" &&
              Number.isFinite(Number(annualBonusRaw.trim())) &&
              Number(annualBonusRaw.trim()) > 0 && (
              <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
                <p className="font-medium text-slate-800">Estimated take-home</p>
                <p className="mt-1">
                  <span className="text-slate-500">Salary (monthly): </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {currencyCode}{" "}
                    {breakdown.takeHomeFromSalaryMonthly.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-slate-500"> — used for your monthly budget.</span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-500">Bonus (once per year, after employee CPF on AW): </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {currencyCode}{" "}
                    {breakdown.takeHomeFromBonusNetAnnual.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-slate-500">
                    {" "}
                    — added to projected cash (not spread into monthly income).
                  </span>
                </p>
                {breakdown.employeeCpfOnAwAnnual > 0 && (
                  <p className="mt-1 text-slate-500">
                    Employee CPF on bonus (annual): {currencyCode}{" "}
                    {breakdown.employeeCpfOnAwAnnual.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    — also reflected in the CPF projection with your monthly contributions.
                  </p>
                )}
              </div>
            )}
        <label className="mb-6 block pt-6 text-sm sm:mb-8 sm:pt-8">
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
            Birth date
            <InfoTooltip ariaLabel="Why birth date matters">
              <p>
                Used to map calendar years to <strong>your age</strong> on projection
                charts and to auto-set CPF age band.
              </p>
            </InfoTooltip>
          </span>
          <input
            name="birth_date"
            type="date"
            className={fpInputClass}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50/90 to-sky-50/40 p-3.5">
          <button
            type="button"
            onClick={() => setShowCpfSalaryPath((prev) => !prev)}
            className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
            aria-expanded={showCpfSalaryPath}
            aria-controls="income-cpf-projection"
          >
            <span>CPF chart: salary path (optional)</span>
            <span
              className={`inline-flex text-slate-400 transition-transform ${
                showCpfSalaryPath ? "rotate-180" : "rotate-0"
              }`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
              >
                <path
                  d="M4 6.5L8 10.5L12 6.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <p className="mt-1 px-1 text-xs text-slate-500">
            Only affects projected CPF inflows when gross salary is set—not net worth
            today.
          </p>
          {showCpfSalaryPath && (
            <div id="income-cpf-projection" className="mt-3 max-w-md">
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Annual salary growth (nominal %)
                  <InfoTooltip ariaLabel="How salary growth is used">
                    <p>
                      Each <strong>January</strong> in the CPF projection, gross is
                      multiplied by <strong>(1 + this rate)</strong>. The first
                      projection month always uses your entered gross as-is.
                    </p>
                    <p className="mt-2 text-slate-400">
                      Not financial advice. Many plans stress-test at 0% and use a
                      modest nominal rate (e.g. 0–3%) for a middle case. Does not
                      change current net worth—only forward CPF inflows.
                    </p>
                    <p className="mt-2 border-t border-zinc-600/40 pt-2 text-[11px] text-slate-300">
                      Blank = no raises in the CPF chart (only when gross is set).{" "}
                      <MethodologyOpenLink
                        topicId="cpf-projection"
                        className={appInlineLinkClass}
                      >
                        Full CPF rules
                      </MethodologyOpenLink>
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="annual_salary_growth_pct"
                  type="number"
                  min={0}
                  max={25}
                  step={0.1}
                  className={fpInputNarrowClass}
                  value={salaryGrowthPctRaw}
                  onChange={(e) => setSalaryGrowthPctRaw(e.target.value)}
                  placeholder="0 = flat gross"
                />
              </label>
              <label className="mt-3 block text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Salary increment month (optional)
                  <InfoTooltip ariaLabel="How salary increment month is used">
                    <p>
                      Once a year, starting in this month, we&apos;ll drop an
                      inbox reminder to confirm whether your salary changed.
                    </p>
                    <p className="mt-2 text-slate-400">
                      Leave as &quot;Not set / None&quot; to skip the reminder.
                    </p>
                  </InfoTooltip>
                </span>
                <select
                  name="salary_increment_month"
                  value={salaryIncrementMonth}
                  onChange={(e) => setSalaryIncrementMonth(e.target.value)}
                  className={fpInputNarrowClass}
                >
                  <option value="">Not set / None</option>
                  {MONTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {status && (
            <span className="text-sm text-slate-600 sm:text-right" role="status">
              {status}
            </span>
          )}
          {isSalaryReviewMode ? (
            <button
              type="submit"
              value="salary-confirm"
              disabled={isBusy}
              className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 w-full sm:w-auto"
            >
              {isBusy ? "Saving..." : "Confirm unchanged"}
            </button>
          ) : null}
          <button
            type="submit"
            value="income"
            disabled={isBusy}
            className={`${fpPrimaryButtonClass} w-full sm:w-auto`}
          >
            {isBusy ? "Saving..." : "Save income"}
          </button>
        </div>
      </section>

      <section id="retirement-inputs" className="scroll-mt-24 space-y-4 p-5">
        <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-900">
                Retirement targets
              </p>
              <InfoTooltip ariaLabel="How retirement fields are used">
                <p className="text-[11px] leading-snug">
                  <strong>Retire at</strong>, <strong>spend goal</strong>,{" "}
                  <strong>dividend %</strong>, and <strong>withdrawal %</strong>{" "}
                  feed the retirement checks on your dashboard. Fill what you know.
                </p>
                <p className="mt-2 border-t border-zinc-600/40 pt-2 text-[11px] text-slate-300">
                  <MethodologyOpenLink
                    topicId="retirement-dividends"
                    className={appInlineLinkClass}
                  >
                    Dividend check
                  </MethodologyOpenLink>
                  <span className="text-slate-500"> · </span>
                  <MethodologyOpenLink topicId="retirement-fv" className={appInlineLinkClass}>
                    Projection
                  </MethodologyOpenLink>
                </p>
              </InfoTooltip>
            </div>
            <p className="-mt-1 text-xs text-slate-500">
              Start simple: set just target age and monthly spend goal first.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Retire at age (optional)
                  <InfoTooltip ariaLabel="How retirement age is used">
                    <p>
                      The dividend check and table use net worth{" "}
                      <strong>at this age</strong> (blank = 65).
                    </p>
                    <p className="mt-2 text-slate-400">
                      Months to compound ≈ (this age − your current age) × 12,
                      capped at zero if you are already past that age.
                    </p>
                    <p className="mt-2 text-slate-400">
                      Blank = 65. Whole numbers 50–80.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="target_retirement_age"
                  type="number"
                  min={50}
                  max={80}
                  step={1}
                  className={fpInputNarrowClass}
                  value={retAgeRaw}
                  onChange={(e) => setRetAgeRaw(e.target.value)}
                  placeholder="65 (default)"
                />
              </label>
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Monthly spend in retirement ({currencyCode})
                  <InfoTooltip ariaLabel="How spend goal is used">
                    <p>
                      The dashboard compares this to{" "}
                      <strong>dividends only</strong> on projected investments
                      at retirement.
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-emerald-200/95">
                      need invested ≈ (monthly goal × 12) ÷ yield
                    </p>
                    <p className="mt-2 text-slate-400">
                      Yield is your dividend % below (or 2% if blank), nominal and
                      not tax-adjusted. Your spend goal is inflated to
                      retirement-year dollars at your set rate (2% default).
                    </p>
                    <p className="mt-2 text-slate-400">
                      Leave blank to clear from the dividend check.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="retirement_monthly_spend_goal"
                  type="number"
                  min={0}
                  max={1_000_000}
                  step="0.01"
                  className={fpInputClass}
                  value={retirementSpendGoalRaw}
                  onChange={(e) => setRetirementSpendGoalRaw(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Expense growth (% / yr)
                  <InfoTooltip ariaLabel="How expense growth is used">
                    <p>
                      Each <strong>January</strong> your monthly expenses and
                      the retirement spend goal grow by{" "}
                      <strong>(1 + this rate)</strong>. The first projection
                      year uses today&apos;s figures as-is.
                    </p>
                    <p className="mt-2 text-slate-400">
                      Independent of salary growth. Blank = 2% default. Salary,
                      dividend yield, CPF and vehicles are unaffected.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="expense_growth_pct"
                  type="number"
                  min={0}
                  max={25}
                  step={0.1}
                  className={fpInputClass}
                  value={expenseGrowthPctRaw}
                  onChange={(e) => setExpenseGrowthPctRaw(e.target.value)}
                  placeholder="Blank = 2% default"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50/90 to-emerald-50/50 p-3.5">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings((prev) => !prev)}
              className="flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
              aria-expanded={showAdvancedSettings}
              aria-controls="advanced-settings"
            >
              <span>Advanced settings (optional)</span>
              <span
                className={`inline-flex text-slate-400 transition-transform ${
                  showAdvancedSettings ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                >
                  <path
                    d="M4 6.5L8 10.5L12 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            <p className="mt-1 px-1 text-xs text-slate-500">
              Optional lenses on retirement income from investments—not CPF salary
              path (that&apos;s under <strong>Income &amp; CPF</strong>).
            </p>

            {showAdvancedSettings && (
              <div id="advanced-settings" className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Dividend yield (% per year)
                  <InfoTooltip ariaLabel="How dividend yield is used">
                    <p>
                      Expected cash dividends as a percent of the{" "}
                      <strong>investment</strong> balance at retirement (not
                      total net worth).
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-emerald-200/95">
                      monthly dividends ≈ investments × (yield ÷ 100) ÷ 12
                    </p>
                    <p className="mt-2 text-slate-400">
                      Leave blank and the app uses 2% for the quick read until you
                      save a value.
                    </p>
                  </InfoTooltip>
                </span>
                <input
                  name="retirement_dividend_yield_annual"
                  type="number"
                  min={0}
                  max={25}
                  step="0.1"
                  className={fpInputNarrowClass}
                  value={retDividendYieldPercentRaw}
                  onChange={(e) => setRetDividendYieldPercentRaw(e.target.value)}
                  placeholder="2 default"
                />
                </label>
                <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
                  Withdrawal rate (% per year)
                </span>
                <input
                  name="retirement_withdrawal_rate_annual"
                  type="number"
                  min={0}
                  max={20}
                  step="0.1"
                  className={fpInputNarrowClass}
                  value={retirementWithdrawalPctRaw}
                  onChange={(e) => setRetirementWithdrawalPctRaw(e.target.value)}
                  placeholder="4 default"
                />
                </label>
              </div>
            )}
          </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {status && (
            <span className="text-sm text-slate-600 sm:text-right" role="status">
              {status}
            </span>
          )}
          <button
            type="submit"
            value="retirement"
            disabled={isBusy}
            className={`${fpPrimaryButtonClass} w-full sm:w-auto`}
          >
            {isBusy ? "Saving..." : "Save retirement targets"}
          </button>
        </div>
      </section>
    </form>
  );
}
