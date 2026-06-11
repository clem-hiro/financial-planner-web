"use client";

import { useActionState, useState } from "react";
import {
  annualAmountFromIrregularInput,
  type IrregularExpenseCadence,
} from "@/domain/finance/irregular-expenses";
import { createBudgetLineAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass, fpSelectClass } from "@/ui/input-classes";

const initial = { error: null as string | null };

export function BudgetAddForm({ defaultYear }: { defaultYear: number }) {
  const [state, formAction, pending] = useActionState(
    createBudgetLineAction,
    initial
  );
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [amountInput, setAmountInput] = useState("");
  const [irregularCadence, setIrregularCadence] =
    useState<IrregularExpenseCadence>("annual");
  const parsedAmount = Number(amountInput);
  const storedAmount =
    cadence === "annual"
      ? annualAmountFromIrregularInput({
          amount: parsedAmount,
          cadence: irregularCadence,
        })
      : Number.isFinite(parsedAmount)
        ? parsedAmount
        : 0;
  const showAnnualHelper = cadence === "annual" && Number.isFinite(parsedAmount);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving budget line…" />
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-slate-50">
          Add a custom line
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-slate-300">
          Category names match expenses after trimming and ignoring case.
        </p>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="cadence" value={cadence} />
      <input type="hidden" name="amount" value={storedAmount} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Category
          </span>
          <input
            name="category"
            type="text"
            required
            className={fpInputClass}
            placeholder="e.g. childcare"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Budget amount
          </span>
          <input
            name="amount_display"
            type="number"
            min={0}
            step="0.01"
            required
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            className={fpInputClass}
          />
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
            Repeats
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCadence("monthly")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                cadence === "monthly"
                  ? "border-teal-600 bg-teal-50 text-teal-950 dark:border-teal-300 dark:bg-teal-950/55 dark:text-teal-100"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Every month
            </button>
            <button
              type="button"
              onClick={() => setCadence("annual")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                cadence === "annual"
                  ? "border-teal-600 bg-teal-50 text-teal-950 dark:border-teal-300 dark:bg-teal-950/55 dark:text-teal-100"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Once a year
            </button>
          </div>
        </div>
      </div>

      {cadence === "annual" && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-sm dark:border-teal-400/30 dark:bg-teal-950/35">
          <label className="block max-w-sm">
            <span className="mb-1 block text-xs font-medium text-teal-900 dark:text-teal-100">
              Irregular expense pattern
            </span>
            <select
              value={irregularCadence}
              onChange={(event) =>
                setIrregularCadence(
                  event.target.value as IrregularExpenseCadence
                )
              }
              className={fpSelectClass}
            >
              <option value="annual">Once a year — amount is annual total</option>
              <option value="semi_annual">Twice a year — amount is each bill</option>
              <option value="quarterly">Quarterly — amount is each bill</option>
              <option value="monthly_set_aside">
                Monthly reserve — amount is what to set aside
              </option>
            </select>
          </label>
          {showAnnualHelper && (
            <p className="mt-2 text-xs leading-relaxed text-teal-950 dark:text-teal-100">
              Saved annual plan:{" "}
              <span className="font-semibold">
                {storedAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
              . Monthly reserve target:{" "}
              <span className="font-semibold">
                {(storedAmount / 12).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </span>
              .
            </p>
          )}
        </div>
      )}

      <details className="group rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
        <summary className="cursor-pointer list-none text-sm font-medium text-zinc-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
          <span className="mr-1 text-zinc-400 transition group-open:rotate-90 dark:text-slate-500">
            ▸
          </span>
          Advanced — schedule, year, loan payoff
        </summary>
        <div className="mt-3 space-y-3 border-t border-zinc-200/80 pt-3 text-sm dark:border-slate-700">
          <p className="text-xs text-zinc-600 dark:text-slate-300">
            For loans with a payoff month, set monthly cadence and the last
            applicable month. For a one-off higher month, add the line then use
            &quot;This month only&quot; on that category. For quarterly, semi-annual,
            and other irregular costs, use annual cadence and the pattern helper
            above.
          </p>
          {cadence === "monthly" && (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
                  First month applies (optional)
                </span>
                <input
                  name="start_year_month"
                  type="month"
                  className={fpInputClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
                  Last month applies / loan payoff (optional, inclusive)
                </span>
                <input
                  name="end_year_month"
                  type="month"
                  className={fpInputClass}
                />
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-slate-300">
              Calendar year (annual lines only)
            </span>
            <input
              name="calendar_year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={defaultYear}
              className={fpInputClass}
            />
          </label>
        </div>
      </details>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
      >
        {pending ? "Saving…" : "Save budget line"}
      </button>
    </form>
  );
}
