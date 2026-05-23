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
import {
  formatOnboardingBonusCaption,
  profileHasOnboardingIncomeLink,
} from "@/features/onboarding/onboarding-profile-hints";
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
  initialAnnualSalaryGrowthPercent = null,
  initialAnnualBonus = null,
  initialAnnualBonusMonths = null,
  initialSalaryIncrementMonth = null,
  onboardingCompletedAt = null,
  cpfYearMonth,
  currencyCode = DEFAULT_BASE_CURRENCY,
}: {
  initialIncome: number | null;
  initialGross: number | null;
  initialCpfAgeBand: string | null;
  /** `YYYY-MM-DD` for age-based projections; empty in DB means not set. */
  initialBirthDate: string | null;
  /**
   * Months-of-salary multiplier from onboarding bonus preset; null when custom/legacy.
   */
  initialAnnualBonusMonths?: number | null;
  /** ISO timestamp when onboarding finished; drives sync banner in Income & CPF. */
  onboardingCompletedAt?: string | null;
  /**
   * Nominal annual salary growth as a percent (e.g. 2 for 2% each January in CPF projection).
   * Null/blank means no raise path.
   */
  initialAnnualSalaryGrowthPercent?: number | null;
  /** Annual bonus before employee CPF (optional). */
  initialAnnualBonus?: number | null;
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
  const [salaryGrowthPctRaw, setSalaryGrowthPctRaw] = useState(
    initialAnnualSalaryGrowthPercent != null
      ? String(
          Math.round(initialAnnualSalaryGrowthPercent * 1000) / 1000
        )
      : ""
  );
  const [annualBonusRaw, setAnnualBonusRaw] = useState(
    initialAnnualBonus != null ? String(initialAnnualBonus) : ""
  );
  const [showCpfSalaryPath, setShowCpfSalaryPath] = useState(
    () => salaryGrowthPctRaw.trim() !== ""
  );

  const showOnboardingIncomeBanner = profileHasOnboardingIncomeLink({
    onboardingCompletedAt: onboardingCompletedAt ?? null,
    grossMonthly: initialGross,
    takeHomeMonthly: initialIncome,
    annualBonus: initialAnnualBonus ?? null,
  });
  const onboardingBonusCaption = formatOnboardingBonusCaption(
    initialAnnualBonusMonths ?? null,
    initialAnnualBonus ?? null
  );

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
      submitterValue === "salary-confirm" ? "salary-confirm" : "income";

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
      if (isSalaryReviewMode) {
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
        {showOnboardingIncomeBanner ? (
          <div
            className={`${appCardClass} border-sky-200/80 bg-sky-50/70 p-4 text-sm text-sky-950`}
          >
            <p className="font-semibold">Synced from onboarding</p>
            <p className="mt-1 text-sky-950/85">
              {initialGross != null && initialGross > 0 ? (
                <>
                  Gross salary from onboarding:{" "}
                  <span className="font-mono tabular-nums font-semibold">
                    {currencyCode}{" "}
                    {initialGross.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  /month
                </>
              ) : initialIncome != null && initialIncome > 0 ? (
                <>
                  Take-home from onboarding:{" "}
                  <span className="font-mono tabular-nums font-semibold">
                    {currencyCode}{" "}
                    {initialIncome.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  /month — enter gross below for CPF estimates
                </>
              ) : onboardingBonusCaption ? (
                <>Bonus from onboarding ({onboardingBonusCaption})</>
              ) : null}
              {onboardingBonusCaption &&
              initialGross != null &&
              initialGross > 0 ? (
                <> · Bonus: {onboardingBonusCaption}</>
              ) : null}
              . Edits here update your budget and projections everywhere.
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

    </form>
  );
}
