"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { markInboxItemReadByDedupeKeyAction } from "@/server/inbox-actions";
import { ageCompletedOnDate } from "@/domain/finance/age-projection";
import { yearFromYearMonth } from "@/lib/dates";
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
    label: new Date(2000, i, 1).toLocaleString("en-SG", { month: "long" }),
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
  initialSalaryIncrementMonth = null,
  cpfYearMonth,
  currencyCode = DEFAULT_BASE_CURRENCY,
}: {
  initialIncome: number | null;
  initialGross: number | null;
  initialCpfAgeBand: string | null;
  /** `YYYY-MM-DD` for age-based projections; empty in DB means not set. */
  initialBirthDate: string | null;
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
  // Server-derived (cpfYearMonth is `formatYearMonth(new Date())` from the
  // RSC parent at both call sites — current server period, never the
  // user-selectable ?month=). Deterministic SSR↔client; also keeps the
  // `salary_review_due:${currentYear}` dedupe key correct.
  const currentYear = yearFromYearMonth(cpfYearMonth);
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
      className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-none"
      {...(isBusy ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={isBusy} message="Saving profile…" />
      <section id="salary" className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Income &amp; CPF
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Keep this up to date so your monthly plan and projections stay realistic.
          </p>
        </div>
        {isSalaryReviewMode ? (
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3.5 py-3 text-sm text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-50">
            <p className="font-semibold">Reviewing for {currentYear}</p>
            <p className="mt-1 text-emerald-900/85 dark:text-emerald-100/90">
              Update your salary if it changed, otherwise confirm unchanged.
              Either action clears the reminder.
            </p>
          </div>
        ) : null}
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
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
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
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
              <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2.5 text-xs leading-relaxed text-slate-700 dark:border-sky-400/35 dark:bg-sky-400/10 dark:text-slate-200">
                <p className="font-medium text-slate-800 dark:text-slate-50">
                  Estimated take-home
                </p>
                <p className="mt-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Salary (monthly):{" "}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                    {currencyCode}{" "}
                    {breakdown.takeHomeFromSalaryMonthly.toLocaleString("en-SG", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    — used for your monthly budget.
                  </span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Bonus (once per year, after employee CPF on AW):{" "}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                    {currencyCode}{" "}
                    {breakdown.takeHomeFromBonusNetAnnual.toLocaleString("en-SG", {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    — added to projected cash (not spread into monthly income).
                  </span>
                </p>
                {breakdown.employeeCpfOnAwAnnual > 0 && (
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Employee CPF on bonus (annual): {currencyCode}{" "}
                    {breakdown.employeeCpfOnAwAnnual.toLocaleString("en-SG", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    — also reflected in the CPF projection with your monthly contributions.
                  </p>
                )}
              </div>
            )}
        <label className="block text-sm">
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
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

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => setShowCpfSalaryPath((prev) => !prev)}
            className="flex w-fit items-center gap-1.5 text-left text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white"
            aria-expanded={showCpfSalaryPath}
            aria-controls="income-cpf-projection"
          >
            <span>Expected pay rises (optional)</span>
            <span
              className={`inline-flex text-slate-400 transition-transform dark:text-slate-300 ${
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
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Used only for long-term CPF charts. Leave blank if you prefer to assume
            pay stays the same.
          </p>
          {showCpfSalaryPath && (
            <div id="income-cpf-projection" className="mt-3 max-w-md">
              <label className="text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                  Expected yearly pay rise (%)
                  <InfoTooltip ariaLabel="How expected pay rise is used">
                    <p>
                      In CPF projections, your gross salary is increased by this
                      percentage once a year (in January). The first month always
                      uses the gross you entered above.
                    </p>
                    <p className="mt-2 text-slate-400">
                      This does not change your current net worth or this month&apos;s
                      budget — only future CPF contributions in the charts. Many
                      people leave this at 0, or try a modest figure like 1–3%.
                    </p>
                    <p className="mt-2 border-t border-zinc-600/40 pt-2 text-[11px] text-slate-300">
                      Blank means no assumed raises.{" "}
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
                  placeholder="0 = no rise"
                />
              </label>
              <label className="mt-3 block text-sm sm:min-w-0">
                <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                  Remind me to review pay in
                  <InfoTooltip ariaLabel="How pay review month is used">
                    <p>
                      Once a year in this month, we&apos;ll send an inbox reminder to
                      check whether your salary has changed.
                    </p>
                    <p className="mt-2 text-slate-400">
                      Choose &quot;No reminder&quot; if you don&apos;t want that.
                    </p>
                  </InfoTooltip>
                </span>
                <select
                  name="salary_increment_month"
                  value={salaryIncrementMonth}
                  onChange={(e) => setSalaryIncrementMonth(e.target.value)}
                  className={fpInputNarrowClass}
                >
                  <option value="">No reminder</option>
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
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {status && (
            <span
              className="text-sm text-slate-600 dark:text-slate-300 sm:text-right"
              role="status"
            >
              {status}
            </span>
          )}
          {isSalaryReviewMode ? (
            <button
              type="submit"
              value="salary-confirm"
              disabled={isBusy}
              className="w-full rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-400/50 dark:bg-slate-900 dark:text-emerald-100 dark:shadow-none dark:hover:bg-emerald-400/10 sm:w-auto"
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
