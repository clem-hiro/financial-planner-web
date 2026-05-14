"use client";

import { useState } from "react";
import { getMyAdvisorContactAction } from "@/server/advisor-key-purchase-actions";

export function ContactAdvisorButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openAdvisorContact() {
    setPending(true);
    setMessage(null);
    try {
      const contact = await getMyAdvisorContactAction();
      if (contact.available && contact.whatsapp_url) {
        const opened = window.open(
          contact.whatsapp_url,
          "_blank",
          "noopener,noreferrer"
        );
        if (!opened) {
          window.location.assign(contact.whatsapp_url);
        }
        return;
      }
      setMessage(contact.message ?? "Advisor contact is unavailable.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Advisor contact is unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openAdvisorContact}
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs font-semibold tracking-wide text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 sm:min-h-0 sm:py-1.5 disabled:opacity-60"
      >
        {pending ? "Opening..." : "Contact advisor"}
      </button>
      {message ? (
        <p
          className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs text-amber-900 shadow-lg"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
