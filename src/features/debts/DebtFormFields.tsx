"use client";

import { useMemo } from "react";
import type { DebtCategory, LoanType } from "@/domain/finance/debt-repayment";
import {
  defaultLoanTypeForCategory,
  estimateMonthlyRepayment,
} from "@/domain/finance/debt-repayment";
import {
  DEBT_CATEGORY_OPTIONS,
  GENERIC_DEBT_CATEGORY_OPTIONS,
  LOAN_TYPE_OPTIONS,
} from "@/features/debts/debt-constants";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpSelectClass,
} from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

export type DebtFormValues = {
  name: string;
  balance: number;
  category: DebtCategory | "";
  loanType: LoanType | "";
  interestRatePercent: number | "";
  remainingTenureYears: number | "";
  remainingTenureMonths: number | "";
  monthlyRepayment: number | "";
  repaymentOverride: boolean;
  startDate: string;
  notes: string;
};

type DebtFormFieldsProps = {
  currencyCode: string;
  values: DebtFormValues;
  onChange: (patch: Partial<DebtFormValues>) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
};

function normalizeTenureMonthInput(
  years: number | "",
  months: number
): Partial<DebtFormValues> {
  if (!Number.isFinite(months) || months < 12) {
    return { remainingTenureMonths: months };
  }

  const currentYears = years === "" ? 0 : years;
  return {
    remainingTenureYears: currentYears + Math.floor(months / 12),
    remainingTenureMonths: months % 12,
  };
}

export function DebtFormFields({
  currencyCode,
  values,
  onChange,
  showAdvanced,
  onToggleAdvanced,
}: DebtFormFieldsProps) {
  const categoryOptions = useMemo(() => {
    if (
      values.category === "" ||
      GENERIC_DEBT_CATEGORY_OPTIONS.some((o) => o.value === values.category)
    ) {
      return GENERIC_DEBT_CATEGORY_OPTIONS;
    }

    const legacy = DEBT_CATEGORY_OPTIONS.find(
      (o) => o.value === values.category
    );
    return legacy
      ? [
          {
            ...legacy,
            label: `${legacy.label} (legacy)`,
          },
          ...GENERIC_DEBT_CATEGORY_OPTIONS,
        ]
      : GENERIC_DEBT_CATEGORY_OPTIONS;
  }, [values.category]);

  const loanType =
    (values.loanType ||
      (values.category
        ? defaultLoanTypeForCategory(values.category as DebtCategory)
        : "revolving")) as LoanType;

  const estimated = useMemo(() => {
    if (values.repaymentOverride) return null;
    const balance = Number(values.balance);
    const rate =
      values.interestRatePercent === ""
        ? null
        : Number(values.interestRatePercent) / 100;
    const hasTenure =
      values.remainingTenureYears !== "" ||
      (values.remainingTenureMonths !== "" && values.remainingTenureMonths > 0);
    const months =
      !hasTenure
        ? null
        : Math.round(Number(values.remainingTenureYears || 0) * 12) +
          Math.round(Number(values.remainingTenureMonths || 0));
    if (!Number.isFinite(balance) || balance <= 0) return null;
    return estimateMonthlyRepayment({
      balance,
      loanType,
      interestRateAnnual: rate,
      remainingTenureMonths: months,
    });
  }, [values, loanType]);

  return (
    <div className="space-y-3">
      <label className="block text-xs">
        <span className="mb-1 block font-medium text-slate-600">Category</span>
        <select
          name="category"
          value={values.category}
          onChange={(e) => {
            const category = e.target.value as DebtCategory | "";
            const patch: Partial<DebtFormValues> = { category };
            if (category && !values.loanType) {
              patch.loanType = defaultLoanTypeForCategory(category);
            }
            onChange(patch);
          }}
          className={fpSelectClass}
        >
          <option value="">Choose a debt type (optional)</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.icon} {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Debt name
          </span>
          <input
            name="name"
            type="text"
            required
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Credit card"
            className={fpInputClass}
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-600">
            Outstanding balance ({currencyCode})
          </span>
          <input
            name="balance"
            type="number"
            min={0}
            step="0.01"
            required
            value={values.balance}
            onChange={(e) =>
              onChange({ balance: e.target.value === "" ? 0 : Number(e.target.value) })
            }
            className={fpInputClass}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onToggleAdvanced}
        className="text-xs font-medium text-emerald-800 hover:text-emerald-900"
      >
        {showAdvanced ? "Hide loan details" : "Add loan details"}
      </button>

      {showAdvanced ? (
        <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-3.5">
          <p className="text-[11px] text-slate-500">
            Optional — helps estimate repayments and future cash flow. You can
            override the monthly amount if your actual payment differs.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">
                Interest rate (% per year)
              </span>
              <input
                name="interest_rate_percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values.interestRatePercent}
                onChange={(e) =>
                  onChange({
                    interestRatePercent:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder="2.6"
                className={fpInputNarrowClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">
                  Remaining tenure (years)
                </span>
                <input
                  name="remaining_tenure_years"
                  type="number"
                  min={0}
                  max={50}
                  step="1"
                  value={values.remainingTenureYears}
                  onChange={(e) =>
                    onChange({
                      remainingTenureYears:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="24"
                  className={fpInputNarrowClass}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">
                  Months
                </span>
                <input
                  name="remaining_tenure_months"
                  type="number"
                  min={0}
                  step="1"
                  value={values.remainingTenureMonths}
                  onChange={(e) => {
                    onChange(
                      e.target.value === ""
                        ? { remainingTenureMonths: "" }
                        : normalizeTenureMonthInput(
                            values.remainingTenureYears,
                            Number(e.target.value)
                          )
                    );
                  }}
                  placeholder="0"
                  className={fpInputNarrowClass}
                />
              </label>
            </div>
          </div>

          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">
              Repayment style
            </span>
            <select
              name="loan_type"
              value={values.loanType || loanType}
              onChange={(e) =>
                onChange({ loanType: e.target.value as LoanType })
              }
              className={fpSelectClass}
            >
              {LOAN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-slate-500">
              {LOAN_TYPE_OPTIONS.find((o) => o.value === loanType)?.hint}
            </span>
          </label>

          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-600">
              Monthly repayment ({currencyCode})
            </span>
            <input
              name="monthly_repayment"
              type="number"
              min={0}
              step="0.01"
              value={values.monthlyRepayment}
              onChange={(e) => {
                onChange({
                  monthlyRepayment:
                    e.target.value === "" ? "" : Number(e.target.value),
                  repaymentOverride: true,
                });
              }}
              placeholder={
                estimated != null
                  ? String(Math.round(estimated))
                  : "Enter if known"
              }
              className={fpInputClass}
            />
            {estimated != null && !values.repaymentOverride ? (
              <span className="mt-1 block text-[11px] text-slate-500">
                Estimated: {formatCurrency(estimated, currencyCode)}/month from
                balance, rate, and tenure
              </span>
            ) : null}
            <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                name="repayment_override"
                checked={values.repaymentOverride}
                onChange={(e) =>
                  onChange({ repaymentOverride: e.target.checked })
                }
                value="true"
              />
              I entered my own repayment (extra payments, refinance, etc.)
            </label>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">
                Loan start date (optional)
              </span>
              <input
                name="start_date"
                type="date"
                value={values.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className={fpInputClass}
              />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">
                Notes (optional)
              </span>
              <textarea
                name="notes"
                rows={2}
                maxLength={2000}
                value={values.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                className={`${fpInputClass} max-w-none resize-y`}
                placeholder="Refinance planned 2027, paying extra $200/month…"
              />
            </label>
          </div>

          {values.repaymentOverride ? (
            <input type="hidden" name="repayment_override" value="true" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
