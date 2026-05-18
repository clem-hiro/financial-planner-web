"use client";

import { useActionState, useState } from "react";
import { recordAdvisorConsentAction } from "@/server/client-consent-actions";
import { fpPrimaryButtonClass } from "@/ui/input-classes";

type Status = "active" | "withdrawn" | "none";

const initial: { error: string | null; status?: "granted" | "withdrawn" } = {
  error: null,
};

/**
 * Privacy & Advisor Access control (client). `status`/`consentText` are
 * server-resolved props (no server-only import in the client bundle). Grant
 * requires an explicit affirmative checkbox; withdraw is one click. Both post
 * to the append-only `recordAdvisorConsentAction` — the server assigns the
 * writer, advisor linkage, copy, and created_at/seq.
 */
export function ClientConsentControl({
  status,
  consentText,
}: {
  status: Status;
  consentText: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordAdvisorConsentAction,
    initial
  );
  const [agreed, setAgreed] = useState(false);
  const isActive = status === "active";

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Status:{" "}
        <span className="font-semibold text-slate-900">
          {isActive
            ? "Consent granted — your advisor can view your data and prepare suggestions."
            : status === "withdrawn"
              ? "Consent withdrawn — your advisor cannot see your data."
              : "Not granted — your advisor cannot see your data."}
        </span>
      </p>

      {isActive ? (
        <form action={formAction}>
          <input type="hidden" name="status" value="withdrawn" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Withdrawing…" : "Withdraw consent"}
          </button>
        </form>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="status" value="granted" />
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {consentText}
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>I have read and agree to the above.</span>
          </label>
          <button
            type="submit"
            disabled={!agreed || pending}
            className={`${fpPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {pending ? "Granting…" : "Grant consent"}
          </button>
        </form>
      )}

      {state.error ? (
        <p className="text-sm text-rose-600">{state.error}</p>
      ) : null}
    </div>
  );
}
