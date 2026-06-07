"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import {
  createAdvisorClientHousingLoanAction,
  deleteAdvisorClientHousingLoanAction,
  updateAdvisorClientHousingLoanAction,
} from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type AdvisorHousingLoanRow = {
  id: string;
  label: string;
  propertyId: string | null;
  principal: number;
  ratePercent: number;
  termMonths: number;
  firstPaymentMonth: string;
  lenderType: "hdb" | "bank" | "other";
};

export type PropertyOption = { id: string; name: string };

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

function HousingLoanFields({
  defaults,
  propertyOptions,
  disabled,
}: {
  defaults?: Partial<AdvisorHousingLoanRow>;
  propertyOptions: PropertyOption[];
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Loan name</span>
        <input
          name="label"
          type="text"
          required
          defaultValue={defaults?.label ?? ""}
          placeholder="e.g. Home loan"
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Linked property</span>
        <select
          name="property_id"
          defaultValue={defaults?.propertyId ?? ""}
          className={inputClass}
          disabled={disabled}
        >
          <option value="">— None —</option>
          {propertyOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Outstanding principal</span>
        <input
          name="principal"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={defaults?.principal ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Interest rate (% p.a.)</span>
        <input
          name="interest_rate_percent"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.ratePercent ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Term (months)</span>
        <input
          name="term_months"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={defaults?.termMonths ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">First payment month</span>
        <input
          name="first_payment_month"
          type="month"
          required
          defaultValue={defaults?.firstPaymentMonth ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Lender</span>
        <select
          name="lender_type"
          defaultValue={defaults?.lenderType ?? "bank"}
          className={inputClass}
          disabled={disabled}
        >
          <option value="hdb">HDB</option>
          <option value="bank">Bank</option>
          <option value="other">Other</option>
        </select>
      </label>
    </div>
  );
}

function HousingLoanEditRow({
  clientId,
  loan,
  propertyOptions,
  currencyCode,
  disabled,
}: {
  clientId: string;
  loan: AdvisorHousingLoanRow;
  propertyOptions: PropertyOption[];
  currencyCode: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAdvisorClientHousingLoanAction,
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
      <input type="hidden" name="id" value={loan.id} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{loan.label}</p>
        <span className="text-xs text-slate-500">
          {formatCurrency(loan.principal, currencyCode)}
        </span>
      </div>
      <HousingLoanFields
        defaults={loan}
        propertyOptions={propertyOptions}
        disabled={pending || disabled}
      />
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <AdvisorProposeRemovalButton
          action={deleteAdvisorClientHousingLoanAction}
          clientId={clientId}
          entityId={loan.id}
          entityName={loan.label}
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

function HousingLoanNewEntryForm({
  clientId,
  propertyOptions,
  disabled,
}: {
  clientId: string;
  propertyOptions: PropertyOption[];
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAdvisorClientHousingLoanAction,
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
      <p className="text-sm font-semibold text-slate-900">Suggest a housing loan</p>
      <HousingLoanFields propertyOptions={propertyOptions} disabled={pending || disabled} />
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

/** Housing-loans compose surface: current loans on top (editable + removable),
 * new-entry form below. Loans optionally link to one of the client's shared
 * properties (`propertyOptions`). Only rendered when the client has shared the
 * housing_loans category (parent renders a locked card otherwise). */
export function AdvisorClientHousingLoanSection({
  clientId,
  loans,
  propertyOptions,
  currencyCode,
  disabled = false,
}: {
  clientId: string;
  loans: AdvisorHousingLoanRow[];
  propertyOptions: PropertyOption[];
  currencyCode: string;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
      {loans.map((loan) => (
        <HousingLoanEditRow
          key={loan.id}
          clientId={clientId}
          loan={loan}
          propertyOptions={propertyOptions}
          currencyCode={currencyCode}
          disabled={disabled}
        />
      ))}
      <HousingLoanNewEntryForm
        clientId={clientId}
        propertyOptions={propertyOptions}
        disabled={disabled}
      />
    </div>
  );
}
