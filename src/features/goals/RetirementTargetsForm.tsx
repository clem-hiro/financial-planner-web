"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpPrimaryButtonClass,
} from "@/ui/input-classes";
import { InfoTooltip } from "@/ui/InfoTooltip";

type Props = {
  initialTargetRetirementAge: number | null;
  initialRetirementMonthlySpendGoal: number | null;
  initialExpenseGrowthPercent: number | null;
  initialDividendYieldPercent: number | null;
  initialWithdrawalRatePercent: number | null;
  currencyCode?: string;
};

export function RetirementTargetsForm({
  initialTargetRetirementAge,
  initialRetirementMonthlySpendGoal,
  initialExpenseGrowthPercent,
  initialDividendYieldPercent,
  initialWithdrawalRatePercent,
  currencyCode = DEFAULT_BASE_CURRENCY,
}: Props) {
  const router = useRouter();
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
  const [expenseGrowthPctRaw, setExpenseGrowthPctRaw] = useState(
    initialExpenseGrowthPercent != null
      ? String(Math.round(initialExpenseGrowthPercent * 1000) / 1000)
      : ""
  );
  const [dividendYieldRaw, setDividendYieldRaw] = useState(
    initialDividendYieldPercent != null
      ? String(Math.round(initialDividendYieldPercent * 1000) / 1000)
      : ""
  );
  const [withdrawalRateRaw, setWithdrawalRateRaw] = useState(
    initialWithdrawalRatePercent != null
      ? String(Math.round(initialWithdrawalRatePercent * 1000) / 1000)
      : ""
  );
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const isBusy = submitting || isRefreshing;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSubmitting(true);

    const retTrim = retAgeRaw.trim();
    let target_retirement_age: number | null = null;
    if (retTrim !== "") {
      const n = Number(retTrim);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 50 || n > 80) {
        setStatus(
          "Target retirement age must be a whole number from 50 to 80, or leave blank to use 65 in projections."
        );
        setSubmitting(false);
        return;
      }
      target_retirement_age = n;
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

    const divTrim = dividendYieldRaw.trim();
    let retirement_dividend_yield_annual: number | null = null;
    if (divTrim !== "") {
      const p = Number(divTrim);
      if (!Number.isFinite(p) || p < 0 || p > 25) {
        setStatus(
          "Dividend yield must be between 0% and 25%, or leave blank for the 2% default."
        );
        setSubmitting(false);
        return;
      }
      retirement_dividend_yield_annual = p / 100;
    }

    const withdrawalTrim = withdrawalRateRaw.trim();
    let retirement_withdrawal_rate_annual: number | null = null;
    if (withdrawalTrim !== "") {
      const p = Number(withdrawalTrim);
      if (!Number.isFinite(p) || p < 0 || p > 20) {
        setStatus(
          "Withdrawal rate must be between 0% and 20%, or leave blank for the default."
        );
        setSubmitting(false);
        return;
      }
      retirement_withdrawal_rate_annual = p / 100;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_retirement_age,
          retirement_monthly_spend_goal,
          expense_growth_nominal,
          retirement_dividend_yield_annual,
          retirement_withdrawal_rate_annual,
        }),
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
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      {...(isBusy ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={isBusy} message="Saving retirement targets…" />
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-900">Retirement targets</h3>
          <InfoTooltip ariaLabel="How retirement fields are used">
            <p className="text-[11px] leading-snug">
              <strong>Retire at</strong>, <strong>spend goal</strong>,{" "}
              <strong>expense growth</strong>, <strong>dividend %</strong>, and{" "}
              <strong>withdrawal %</strong> feed the retirement checks on Home.
              Income and CPF salary path stay under{" "}
              <strong>Profile → Income &amp; CPF</strong>.
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
        <p className="text-xs text-zinc-600">
          Start with target age and monthly spend goal; add investment-income
          assumptions when you want finer dashboard checks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:min-w-0">
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-zinc-700">
            Retire at age (optional)
            <InfoTooltip ariaLabel="How retirement age is used">
              <p>
                The dividend check and table use net worth{" "}
                <strong>at this age</strong> (blank = 65).
              </p>
              <p className="mt-2 text-slate-400">Blank = 65. Whole numbers 50–80.</p>
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
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-zinc-700">
            Monthly spend in retirement ({currencyCode})
            <InfoTooltip ariaLabel="How spend goal is used">
              <p>
                The dashboard compares this to <strong>dividends only</strong> on
                projected investments at retirement.
              </p>
              <p className="mt-2 font-mono text-[10px] text-emerald-200/95">
                need invested ≈ (monthly goal × 12) ÷ yield
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
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-zinc-700">
            Expense growth (% / yr)
            <InfoTooltip ariaLabel="How expense growth is used">
              <p>
                Each <strong>January</strong> your monthly expenses and the
                retirement spend goal grow by <strong>(1 + this rate)</strong>.
              </p>
              <p className="mt-2 text-slate-400">Blank = 2% default.</p>
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
        <label className="text-sm sm:min-w-0">
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-zinc-700">
            Dividend yield (% per year)
            <InfoTooltip ariaLabel="How dividend yield is used">
              <p>
                Expected cash dividends as a percent of the{" "}
                <strong>investment</strong> balance at retirement.
              </p>
              <p className="mt-2 text-slate-400">
                Leave blank and the app uses 2% until you save a value.
              </p>
            </InfoTooltip>
          </span>
          <input
            name="retirement_dividend_yield_annual"
            type="number"
            min={0}
            max={25}
            step={0.1}
            className={fpInputNarrowClass}
            value={dividendYieldRaw}
            onChange={(e) => setDividendYieldRaw(e.target.value)}
            placeholder="2 default"
          />
        </label>
        <label className="text-sm sm:min-w-0">
          <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-zinc-700">
            Withdrawal rate (% per year)
            <InfoTooltip ariaLabel="How withdrawal rate is used">
              <p>
                Simplified annual draw on investments (e.g. 4% rule). Independent
                of dividend yield.
              </p>
            </InfoTooltip>
          </span>
          <input
            name="retirement_withdrawal_rate_annual"
            type="number"
            min={0}
            max={20}
            step="0.1"
            className={fpInputNarrowClass}
            value={withdrawalRateRaw}
            onChange={(e) => setWithdrawalRateRaw(e.target.value)}
            placeholder="4 default"
          />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {status ? (
          <span className="text-sm text-zinc-600 sm:text-right" role="status">
            {status}
          </span>
        ) : null}
        <button
          type="submit"
          disabled={isBusy}
          className={`${fpPrimaryButtonClass} w-full sm:w-auto`}
        >
          {isBusy ? "Saving…" : "Save retirement targets"}
        </button>
      </div>
    </form>
  );
}
