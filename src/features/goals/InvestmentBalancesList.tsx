"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useRef, useState } from "react";
import {
  deleteAdvisorClientInvestmentAction,
  updateAdvisorClientInvestmentAction,
} from "@/server/advisor-client-actions";
import {
  confirmInvestmentReviewAction,
  deleteInvestmentAction,
  updateInvestmentAction,
} from "@/server/actions";
import {
  ageCompletedOnDate,
  investmentReviewReason,
  investmentRowIsStale,
  INVESTMENT_REVIEW_STALE_MONTHS,
} from "@/domain/finance";
import { InvestmentAssumptionBanner } from "@/features/goals/InvestmentAssumptionBanner";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

export type InvestmentBalanceRow = {
  id: string;
  name: string;
  current_value: number;
  monthly_contribution: number;
  expected_annual_return: number;
  contribution_growth_annual: number;
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
  withdrawal_monthly: number;
  withdrawal_start_years?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type InvestmentPlanningContext = {
  birthDate: string;
  targetRetirementAge: number;
};

const initial = { error: null as string | null };

const fieldClass = `${fpInputClass} max-w-none`;

function contributionSummaryLine(
  investment: InvestmentBalanceRow,
  currencyCode: string
): string {
  const pmt = investment.monthly_contribution;
  const stepUp =
    investment.contribution_growth_annual > 0
      ? `, stepping up ${Math.round(investment.contribution_growth_annual * 1000) / 10}%/yr`
      : "";
  const withdrawal =
    investment.withdrawal_monthly > 0
      ? `; withdraw ${formatCurrency(investment.withdrawal_monthly, currencyCode)}/mo later`
      : "";
  const pmtLabel = `${formatCurrency(pmt, currencyCode)}/mo${stepUp}`;
  if (
    investment.contribution_type === "fixed_duration" &&
    investment.contribution_duration_years != null &&
    investment.contribution_duration_years > 0
  ) {
    const y = investment.contribution_duration_years;
    const yLabel = Number.isInteger(y) ? String(y) : String(y);
    return `${pmtLabel} for ${yLabel} years, then growth only${withdrawal}`;
  }
  return `${pmtLabel} until retirement${withdrawal}`;
}

function ContributionTimelineHint({
  investment,
  ctx,
}: {
  investment: InvestmentBalanceRow;
  ctx: InvestmentPlanningContext;
}) {
  const asOf = new Date();
  const age0 = ageCompletedOnDate(ctx.birthDate, asOf);
  const targetAge = Math.min(80, Math.max(50, Math.round(ctx.targetRetirementAge)));

  if (
    investment.contribution_type === "fixed_duration" &&
    investment.contribution_duration_years != null &&
    investment.contribution_duration_years > 0
  ) {
    const y = investment.contribution_duration_years;
    const endContribAge = age0 + y;
    const endLabel =
      Math.abs(endContribAge - Math.round(endContribAge)) < 1e-6
        ? String(Math.round(endContribAge))
        : endContribAge.toFixed(1);
    return (
      <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-950/90">
        <p className="font-semibold text-emerald-950">Timeline (illustrative)</p>
        <p className="mt-1">
          Age {age0} → {endLabel}: contributing monthly
        </p>
        <p className="mt-0.5">
          Thereafter through age {targetAge}: balance keeps compounding without new
          monthly deposits in this model
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-700">
      <p className="font-semibold text-slate-800">Timeline (illustrative)</p>
      <p className="mt-1">
        Age {age0} → {targetAge}: contributing monthly (aligned with your retirement
        age in profile)
      </p>
      <p className="mt-0.5 text-slate-600">
        Projections still grow the balance after contributions stop at retirement.
      </p>
    </div>
  );
}

function InvestmentSummary({
  investment,
  currencyCode,
  planningContext,
  onEdit,
  onDelete,
  deleteError,
  deletePending,
  actionsDisabled = false,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
  planningContext: InvestmentPlanningContext | null;
  onEdit: () => void;
  onDelete: () => void;
  deleteError: string | null;
  deletePending: boolean;
  actionsDisabled?: boolean;
}) {
  const returnPct = (investment.expected_annual_return * 100).toFixed(1);
  const flowSummary = contributionSummaryLine(investment, currencyCode);
  const reviewReason = investmentReviewReason(investment);
  const reviewCopy =
    reviewReason?.kind === "stale_months"
      ? `Not updated in ${reviewReason.months} months. Confirm the balance and expected return still match reality.`
      : reviewReason?.kind === "no_timestamp"
        ? "This account has no recorded update date. Confirm its details are current."
        : null;
  return (
    <div className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{investment.name}</p>
          {reviewCopy ? (
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                Review due
              </span>
              <InfoTooltip ariaLabel="Why this account is due for review">
                <p>{reviewCopy}</p>
              </InfoTooltip>
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-600">{flowSummary}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          <span>{returnPct}% yearly growth (nominal)</span>
        </p>
        {planningContext ? (
          <ContributionTimelineHint investment={investment} ctx={planningContext} />
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          {formatCurrency(investment.current_value, currencyCode)}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Current
        </p>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              disabled={deletePending || actionsDisabled}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deletePending || actionsDisabled}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletePending ? "Removing…" : "Delete"}
            </button>
          </div>
          {deleteError ? (
            <p className="max-w-56 text-right text-[11px] text-red-600" role="alert">
              {deleteError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InvestmentEditForm({
  investment,
  currencyCode,
  onClose,
  advisorClientId,
  disabled = false,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
  onClose: () => void;
  advisorClientId?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const [name, setName] = useState(investment.name);
  const [currentValueRaw, setCurrentValueRaw] = useState(
    String(investment.current_value)
  );
  const [monthlyRaw, setMonthlyRaw] = useState(
    String(investment.monthly_contribution)
  );
  const [contributionGrowthRaw, setContributionGrowthRaw] = useState(
    String(investment.contribution_growth_annual)
  );
  const [withdrawalMonthlyRaw, setWithdrawalMonthlyRaw] = useState(
    String(investment.withdrawal_monthly)
  );
  const [withdrawalStartYearsRaw, setWithdrawalStartYearsRaw] = useState(
    investment.withdrawal_start_years != null
      ? String(investment.withdrawal_start_years)
      : ""
  );
  const [returnPctRaw, setReturnPctRaw] = useState(
    String(Math.round(investment.expected_annual_return * 1000) / 10)
  );
  const [contributionMode, setContributionMode] = useState<
    "until_retirement" | "fixed_duration"
  >(
    investment.contribution_type === "fixed_duration"
      ? "fixed_duration"
      : "until_retirement"
  );
  const [durationYearsRaw, setDurationYearsRaw] = useState(
    investment.contribution_type === "fixed_duration" &&
      investment.contribution_duration_years != null
      ? String(investment.contribution_duration_years)
      : "15"
  );

  const wrapped = async (
    prev: typeof initial,
    formData: FormData
  ): Promise<typeof initial> => {
    if (submitLockRef.current) return prev;
    submitLockRef.current = true;
    try {
      const res = advisorClientId
        ? await updateAdvisorClientInvestmentAction(prev, formData)
        : await updateInvestmentAction(prev, formData);
      if (res.error === null) {
        router.refresh();
        onClose();
      }
      return res;
    } finally {
      submitLockRef.current = false;
    }
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  const decimal = useMemo(() => {
    const n = Number(returnPctRaw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n)) / 100;
  }, [returnPctRaw]);

  return (
    <>
      <BlockingSubmitOverlay active={pending} message="Saving changes…" />
      <form
        action={formAction}
        {...(pending ? { inert: true } : {})}
        className="space-y-4 border-t border-slate-100 py-4"
      >
      <input type="hidden" name="id" value={investment.id} />
      {advisorClientId ? (
        <input type="hidden" name="client_id" value={advisorClientId} />
      ) : null}
      {state.error && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Basics
        </p>
        <label className="mt-2 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Account name</span>
          <input
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Current invested amount{" "}
            <span className="font-normal text-slate-500">({currencyCode})</span>
          </span>
          <input
            name="current_value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={currentValueRaw}
            onChange={(e) => setCurrentValueRaw(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Monthly contribution{" "}
            <span className="font-normal text-slate-500">({currencyCode})</span>
          </span>
          <input
            name="monthly_contribution"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={monthlyRaw}
            onChange={(e) => setMonthlyRaw(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-3">
        <legend className="text-sm font-medium text-slate-800">
          How long will you contribute monthly?
        </legend>
        <p className="mt-1 text-xs text-slate-500">
          After this window, the balance can keep compounding—we only stop adding new
          monthly deposits.
        </p>
        <div className="mt-3 space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="radio"
              name="contribution_type"
              value="until_retirement"
              className="mt-0.5"
              checked={contributionMode === "until_retirement"}
              onChange={() => setContributionMode("until_retirement")}
            />
            <span>
              <span className="font-medium text-slate-900">Until retirement</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Matches your profile retirement age when available.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="radio"
              name="contribution_type"
              value="fixed_duration"
              className="mt-0.5"
              checked={contributionMode === "fixed_duration"}
              onChange={() => setContributionMode("fixed_duration")}
            />
            <span>
              <span className="font-medium text-slate-900">Fixed duration</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                For time-bound premiums or savings phases.
              </span>
            </span>
          </label>
        </div>
        {contributionMode === "fixed_duration" ? (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Contribution duration (years)
            </span>
            <input
              name="contribution_duration_years"
              type="number"
              inputMode="decimal"
              min={0.25}
              max={80}
              step={0.25}
              required
              value={durationYearsRaw}
              onChange={(e) => setDurationYearsRaw(e.target.value)}
              className={`${fieldClass} max-w-xs`}
            />
          </label>
        ) : null}
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
          Expected yearly growth
          <InfoTooltip ariaLabel="What to enter for expected return">
            <p>
              Long-run nominal yield for this account. Rough ranges:{" "}
              <strong>1–3%</strong> savings, <strong>4–6%</strong> bonds,{" "}
              <strong>6–9%</strong> diversified equities.
            </p>
            <p className="mt-2 text-slate-300">
              Type a percent — e.g. <strong>7</strong> for 7%. Used in projections
              only; not financial advice.
            </p>
          </InfoTooltip>
        </span>
        <div className="relative w-full max-w-40">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            required
            value={returnPctRaw}
            onChange={(e) => setReturnPctRaw(e.target.value)}
            className={`${fieldClass} pr-10`}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400"
          >
            %
          </span>
        </div>
        <input
          type="hidden"
          name="expected_annual_return"
          value={decimal.toString()}
        />
      </label>

      <details className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer select-none font-medium text-slate-700">
          Advanced planning
        </summary>
        <p className="mt-2 leading-relaxed">
          Step up monthly contributions over time or model a future monthly withdrawal
          from this account. Leave zero or blank for a flat accumulation plan.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Annual contribution step-up
            </span>
            <input
              name="contribution_growth_annual"
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.001}
              value={contributionGrowthRaw}
              onChange={(e) => setContributionGrowthRaw(e.target.value)}
              className={fieldClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Decimal format, e.g. 0.03 for 3% yearly.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Monthly withdrawal
            </span>
            <input
              name="withdrawal_monthly"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={withdrawalMonthlyRaw}
              onChange={(e) => setWithdrawalMonthlyRaw(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Withdrawal starts after
            </span>
            <input
              name="withdrawal_start_years"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.25}
              placeholder="Retirement age"
              value={withdrawalStartYearsRaw}
              onChange={(e) => setWithdrawalStartYearsRaw(e.target.value)}
              className={fieldClass}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Years from today. Blank uses profile retirement age when available.
            </span>
          </label>
        </div>
      </details>

      <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || disabled}
          className={`${fpPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
    </>
  );
}

function InvestmentRow({
  investment,
  currencyCode,
  planningContext,
  advisorClientId,
  advisorSuggestionDisabled = false,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
  planningContext: InvestmentPlanningContext | null;
  advisorClientId?: string;
  advisorSuggestionDisabled?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const deleteLockRef = useRef(false);

  const runDelete = async () => {
    if (deleteLockRef.current) return;
    if (
      !window.confirm(
        `Remove “${investment.name}” from the plan? This cannot be undone.`
      )
    ) {
      return;
    }
    deleteLockRef.current = true;
    setDeleteError(null);
    setDeletePending(true);
    try {
      const fd = new FormData();
      fd.set("id", investment.id);
      if (advisorClientId) fd.set("client_id", advisorClientId);
      const res = advisorClientId
        ? await deleteAdvisorClientInvestmentAction({ error: null }, fd)
        : await deleteInvestmentAction({ error: null }, fd);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      router.refresh();
    } finally {
      setDeletePending(false);
      deleteLockRef.current = false;
    }
  };

  if (!editing) {
    return (
      <>
        <BlockingSubmitOverlay active={deletePending} message="Removing account…" />
        <InvestmentSummary
          investment={investment}
          currencyCode={currencyCode}
          planningContext={planningContext}
          onEdit={() => setEditing(true)}
          onDelete={runDelete}
          deleteError={deleteError}
          deletePending={deletePending}
          actionsDisabled={advisorSuggestionDisabled}
        />
      </>
    );
  }
  return (
    <InvestmentEditForm
      investment={investment}
      currencyCode={currencyCode}
      onClose={() => setEditing(false)}
      advisorClientId={advisorClientId}
      disabled={advisorSuggestionDisabled}
    />
  );
}

function InvestmentReviewPrompt({
  staleCount,
  disabled = false,
}: {
  staleCount: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const wrapped = async (prev: typeof initial): Promise<typeof initial> => {
    if (submitLockRef.current) return prev;
    submitLockRef.current = true;
    try {
      const res = await confirmInvestmentReviewAction();
      if (res.error === null) router.refresh();
      return res;
    } finally {
      submitLockRef.current = false;
    }
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  const accountLabel =
    staleCount === 1 ? "1 account" : `${staleCount} accounts`;

  return (
    <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-950">
      <p className="font-semibold">Time to review assumptions</p>
      <p className="mt-1">
        {accountLabel} ha{staleCount === 1 ? "s" : "ve"} not been updated in over{" "}
        {INVESTMENT_REVIEW_STALE_MONTHS} months. Confirm balances and expected returns
        still match reality, or edit any account below.
      </p>
      {state.error ? (
        <p className="mt-2 text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 transition hover:bg-amber-100/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Assumptions still accurate"}
        </button>
      </form>
    </div>
  );
}

export function InvestmentBalancesList({
  items,
  currencyCode,
  planningContext,
  advisorClientId,
  advisorSuggestionDisabled = false,
  accountsHeading = "Your accounts",
  showReviewPrompt = false,
  showAssumptionBanner = true,
}: {
  items: InvestmentBalanceRow[];
  currencyCode: string;
  /** When birth date + retirement age are set, show an illustrative contribution timeline. */
  planningContext?: InvestmentPlanningContext | null;
  /** When set, create/update/delete run as the linked advisor for that client profile id. */
  advisorClientId?: string;
  advisorSuggestionDisabled?: boolean;
  accountsHeading?: string;
  /** Show annual review prompt when balances/returns may be outdated. */
  showReviewPrompt?: boolean;
  /** Suppress when a sibling pane already renders the banner (avoid stacked duplicates). */
  showAssumptionBanner?: boolean;
}) {
  const total = items.reduce((acc, i) => acc + i.current_value, 0);
  const staleCount = items.filter((i) => investmentRowIsStale(i)).length;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      {showAssumptionBanner ? <InvestmentAssumptionBanner /> : null}
      {showReviewPrompt && staleCount > 0 && !advisorClientId ? (
        <InvestmentReviewPrompt
          staleCount={staleCount}
          disabled={advisorSuggestionDisabled}
        />
      ) : null}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">{accountsHeading}</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Investments and savings-style accounts. Amounts are in {currencyCode}. Monthly
          contributions can stop while balances keep growing in projections.
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          Combined current value:{" "}
          <span className="font-semibold text-zinc-900">
            {formatCurrency(total, currencyCode)}
          </span>
        </p>
      </div>
      <ul className="divide-y divide-slate-200 border-t border-slate-200">
        {items.map((inv) => (
          <li key={inv.id} className="px-0 sm:px-0">
            <InvestmentRow
              investment={inv}
              currencyCode={currencyCode}
              planningContext={planningContext ?? null}
              advisorClientId={advisorClientId}
              advisorSuggestionDisabled={advisorSuggestionDisabled}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
