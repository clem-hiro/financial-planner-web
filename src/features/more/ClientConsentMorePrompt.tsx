"use client";

import { useEffect, useState } from "react";
import { AdvisorConsentDialog } from "@/features/consent/AdvisorConsentDialog";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import { appInlineLinkClass } from "@/ui/app-link-styles";

/** Opens `AdvisorConsentDialog` from `/more` — pending callout or active manage link. */
export function ClientConsentMorePrompt({
  status,
  consentText,
  categoryVisibility,
}: {
  status: "active" | "none" | "withdrawn";
  consentText: string;
  categoryVisibility?: AdvisorCategoryVisibility;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.location.hash !== "#privacy-advisor-access") return;
    setOpen(true);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const isActive = status === "active";

  return (
    <>
      <span id="privacy-advisor-access" className="sr-only">
        Privacy and advisor access
      </span>
      {isActive ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 ring-1 ring-slate-200/70 dark:border-slate-700/80 dark:bg-slate-900 dark:ring-slate-700/80 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Privacy &amp; advisor access
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            Consent is active — your advisor can view shared data and prepare
            suggestions. You can withdraw or change category visibility anytime.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`mt-2 inline-flex text-sm font-semibold ${appInlineLinkClass}`}
          >
            Manage access →
          </button>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-300/45 dark:bg-amber-950/45 sm:px-5"
          role="status"
        >
          <p className="text-sm text-amber-950 dark:text-amber-100">
            {status === "withdrawn"
              ? "You withdrew advisor consent — your advisor cannot see your financial data until you grant it again."
              : "Your advisor cannot see your financial data until you grant consent. You control this and can withdraw anytime."}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`mt-2 inline-flex text-sm font-semibold ${appInlineLinkClass}`}
          >
            Review consent →
          </button>
        </div>
      )}
      <AdvisorConsentDialog
        open={open}
        onOpenChange={setOpen}
        status={status}
        consentText={consentText}
        categoryVisibility={categoryVisibility}
      />
    </>
  );
}
