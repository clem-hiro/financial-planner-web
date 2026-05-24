"use client";

import { useActionState, useState } from "react";
import {
  recordAdvisorConsentAction,
  updateCategoryVisibilityAction,
} from "@/server/client-consent-actions";
import {
  ADVISOR_VISIBILITY_CATEGORIES,
  ADVISOR_VISIBILITY_LABELS,
  type AdvisorCategoryVisibility,
} from "@/lib/advisor-visibility";
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
  categoryVisibility,
}: {
  status: Status;
  consentText: string;
  /** Per-category opt-in state; toggles render only while consent is active. */
  categoryVisibility?: AdvisorCategoryVisibility;
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
        <>
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
          <CategoryVisibilityToggles
            visibility={categoryVisibility ?? null}
          />
        </>
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

/**
 * Per-category visibility toggles (default PRIVATE). Each row posts the NEXT
 * desired state; the server re-resolves client + advisor from the session, so
 * the form carries only `category` + `is_visible`. A missing row reads as
 * private, matching the DB default-deny.
 */
function CategoryVisibilityToggles({
  visibility,
}: {
  visibility: AdvisorCategoryVisibility | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateCategoryVisibilityAction,
    { error: null as string | null }
  );

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          What your advisor can see
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Each category below is private by default. Turn one on to let your
          advisor view it and propose changes. Turning it off hides it again.
        </p>
      </div>
      <ul className="space-y-2">
        {ADVISOR_VISIBILITY_CATEGORIES.map((category) => {
          const on = visibility?.[category] ?? false;
          return (
            <li
              key={category}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm text-slate-700">
                {ADVISOR_VISIBILITY_LABELS[category]}
              </span>
              <form action={formAction}>
                <input type="hidden" name="category" value={category} />
                <input
                  type="hidden"
                  name="is_visible"
                  value={on ? "false" : "true"}
                />
                <button
                  type="submit"
                  disabled={pending}
                  aria-pressed={on}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    on
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {on ? "Visible" : "Private"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
      {state.error ? (
        <p className="text-sm text-rose-600">{state.error}</p>
      ) : null}
    </div>
  );
}
