"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
} from "@/server/actions";
import type { VehicleRow } from "@/data/supabase/types";
import { vehicleRowToValuationInput } from "@/data/mappers";
import {
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
} from "@/domain/finance/vehicle-sg";
import { CategoryVisibilityToggle } from "@/features/consent/CategoryVisibilityToggle";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import { formatCurrency } from "@/ui/lib/format";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import {
  fpInputClass,
  fpPrimaryButtonClass,
} from "@/ui/input-classes";

const initial = { error: null as string | null };

function vehicleMoneyDefault(v: string | null | undefined): number | "" {
  if (v == null || String(v).trim() === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function monthlyRunningCost(row: VehicleRow): number {
  return (
    Number(row.loan_monthly_payment) + Number(row.monthly_petrol_cashcard ?? 0)
  );
}

function VehicleSummary({
  row,
  currencyCode,
}: {
  row: VehicleRow;
  currencyCode: string;
}) {
  const asOf = new Date();
  const input = vehicleRowToValuationInput(row);
  const loan = effectiveLoanBalance(input, asOf);
  const monthsLeft = loanMonthsRemainingResolved(input, asOf);
  const monthlyCost = monthlyRunningCost(row);

  return (
    <ul className="mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-slate-300">
      <li>
        Monthly running cost:{" "}
        <strong>{formatCurrency(monthlyCost, currencyCode)}</strong>
        <span className="mt-0.5 block text-zinc-500 dark:text-slate-400">
          Instalment + petrol / Cashcard — synced to your budget.
        </span>
      </li>
      {loan > 0 ? (
        <li>
          Outstanding loan: {formatCurrency(loan, currencyCode)}
          {monthsLeft != null ? (
            <span>
              {" "}
              · ~{monthsLeft} mo to end
              {row.loan_end_ym ? ` (${row.loan_end_ym})` : ""}
            </span>
          ) : null}
        </li>
      ) : (
        <li>No outstanding loan recorded.</li>
      )}
    </ul>
  );
}

function VehicleFields({
  row,
  currencyCode,
}: {
  row?: VehicleRow;
  currencyCode: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Vehicle name
        </span>
        <input
          name="label"
          type="text"
          required
          defaultValue={row?.label ?? ""}
          placeholder="My car"
          className={fpInputClass}
        />
      </label>

      <p className="text-xs font-semibold text-zinc-800 sm:col-span-2 dark:text-slate-100">
        Loan
      </p>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Outstanding loan ({currencyCode})
        </span>
        <input
          name="loan_balance"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.loan_balance)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Monthly instalment ({currencyCode})
        </span>
        <input
          name="loan_monthly_payment"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.loan_monthly_payment)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Instalment end month (YYYY-MM)
        </span>
        <input
          name="loan_end_ym"
          type="text"
          defaultValue={row?.loan_end_ym ?? ""}
          placeholder="2028-11"
          className={fpInputClass}
        />
      </label>

      <p className="text-xs font-semibold text-zinc-800 sm:col-span-2 dark:text-slate-100">
        Running costs
      </p>
      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Monthly petrol + Cashcard ({currencyCode})
        </span>
        <input
          name="monthly_petrol_cashcard"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.monthly_petrol_cashcard)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Annual insurance ({currencyCode})
        </span>
        <input
          name="annual_insurance"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.annual_insurance)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Annual road tax ({currencyCode})
        </span>
        <input
          name="annual_road_tax"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.annual_road_tax)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-zinc-600 dark:text-slate-200">
          Annual maintenance ({currencyCode})
        </span>
        <input
          name="annual_maintenance"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.annual_maintenance)}
          placeholder="0"
          className={fpInputClass}
        />
      </label>
    </div>
  );
}

function VehicleEditForm({
  row,
  currencyCode,
}: {
  row: VehicleRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateVehicleAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, action, pending] = useActionState(wrapped, initial);

  return (
    <form
      action={action}
      className="mt-2 space-y-2 rounded border border-zinc-200 bg-white p-3 dark:border-slate-700/80 dark:bg-slate-900"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving vehicle…" />
      <input type="hidden" name="id" value={row.id} />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <VehicleFields row={row} currencyCode={currencyCode} />
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={fpPrimaryButtonClass}>
          {pending ? "Saving…" : "Save vehicle"}
        </button>
      </div>
    </form>
  );
}

function AddVehicleForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await createVehicleAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, action, pending] = useActionState(wrapped, initial);
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open || state.error != null}
      onToggle={(event) => {
        if (!state.error) setOpen(event.currentTarget.open);
      }}
      className="overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 dark:border-slate-600 dark:bg-slate-800/70"
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-white/70 dark:text-slate-50 dark:hover:bg-slate-800/70">
        Add vehicle
        <span className="mt-1 block text-xs font-normal text-zinc-600 dark:text-slate-300">
          Enter loan and running costs — budget lines sync automatically.
        </span>
      </summary>
      <form
        action={action}
        className="relative space-y-3 border-t border-zinc-200/70 p-4 dark:border-slate-700/80"
        {...(pending ? { inert: true } : {})}
      >
        <BlockingSubmitOverlay active={pending} message="Adding vehicle…" />
        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-200" role="alert">
            {state.error}
          </p>
        )}
        <VehicleFields currencyCode={currencyCode} />
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className={fpPrimaryButtonClass}>
            {pending ? "Adding…" : "Add vehicle"}
          </button>
        </div>
      </form>
    </details>
  );
}

function VehicleDeleteForm({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        deleteVehicleAction(new FormData(event.currentTarget)).finally(() =>
          setPending(false)
        );
      }}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Deleting vehicle…" />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-rose-700 hover:underline dark:text-rose-200"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}

export function VehiclesPanel({
  vehicles,
  currencyCode,
  advisorVisibility = null,
}: {
  vehicles: VehicleRow[];
  currencyCode: string;
  advisorVisibility?: AdvisorCategoryVisibility | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 dark:border-slate-700/80 dark:bg-slate-900 dark:divide-slate-700/80">
      {advisorVisibility ? (
        <div className="p-4 sm:p-5">
          <CategoryVisibilityToggle
            category="vehicles"
            visible={advisorVisibility.vehicles}
            showTooltip
          />
        </div>
      ) : null}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-xs text-amber-950 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100">
          <strong className="font-semibold">Tip:</strong> instalments feed net worth
          and debt projections; running costs sync to your monthly and annual budget.{" "}
          <MethodologyOpenLink topicId="vehicles-sg" className={appInlineLinkClass}>
            Methodology →
          </MethodologyOpenLink>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <AddVehicleForm currencyCode={currencyCode} />
      </div>
      {vehicles.length > 0 && (
        <ul className="space-y-3 p-4 sm:p-5">
          {vehicles.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-none"
            >
              <details>
                <summary className="cursor-pointer text-sm font-medium text-zinc-900 hover:text-zinc-700 dark:text-slate-50 dark:hover:text-slate-200">
                  {row.label}
                  <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-slate-400">
                    {formatCurrency(monthlyRunningCost(row), currencyCode)}/mo
                  </span>
                </summary>
                <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-slate-700/80">
                  <VehicleSummary row={row} currencyCode={currencyCode} />
                  <VehicleEditForm row={row} currencyCode={currencyCode} />
                  <div className="flex justify-end">
                    <VehicleDeleteForm id={row.id} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
