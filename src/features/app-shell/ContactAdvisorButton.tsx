"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { getMyAdvisorContactAction } from "@/server/advisor-key-purchase-actions";
import {
  getAdvisorConsentGateAction,
  recordAdvisorConsentAction,
} from "@/server/client-consent-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const consentInitial: {
  error: string | null;
  status?: "granted" | "withdrawn";
} = { error: null };

// Dialog styling is CORE utilities + inline style only — NO arbitrary `[...]`
// utilities anywhere in the <dialog> subtree. Tailwind v4 + Turbopack
// intermittently JIT-drops arbitrary values (LEARNINGS:17/25); a consent gate
// must never render unstyled. `fpPrimaryButtonClass` is deliberately NOT
// reused here — it carries the arbitrary-gradient fragility this technique
// avoids. Centering is inline style (immune to JIT drop + beats the UA
// <dialog> stylesheet); ::backdrop dim is a source-CSS rule in globals.css.
const grantButtonClass =
  "rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-60";

export function ContactAdvisorButton({
  menuButtonClassName,
  onOpened,
}: {
  /** When set, replaces default pill styling (e.g. account menu row). */
  menuButtonClassName?: string;
  /** Called after a WhatsApp contact link is opened successfully. */
  onOpened?: () => void;
} = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const proceededRef = useRef(false);
  const dialogHeadingId = useId();

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentText, setConsentText] = useState<string | null>(null);
  const [supportingLine, setSupportingLine] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [consentState, consentFormAction, consentPending] = useActionState(
    recordAdvisorConsentAction,
    consentInitial
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    function dismissOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setMessage(null);
      }
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePointerDown);
    };
  }, [message]);

  // Native <dialog> gives focus trap, Esc, backdrop, and focus restoration to
  // the trigger for free — manual implementations of these tend to regress.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (consentOpen && !dlg.open) {
      dlg.showModal();
    } else if (!consentOpen && dlg.open) {
      dlg.close();
    }
  }, [consentOpen]);

  async function proceedToContact() {
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
        onOpened?.();
        return;
      }
      setMessage(contact.message ?? "Advisor contact is unavailable.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Advisor contact is unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  async function onContactClick() {
    setPending(true);
    setMessage(null);
    try {
      const gate = await getAdvisorConsentGateAction();
      if (gate.status === "active") {
        await proceedToContact();
        return;
      }
      if (!gate.consentText) {
        setMessage(
          "Advisor details are unavailable right now. Please try again later."
        );
        return;
      }
      proceededRef.current = false;
      setConsentText(gate.consentText);
      setSupportingLine(gate.supportingLine);
      setAgreed(false);
      setConsentOpen(true);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Advisor contact is unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  // After a successful grant, close the dialog and proceed to contact (once).
  useEffect(() => {
    if (
      consentOpen &&
      consentState.status === "granted" &&
      !consentState.error &&
      !proceededRef.current
    ) {
      proceededRef.current = true;
      setConsentOpen(false);
      void proceedToContact();
    }
    // proceedToContact is stable enough for this effect's intent; deps kept to
    // the state that gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentState, consentOpen]);

  function closeConsent() {
    setConsentOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <BlockingSubmitOverlay active={pending} message="Opening advisor contact…" />
      <button
        type="button"
        onClick={onContactClick}
        disabled={pending}
        className={
          menuButtonClassName ??
          "inline-flex min-h-10 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs font-semibold tracking-wide text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 sm:min-h-0 sm:py-1.5 disabled:opacity-60"
        }
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

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogHeadingId}
        // Centering is inline (not Tailwind): immune to Turbopack/JIT dropping
        // classes, and inline specificity beats the UA <dialog> stylesheet
        // residual insets. ::backdrop dim is a source-CSS rule in globals.css.
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          right: "auto",
          bottom: "auto",
          transform: "translate(-50%, -50%)",
          margin: 0,
          width: "100%",
          maxWidth: "28rem",
          maxHeight: "100vh",
          overflowY: "auto",
        }}
        className="rounded-2xl border border-slate-200 bg-transparent p-0 shadow-2xl"
        onClose={closeConsent}
        onCancel={closeConsent}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeConsent();
        }}
      >
        <div className="rounded-2xl bg-white p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2
              id={dialogHeadingId}
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Consent for your adviser
            </h2>
            <button
              type="button"
              onClick={closeConsent}
              aria-label="Close"
              className="min-h-11 min-w-11 cursor-pointer rounded-full px-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35"
            >
              ✕
            </button>
          </div>

          <form action={consentFormAction} className="mt-4 space-y-3">
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
              disabled={!agreed || consentPending}
              className={grantButtonClass}
            >
              {consentPending ? "Granting…" : "Grant consent & contact adviser"}
            </button>
            {consentState.error ? (
              <p className="text-sm text-rose-600" role="alert">
                {consentState.error}
              </p>
            ) : null}
            {supportingLine ? (
              <p className="text-xs text-slate-500">{supportingLine}</p>
            ) : null}
          </form>
        </div>
      </dialog>
    </div>
  );
}
