"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import type { PropertyRow } from "@/data/supabase/types";
import {
  createAdvisorClientPropertyAction,
  deleteAdvisorClientPropertyAction,
  updateAdvisorClientPropertyAction,
} from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type AdvisorPropertyRow = {
  id: string;
  name: string;
  propertyType: PropertyRow["property_type"];
  status: PropertyRow["status"];
  purchasePrice: number | null;
  currentValuation: number | null;
  ownershipPercent: number;
  rentalIncomeMonthly: number;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

const TYPE_OPTIONS: { value: AdvisorPropertyRow["propertyType"]; label: string }[] = [
  { value: "bto", label: "BTO" },
  { value: "resale_hdb", label: "Resale HDB" },
  { value: "resale_ec_condo", label: "Resale EC/Condo" },
  { value: "new_launch_ec_condo", label: "New launch EC/Condo" },
  { value: "hdb", label: "HDB" },
  { value: "condo", label: "Condo" },
  { value: "ec", label: "Executive condo" },
  { value: "landed", label: "Landed" },
  { value: "overseas", label: "Overseas" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const STATUS_OPTIONS: { value: AdvisorPropertyRow["status"]; label: string }[] = [
  { value: "living_in", label: "Living in" },
  { value: "renting_out", label: "Renting out" },
  { value: "under_construction", label: "Under construction" },
  { value: "fully_paid", label: "Fully paid" },
];

function PropertyFields({
  defaults,
  disabled,
}: {
  defaults?: Partial<AdvisorPropertyRow>;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={defaults?.name ?? ""}
          placeholder="e.g. Home"
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Type</span>
        <select
          name="property_type"
          defaultValue={defaults?.propertyType ?? "unknown"}
          className={inputClass}
          disabled={disabled}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Status</span>
        <select
          name="status"
          defaultValue={defaults?.status ?? "living_in"}
          className={inputClass}
          disabled={disabled}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Ownership %</span>
        <input
          name="ownership_percent"
          type="number"
          min={0}
          max={100}
          step="1"
          defaultValue={defaults?.ownershipPercent ?? 100}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Purchase price</span>
        <input
          name="purchase_price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.purchasePrice ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Current valuation</span>
        <input
          name="current_valuation"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.currentValuation ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Rental income (monthly)</span>
        <input
          name="rental_income_monthly"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.rentalIncomeMonthly ?? 0}
          className={inputClass}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function PropertyEditRow({
  clientId,
  property,
  currencyCode,
  disabled,
}: {
  clientId: string;
  property: AdvisorPropertyRow;
  currencyCode: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAdvisorClientPropertyAction,
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
      <input type="hidden" name="id" value={property.id} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{property.name}</p>
        {property.currentValuation != null ? (
          <span className="text-xs text-slate-500">
            {formatCurrency(property.currentValuation, currencyCode)}
          </span>
        ) : null}
      </div>
      <PropertyFields defaults={property} disabled={pending || disabled} />
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <AdvisorProposeRemovalButton
          action={deleteAdvisorClientPropertyAction}
          clientId={clientId}
          entityId={property.id}
          entityName={property.name}
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

function PropertyNewEntryForm({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAdvisorClientPropertyAction,
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
      <p className="text-sm font-semibold text-slate-900">Suggest a property</p>
      <PropertyFields disabled={pending || disabled} />
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

/** Properties compose surface: current properties on top (editable + removable
 * as suggestions), new-entry form below. Only rendered when the client has
 * shared the properties category (parent renders a locked card otherwise). */
export function AdvisorClientPropertySection({
  clientId,
  properties,
  currencyCode,
  disabled = false,
}: {
  clientId: string;
  properties: AdvisorPropertyRow[];
  currencyCode: string;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
      {properties.map((property) => (
        <PropertyEditRow
          key={property.id}
          clientId={clientId}
          property={property}
          currencyCode={currencyCode}
          disabled={disabled}
        />
      ))}
      <PropertyNewEntryForm clientId={clientId} disabled={disabled} />
    </div>
  );
}
