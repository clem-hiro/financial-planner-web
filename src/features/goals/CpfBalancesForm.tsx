"use client";

import { useActionState } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearCpfBalanceAction,
  confirmCpfRulesReviewAction,
  createCpfInvestmentAction,
  deleteCpfInvestmentAction,
  upsertCpfBalanceAction,
} from "@/server/actions";
import type { CpfBalanceRow, CpfInvestmentRow } from "@/data/supabase/types";
import { num } from "@/data/mappers";
import { CPF_RULES_VERSION } from "@/domain/finance/cpf-rules-review";
import { formatYearMonth } from "@/lib/dates";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const initial = { error: null as string | null };
const numberInputClass =
  "w-full rounded border border-zinc-300 px-2 py-1.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function CpfRulesReviewPrompt({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const wrapped = async (prev: typeof initial): Promise<typeof initial> => {
    if (submitLockRef.current) return prev;
    submitLockRef.current = true;
    try {
      const res = await confirmCpfRulesReviewAction();
      if (res.error === null) router.refresh();
      return res;
    } finally {
      submitLockRef.current = false;
    }
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  return (
    <div
      id="cpf-rules-review"
      className="rounded-xl border border-sky-300/80 bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-950"
    >
      <p className="font-semibold">Review CPF assumptions</p>
      <p className="mt-1">
        Calculations are using CPF rules baseline {CPF_RULES_VERSION}. Confirm
        balances, age band, contribution assumptions, crediting rates, and retirement
        sum assumptions (FRS/BRS/ERS on Home → Retirement) against current CPF guidance.
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
          className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-950 transition hover:bg-sky-100/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "CPF assumptions reviewed"}
        </button>
      </form>
    </div>
  );
}

export function CpfBalancesForm({
  row,
  cpfInvestments = [],
  defaultSaMaturityMonth,
  showRulesReviewPrompt = false,
}: {
  row: CpfBalanceRow | null;
  cpfInvestments?: CpfInvestmentRow[];
  defaultSaMaturityMonth?: string | null;
  showRulesReviewPrompt?: boolean;
}) {
  const [state, action, pending] = useActionState(upsertCpfBalanceAction, initial);
  const [investmentState, investmentAction, investmentPending] = useActionState(
    createCpfInvestmentAction,
    initial
  );
  const [clearPending, setClearPending] = useState(false);
  const [cpfInvestmentAccount, setCpfInvestmentAccount] = useState<"oa" | "sa">("oa");
  const defaultBalanceAsOfMonth =
    row?.balance_as_of_month ?? formatYearMonth(new Date());
  const [showCpfisAdvanced, setShowCpfisAdvanced] = useState(() => {
    if (!row) return false;
    return (
      num(row.cpfis_monthly_from_oa) > 0 ||
      num(row.cpfis_notional_balance) > 0
    );
  });

  return (
    <div className="space-y-3">
      {showRulesReviewPrompt ? <CpfRulesReviewPrompt /> : null}
      <form
        action={action}
        className="space-y-4"
        {...(pending ? { inert: true } : {})}
      >
        <BlockingSubmitOverlay active={pending} message="Saving CPF balances…" />
        <h2 className="text-sm font-semibold text-zinc-900">
          CPF balances (OA / SA / MA)
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">
          These CPF figures are manually entered from the client&apos;s CPF
          statement. Update them whenever the statement changes so net worth and
          retirement projections stay current.
        </p>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">OA balance</span>
            <input
              name="oa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.oa) : 0}
              className={numberInputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">SA balance</span>
            <input
              name="sa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.sa) : 0}
              className={numberInputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">MA balance</span>
            <input
              name="ma"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.ma) : 0}
              className={numberInputClass}
            />
          </label>
        </div>
        <label className="block max-w-xs text-sm">
          <span className="mb-1 block text-zinc-600">CPF balance as of</span>
          <input
            name="balance_as_of_month"
            type="month"
            required
            defaultValue={defaultBalanceAsOfMonth}
            className={numberInputClass}
          />
          <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
            Choose the latest CPF month already reflected in these balances. The
            projection starts from the following month to avoid double-counting.
          </span>
        </label>
        <div className="border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={() => setShowCpfisAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            aria-expanded={showCpfisAdvanced}
            aria-controls="advanced-cpfis-modeling"
          >
            <span className="text-xs font-medium text-zinc-700">
              Legacy CPFIS notional (optional)
            </span>
            <span className="text-xs text-zinc-500">
              {showCpfisAdvanced ? "Hide" : "Show"}
            </span>
          </button>
          {showCpfisAdvanced && (
            <div id="advanced-cpfis-modeling">
              <p className="mt-1 text-xs text-zinc-500">
                Monthly OA outflow and a separate notional balance with its own
                return assumption. Prefer the CPF Investments entries below for
                account-specific maturity routing.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Monthly from OA</span>
                  <input
                    name="cpfis_monthly_from_oa"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_monthly_from_oa) : 0}
                    className={numberInputClass}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Notional balance</span>
                  <input
                    name="cpfis_notional_balance"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_notional_balance) : 0}
                    className={numberInputClass}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Annual return (0–1)</span>
                  <input
                    name="cpfis_annual_return"
                    type="number"
                    min={0}
                    max={1}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_annual_return) : 0.04}
                    className={numberInputClass}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {pending ? "Saving…" : "Save CPF balances"}
          </button>
        </div>
      </form>
        <div className="border-t border-zinc-200 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-zinc-800">
                CPF Investments
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Add OA or SA investments separately. Future premiums reduce the
                selected CPF bucket; maturity proceeds return to OA, or for SA after
                age 55, RA first and then OA.
              </p>
            </div>
          </div>
          {investmentState.error ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {investmentState.error}
            </p>
          ) : null}
          <form action={investmentAction} className="mt-3 space-y-3">
            <BlockingSubmitOverlay
              active={investmentPending}
              message="Saving CPF investment…"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">Account</span>
                <select
                  name="account"
                  defaultValue="oa"
                  onChange={(event) =>
                    setCpfInvestmentAccount(event.target.value === "sa" ? "sa" : "oa")
                  }
                  className={numberInputClass}
                >
                  <option value="oa">OA</option>
                  <option value="sa">SA</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">Purchase month</span>
                <input
                  name="purchase_month"
                  type="month"
                  required
                  className={numberInputClass}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">Premium type</span>
                <select
                  name="premium_type"
                  defaultValue="single"
                  className={numberInputClass}
                >
                  <option value="single">Single premium</option>
                  <option value="regular">Regular monthly</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">Amount</span>
                <input
                  name="amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  className={numberInputClass}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">
                  Projected growth (0.04 = 4%)
                </span>
                <input
                  name="projected_growth_annual"
                  type="number"
                  min={-0.5}
                  max={1}
                  step="0.001"
                  required
                  defaultValue={0.04}
                  className={numberInputClass}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-600">Maturity month</span>
                <input
                  key={cpfInvestmentAccount}
                  name="maturity_month"
                  type="month"
                  required
                  defaultValue={
                    cpfInvestmentAccount === "sa"
                      ? (defaultSaMaturityMonth ?? undefined)
                      : undefined
                  }
                  className={numberInputClass}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Notes</span>
              <input
                name="note"
                type="text"
                maxLength={500}
                className={numberInputClass}
                placeholder="Optional product or policy reference"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={investmentPending}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {investmentPending ? "Adding…" : "Add CPF investment"}
              </button>
            </div>
          </form>
          {cpfInvestments.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-md border border-zinc-200">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
                <span>Saved entries</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-zinc-200">
                {cpfInvestments.map((investment) => (
                  <div
                    key={investment.id}
                    className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-xs text-zinc-700"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {investment.account.toUpperCase()} ·{" "}
                        {investment.premium_type === "regular"
                          ? "Regular monthly"
                          : "Single premium"}{" "}
                        · {num(investment.amount).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                      <p className="mt-0.5 text-zinc-500">
                        {investment.purchase_month} → {investment.maturity_month} ·{" "}
                        {(num(investment.projected_growth_annual) * 100).toFixed(1)}%
                        p.a.
                      </p>
                      {investment.note ? (
                        <p className="mt-0.5 text-zinc-500">{investment.note}</p>
                      ) : null}
                    </div>
                    <form action={deleteCpfInvestmentAction}>
                      <input type="hidden" name="id" value={investment.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-rose-700 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500">
              No CPF Investments recorded. That can mean none, or that this is an
              advisor discovery opportunity.
            </p>
          )}
        </div>
      {row && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setClearPending(true);
            clearCpfBalanceAction().finally(() => setClearPending(false));
          }}
          {...(clearPending ? { inert: true } : {})}
        >
          <BlockingSubmitOverlay active={clearPending} message="Removing CPF row…" />
          <button
            type="submit"
            disabled={clearPending}
            className="text-xs font-medium text-rose-700 hover:underline"
          >
            {clearPending
              ? "Removing…"
              : "Remove saved CPF row (clears from net worth)"}
          </button>
        </form>
      )}
    </div>
  );
}
