"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import {
  createAdvisorClientVehicleAction,
  deleteAdvisorClientVehicleAction,
  updateAdvisorClientVehicleAction,
} from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type AdvisorVehicleRow = {
  id: string;
  label: string;
  status: "active" | "planned";
  marketValue: number | null;
  onTheRoadPaid: number | null;
  loanBalance: number | null;
  loanMonthlyPayment: number | null;
  loanMonthsRemaining: number | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

function VehicleFields({
  defaults,
  disabled,
}: {
  defaults?: Partial<AdvisorVehicleRow>;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Vehicle</span>
        <input
          name="label"
          type="text"
          required
          defaultValue={defaults?.label ?? ""}
          placeholder="e.g. Family car"
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Status</span>
        <select
          name="vehicle_status"
          defaultValue={defaults?.status ?? "active"}
          className={inputClass}
          disabled={disabled}
        >
          <option value="active">Active</option>
          <option value="planned">Planned</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Market value</span>
        <input
          name="current_market_value"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.marketValue ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">On-the-road price</span>
        <input
          name="on_the_road_paid"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.onTheRoadPaid ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Loan balance</span>
        <input
          name="loan_balance"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.loanBalance ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Monthly repayment</span>
        <input
          name="loan_monthly_payment"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.loanMonthlyPayment ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Loan months remaining</span>
        <input
          name="loan_months_remaining"
          type="number"
          min={0}
          step="1"
          defaultValue={defaults?.loanMonthsRemaining ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function VehicleEditRow({
  clientId,
  vehicle,
  currencyCode,
  disabled,
}: {
  clientId: string;
  vehicle: AdvisorVehicleRow;
  currencyCode: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAdvisorClientVehicleAction,
    { error: null as string | null, proposalRecorded: undefined as boolean | undefined }
  );
  useAdvisorProposalRefresh(state.proposalRecorded, state.error);

  return (
    <form
      action={action}
      className="space-y-3 p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="id" value={vehicle.id} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{vehicle.label}</p>
        {vehicle.marketValue != null ? (
          <span className="text-xs text-slate-500">
            {formatCurrency(vehicle.marketValue, currencyCode)}
          </span>
        ) : null}
      </div>
      <VehicleFields defaults={vehicle} disabled={pending || disabled} />
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <AdvisorProposeRemovalButton
          action={deleteAdvisorClientVehicleAction}
          clientId={clientId}
          entityId={vehicle.id}
          entityName={vehicle.label}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function VehicleNewEntryForm({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAdvisorClientVehicleAction,
    { error: null as string | null, proposalRecorded: undefined as boolean | undefined }
  );
  const formRef = useRef<HTMLFormElement>(null);
  useAdvisorProposalRefresh(state.proposalRecorded, state.error);
  useEffect(() => {
    if (state.proposalRecorded && !state.error) formRef.current?.reset();
  }, [state.proposalRecorded, state.error]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 p-4 sm:p-5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-sm font-semibold text-slate-900">Suggest a vehicle</p>
      <VehicleFields disabled={pending || disabled} />
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/** Vehicles compose surface: current vehicles on top (editable + removable as
 * suggestions), new-entry form below. Only rendered when the client has shared
 * the vehicles category (parent renders a locked card otherwise). */
export function AdvisorClientVehicleSection({
  clientId,
  vehicles,
  currencyCode,
  disabled = false,
}: {
  clientId: string;
  vehicles: AdvisorVehicleRow[];
  currencyCode: string;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
      {vehicles.map((vehicle) => (
        <VehicleEditRow
          key={vehicle.id}
          clientId={clientId}
          vehicle={vehicle}
          currencyCode={currencyCode}
          disabled={disabled}
        />
      ))}
      <VehicleNewEntryForm clientId={clientId} disabled={disabled} />
    </div>
  );
}
