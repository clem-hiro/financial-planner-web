"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import {
  createAdvisorClientLiabilityAction,
  deleteAdvisorClientLiabilityAction,
  updateAdvisorClientLiabilityAction,
} from "@/server/advisor-client-actions";
import { DEBT_CATEGORIES, type DebtCategory } from "@/domain/finance/debt-repayment";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type AdvisorLiabilityRow = {
  id: string;
  name: string;
  balance: number;
  category: DebtCategory | null;
  interestRatePercent: number | null;
  remainingTenureYears: number | null;
  monthlyRepayment: number | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

const CATEGORY_LABELS: Record<DebtCategory, string> = {
  property: "Property",
  vehicle: "Vehicle",
  personal: "Personal",
  credit_card: "Credit card",
  renovation: "Renovation",
  education: "Education",
  other: "Other",
};

function CategoryOptions() {
  return (
    <>
      <option value="">—</option>
      {DEBT_CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {CATEGORY_LABELS[c]}
        </option>
      ))}
    </>
  );
}

/** Shared field set for the new-entry + edit forms. `defaults` prefills the
 * edit row. FormData names match `parseLiabilityFormData`. */
function LiabilityFields({
  defaults,
  disabled,
}: {
  defaults?: Partial<AdvisorLiabilityRow>;
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
          placeholder="e.g. Car loan"
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Outstanding balance</span>
        <input
          name="balance"
          type="number"
          min={0}
          step="0.01"
          required
          defaultValue={defaults?.balance ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Category</span>
        <select
          name="category"
          defaultValue={defaults?.category ?? ""}
          className={inputClass}
          disabled={disabled}
        >
          <CategoryOptions />
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Interest rate (% p.a.)</span>
        <input
          name="interest_rate_percent"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.interestRatePercent ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Remaining tenure (years)</span>
        <input
          name="remaining_tenure_years"
          type="number"
          min={0}
          step="0.5"
          defaultValue={defaults?.remainingTenureYears ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Monthly repayment</span>
        <input
          name="monthly_repayment"
          type="number"
          min={0}
          step="0.01"
          defaultValue={defaults?.monthlyRepayment ?? ""}
          className={inputClass}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function LiabilityEditRow({
  clientId,
  liability,
  currencyCode,
  disabled,
}: {
  clientId: string;
  liability: AdvisorLiabilityRow;
  currencyCode: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAdvisorClientLiabilityAction,
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
      <input type="hidden" name="id" value={liability.id} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{liability.name}</p>
        <span className="text-xs text-slate-500">
          {formatCurrency(liability.balance, currencyCode)}
        </span>
      </div>
      <LiabilityFields defaults={liability} disabled={pending || disabled} />
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <AdvisorProposeRemovalButton
          action={deleteAdvisorClientLiabilityAction}
          clientId={clientId}
          entityId={liability.id}
          entityName={liability.name}
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

function LiabilityNewEntryForm({
  clientId,
  disabled,
}: {
  clientId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAdvisorClientLiabilityAction,
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
      <p className="text-sm font-semibold text-slate-900">Suggest a liability</p>
      <LiabilityFields disabled={pending || disabled} />
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

/** Liabilities compose surface: current liabilities on top (editable + removable
 * as suggestions), new-entry form below. Only rendered when the client has
 * shared the liabilities category (parent renders a locked card otherwise). */
export function AdvisorClientLiabilitySection({
  clientId,
  liabilities,
  currencyCode,
  disabled = false,
}: {
  clientId: string;
  liabilities: AdvisorLiabilityRow[];
  currencyCode: string;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
      {liabilities.map((liability) => (
        <LiabilityEditRow
          key={liability.id}
          clientId={clientId}
          liability={liability}
          currencyCode={currencyCode}
          disabled={disabled}
        />
      ))}
      <LiabilityNewEntryForm clientId={clientId} disabled={disabled} />
    </div>
  );
}
