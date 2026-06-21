"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { liabilityRowToPlanning } from "@/domain/finance/debt-repayment";
import type { LiabilityRow } from "@/data/supabase/types";
import type {
  SourceOwnedLoanFollowUp,
  SourceOwnedLoanRegisterEntry,
} from "@/domain/finance/loan-register";
import { LOAN_SOURCE_DEFINITIONS } from "@/domain/finance/loan-source-registry";
import {
  debtRepaymentEndYearMonth,
  debtRepaymentStartYearMonth,
  effectiveMonthlyRepayment,
} from "@/domain/finance/debt-repayment";
import { DebtEducationalExamples } from "@/features/debts/DebtEducationalExamples";
import { DebtPayoffStrategyComparison } from "@/features/debts/DebtPayoffStrategyComparison";
import {
  DebtFormFields,
  type DebtFormValues,
} from "@/features/debts/DebtFormFields";
import {
  debtCategoryIcon,
  debtCategoryLabel,
  formatRatePercent,
  formatTenureYears,
} from "@/features/debts/debt-constants";
import {
  createLiabilityAction,
  deleteLiabilityAction,
  updateLiabilityAction,
} from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";
import { fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatYearMonth } from "@/lib/dates";
import { setupTabPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export type DebtPlanningRow = ReturnType<typeof liabilityRowToPlanning>;

const initial = { error: null as string | null };

function emptyFormValues(): DebtFormValues {
  return {
    name: "",
    balance: 0,
    category: "",
    loanType: "",
    interestRatePercent: "",
    remainingTenureYears: "",
    remainingTenureMonths: 0,
    monthlyRepayment: "",
    repaymentOverride: false,
    startDate: "",
    notes: "",
  };
}

function rowToFormValues(row: DebtPlanningRow): DebtFormValues {
  return {
    name: row.name,
    balance: row.balance,
    category: row.category ?? "",
    loanType: row.loanType ?? "",
    interestRatePercent:
      row.interestRateAnnual != null
        ? Math.round(row.interestRateAnnual * 10000) / 100
        : "",
    remainingTenureYears:
      row.remainingTenureMonths != null
        ? Math.floor(row.remainingTenureMonths / 12)
        : "",
    remainingTenureMonths:
      row.remainingTenureMonths != null ? row.remainingTenureMonths % 12 : 0,
    monthlyRepayment: row.monthlyRepayment ?? "",
    repaymentOverride: row.repaymentOverride,
    startDate: row.startDate ?? "",
    notes: row.notes ?? "",
  };
}

function DebtCard({
  row,
  currencyCode,
}: {
  row: DebtPlanningRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      row.interestRateAnnual ||
        row.remainingTenureMonths ||
        row.monthlyRepayment ||
        row.notes
    )
  );
  const [deletePending, setDeletePending] = useState(false);
  const [values, setValues] = useState(() => rowToFormValues(row));

  const repayment = effectiveMonthlyRepayment(row);
  const referenceYm = formatYearMonth(new Date());
  const startYm = debtRepaymentStartYearMonth(row, referenceYm);
  const endYm = debtRepaymentEndYearMonth(row, startYm);
  const icon = debtCategoryIcon(row.category);
  const categoryLabel = debtCategoryLabel(row.category);

  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateLiabilityAction(prev, fd);
    if (res.error === null) {
      setEditing(false);
      router.refresh();
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  if (editing) {
    return (
      <div className={`${appCardClass} p-4 sm:p-5`}>
        <BlockingSubmitOverlay active={pending} message="Saving debt…" />
        <form
          action={formAction}
          className="space-y-3"
          {...(pending ? { inert: true } : {})}
        >
          <input type="hidden" name="id" value={row.id} />
          {state.error ? (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          ) : null}
          <DebtFormFields
            currencyCode={currencyCode}
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((s) => !s)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className={fpPrimaryButtonClass}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="rounded-full px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => {
                setValues(rowToFormValues(row));
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <article className={`${appCardClass} p-4 sm:p-5`}>
      <BlockingSubmitOverlay active={deletePending} message="Removing debt…" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span aria-hidden>{icon}</span>
            {row.name}
          </p>
          {categoryLabel ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{categoryLabel}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-emerald-800 hover:text-emerald-900"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Outstanding
          </dt>
          <dd className="mt-0.5 text-lg font-semibold text-rose-900">
            {formatCurrency(row.balance, currencyCode)}
          </dd>
        </div>
        {repayment > 0 ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Monthly repayment
            </dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900">
              {formatCurrency(repayment, currencyCode)}
            </dd>
          </div>
        ) : null}
        {row.interestRateAnnual != null ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Interest
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">
              {formatRatePercent(row.interestRateAnnual)}
            </dd>
          </div>
        ) : null}
        {row.remainingTenureMonths != null ? (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Remaining tenure
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">
              {formatTenureYears(row.remainingTenureMonths)}
            </dd>
          </div>
        ) : null}
      </dl>

      {repayment <= 0 && row.balance > 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50/80 px-2.5 py-2 text-[11px] leading-relaxed text-amber-950">
          Add interest rate and tenure (or a monthly repayment) so budgets and
          payoff projections can estimate this loan.
        </p>
      ) : null}

      {endYm ? (
        <p className="mt-3 rounded-lg bg-emerald-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-900">
          Projected payoff around{" "}
          <strong>
            {endYm.slice(5)}/{endYm.slice(0, 4)}
          </strong>
          — after that, about {formatCurrency(repayment, currencyCode)}/month
          returns to your cash flow in budgets and long-term projections.
        </p>
      ) : repayment > 0 ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Synced to your budget as a monthly &ldquo;Debt Repayments&rdquo; line
          while this loan is active.
        </p>
      ) : null}

      {row.notes ? (
        <p className="mt-2 text-xs text-slate-500">{row.notes}</p>
      ) : null}

      <button
        type="button"
        className="mt-3 text-xs text-red-600 hover:underline"
        onClick={async () => {
          setDeletePending(true);
          const fd = new FormData();
          fd.set("id", row.id!);
          try {
            await deleteLiabilityAction(fd);
            router.refresh();
          } finally {
            setDeletePending(false);
          }
        }}
      >
        {deletePending ? "Removing…" : "Remove"}
      </button>
    </article>
  );
}

function AddDebtForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [values, setValues] = useState(emptyFormValues);

  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await createLiabilityAction(prev, fd);
    if (res.error === null) {
      setValues(emptyFormValues());
      setShowAdvanced(false);
      router.refresh();
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Adding debt…" />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          New debt
        </p>
        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700">
          Quick add
        </span>
      </div>
      {state.error ? (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      <DebtFormFields
        currencyCode={currencyCode}
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((s) => !s)}
      />
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={fpPrimaryButtonClass}
        >
          {pending ? "Adding…" : "Add debt"}
        </button>
      </div>
    </form>
  );
}

export function mapLiabilityRows(rows: LiabilityRow[]): DebtPlanningRow[] {
  return rows.map(liabilityRowToPlanning);
}

function SourceOwnedLoanCard({
  row,
  currencyCode,
}: {
  row: SourceOwnedLoanRegisterEntry;
  currencyCode: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const editHref = setupTabPath(row.setupTabId, {});

  return (
    <article className={`${appCardClass} p-3.5 sm:p-4`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-900"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
        >
          <span
            aria-hidden="true"
            className={`inline-flex size-4 shrink-0 items-center justify-center text-xs text-slate-500 transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          >
            &gt;
          </span>
          <span className="block truncate">{row.displayName}</span>
        </button>
        <Link
          href={editHref}
          className="shrink-0 text-xs font-medium text-emerald-800 hover:text-emerald-900"
        >
          Edit in {row.sourceLabel}
        </Link>
      </div>

      {expanded ? (
        <div id={panelId} className="mt-4 space-y-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Outstanding
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-rose-900">
                {formatCurrency(row.balance, currencyCode)}
              </dd>
            </div>
            {row.monthlyPayment != null && row.monthlyPayment > 0 ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Monthly repayment
                </dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                  {formatCurrency(row.monthlyPayment, currencyCode)}
                </dd>
              </div>
            ) : null}
            {row.annualInterestRate != null ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Interest
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800">
                  {formatRatePercent(row.annualInterestRate)}
                </dd>
              </div>
            ) : null}
            {row.remainingTenureMonths != null ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Remaining tenure
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800">
                  {formatTenureYears(row.remainingTenureMonths)}
                </dd>
              </div>
            ) : null}
          </dl>

          {row.fundingSource === "split" ? (
            <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
              Split repayment:{" "}
              {formatCurrency(row.cashPayment ?? 0, currencyCode)} cash and{" "}
              {formatCurrency(row.cpfOaPayment ?? 0, currencyCode)} CPF OA per
              month.
            </p>
          ) : null}

          <dl className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
            {row.details.map((detail) => (
              <div key={`${detail.label}:${detail.value}`}>
                <dt className="font-medium text-slate-500">{detail.label}</dt>
                <dd className="mt-0.5 text-slate-800">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </article>
  );
}

function SourceOwnedLoanFollowUpCard({ row }: { row: SourceOwnedLoanFollowUp }) {
  return (
    <article className={`${appCardClass} p-3.5 sm:p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {row.displayName}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {row.message}
          </p>
        </div>
        <Link
          href={setupTabPath(row.setupTabId, {})}
          className="shrink-0 text-xs font-medium text-emerald-800 hover:text-emerald-900"
        >
          {row.actionLabel}
        </Link>
      </div>
    </article>
  );
}

function SourceOwnedLoanNotice() {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs leading-relaxed text-emerald-950">
      <p>
        Source-owned loans are entered in their setup sections so asset details,
        Singapore-specific assumptions, and repayment sources stay in one place.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LOAN_SOURCE_DEFINITIONS.map((source) => (
          <Link
            key={source.key}
            href={setupTabPath(source.setupTabId, {})}
            className={appInlineLinkClass}
          >
            Add or edit in {source.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DebtPlanningPanels({
  debtRows,
  sourceOwnedLoans = [],
  sourceOwnedLoanFollowUps = [],
  currencyCode,
}: {
  debtRows: DebtPlanningRow[];
  sourceOwnedLoans?: SourceOwnedLoanRegisterEntry[];
  sourceOwnedLoanFollowUps?: SourceOwnedLoanFollowUp[];
  currencyCode: string;
}) {
  const sourceOwnedDebtTotal = sourceOwnedLoans.reduce(
    (a, r) => a + r.balance,
    0
  );
  const debtTotal =
    debtRows.reduce((a, r) => a + r.balance, 0) + sourceOwnedDebtTotal;
  const monthlyRepayments = debtRows.reduce(
    (a, r) => a + effectiveMonthlyRepayment(r),
    0
  ) + sourceOwnedLoans.reduce((a, r) => a + (r.monthlyPayment ?? 0), 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Debts</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Track what you owe, model repayments, and see how loans affect monthly
          cash flow and long-term projections. Outstanding balances reduce net
          worth; repayments flow into your budget automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <p>
            Total owed:{" "}
            <span className="font-semibold text-rose-900">
              {formatCurrency(debtTotal, currencyCode)}
            </span>
          </p>
          {monthlyRepayments > 0 ? (
            <p>
              Monthly repayments:{" "}
              <span className="font-semibold text-slate-900">
                {formatCurrency(monthlyRepayments, currencyCode)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <SourceOwnedLoanNotice />

      <AddDebtForm currencyCode={currencyCode} />

      {debtRows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Debts entered here
          </p>
          <ul className="space-y-4">
            {debtRows.map((row) => (
              <li key={row.id}>
                <DebtCard row={row} currencyCode={currencyCode} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sourceOwnedLoans.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Loans managed elsewhere
          </p>
          <ul className="space-y-3">
            {sourceOwnedLoans.map((row) => (
              <li key={row.id}>
                <SourceOwnedLoanCard row={row} currencyCode={currencyCode} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sourceOwnedLoanFollowUps.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Housing records needing mortgage details
          </p>
          <ul className="space-y-3">
            {sourceOwnedLoanFollowUps.map((row) => (
              <li key={row.id}>
                <SourceOwnedLoanFollowUpCard row={row} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <DebtPayoffStrategyComparison
        debtRows={debtRows}
        currencyCode={currencyCode}
      />

      <DebtEducationalExamples currencyCode={currencyCode} />
    </section>
  );
}
