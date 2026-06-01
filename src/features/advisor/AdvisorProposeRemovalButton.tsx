"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { ConfirmDialog } from "@/ui/ConfirmDialog";

type RemovalAction = (
  prev: { error: string | null },
  fd: FormData
) => Promise<{ error: string | null; proposalRecorded?: boolean }>;

/**
 * Row-level "suggest removal" affordance. Mirrors the investment
 * delete-proposal pattern in InvestmentBalancesList (confirm + lock +
 * FormData{client_id,id} + router.refresh + blocking overlay), generic
 * over the delete action so goal and budget-line rows share one unit.
 * The removal is a proposal — the client reviews it before anything
 * changes — so the copy reflects that, not "cannot be undone".
 */
export function AdvisorProposeRemovalButton({
  action,
  clientId,
  entityId,
  entityName,
  disabled = false,
}: {
  action: RemovalAction;
  clientId: string;
  entityId: string;
  entityName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lockRef = useRef(false);

  const run = async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("client_id", clientId);
      fd.set("id", entityId);
      const res = await action({ error: null }, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
      lockRef.current = false;
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={pending || disabled}
        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Suggest removal"}
      </button>
      {error ? (
        <span className="text-[11px] font-medium text-rose-700" role="alert">
          {error}
        </span>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Suggest removal"
        body={`Suggest removing “${entityName}”? Your client reviews this before their plan changes.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmOpen(false);
          void run();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </span>
  );
}
