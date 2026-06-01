"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import {
  createAdvisorClientCashAccountAction,
  deleteAdvisorClientCashAccountAction,
  updateAdvisorClientCashAccountAction,
} from "@/server/advisor-client-actions";
import {
  CASH_ACCOUNT_PURPOSE_LABELS,
  CASH_ACCOUNT_PURPOSES,
  type CashAccountPurpose,
} from "@/domain/finance/cash-account-purpose";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type AdvisorCashRow = {
  id: string;
  name: string;
  balance: number;
  purpose: CashAccountPurpose;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

function PurposeOptions() {
  return (
    <>
      {CASH_ACCOUNT_PURPOSES.map((p) => (
        <option key={p} value={p}>
          {CASH_ACCOUNT_PURPOSE_LABELS[p]}
        </option>
      ))}
    </>
  );
}

function CashEditRow({
  clientId,
  account,
  currencyCode,
  disabled,
}: {
  clientId: string;
  account: AdvisorCashRow;
  currencyCode: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAdvisorClientCashAccountAction,
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
      <input type="hidden" name="id" value={account.id} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{account.name}</p>
        <span className="text-xs text-slate-500">
          {formatCurrency(account.balance, currencyCode)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={account.name}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Balance</span>
          <input
            name="balance"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={account.balance}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Purpose</span>
          <select
            name="purpose"
            defaultValue={account.purpose}
            className={inputClass}
            disabled={pending || disabled}
          >
            <PurposeOptions />
          </select>
        </label>
      </div>
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <AdvisorProposeRemovalButton
          action={deleteAdvisorClientCashAccountAction}
          clientId={clientId}
          entityId={account.id}
          entityName={account.name}
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

function CashNewEntryForm({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAdvisorClientCashAccountAction,
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
      <p className="text-sm font-semibold text-slate-900">Suggest a cash account</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Name</span>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Emergency fund"
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Balance</span>
          <input
            name="balance"
            type="number"
            min={0}
            step="0.01"
            required
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Purpose</span>
          <select
            name="purpose"
            defaultValue="other"
            className={inputClass}
            disabled={pending || disabled}
          >
            <PurposeOptions />
          </select>
        </label>
      </div>
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

/** Cash-accounts compose surface: client's current accounts on top (each
 * editable + removable as a suggestion), new-entry form below — matching the
 * Goals/Budget/Investments layout. Only rendered when the client has shared the
 * cash_accounts category (the parent renders a locked card otherwise). */
export function AdvisorClientCashSection({
  clientId,
  accounts,
  currencyCode,
  disabled = false,
}: {
  clientId: string;
  accounts: AdvisorCashRow[];
  currencyCode: string;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
      {accounts.map((account) => (
        <CashEditRow
          key={account.id}
          clientId={clientId}
          account={account}
          currencyCode={currencyCode}
          disabled={disabled}
        />
      ))}
      <CashNewEntryForm clientId={clientId} disabled={disabled} />
    </div>
  );
}
