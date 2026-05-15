"use client";

import { QR_DEEPLINK_EXPIRY_MINUTES } from "@/config/deeplink";
import {
  refreshAdvisorQrShareAction,
  type SerializableQrShareData,
} from "@/server/advisor-qr-share-actions";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

type Props = { initialData: SerializableQrShareData | null };

// 60-second window for the polite a11y announcement so it fires once near expiry.
const ONE_MIN_MS = 60 * 1000;

function formatMmSs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useCountdown(expiresAtIso: string | null, active: boolean): {
  remainingMs: number;
  expired: boolean;
} {
  const target = useMemo(
    () => (expiresAtIso ? new Date(expiresAtIso).getTime() : null),
    [expiresAtIso]
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, target]);

  const remainingMs = target ? Math.max(0, target - now) : 0;
  return { remainingMs, expired: target != null && remainingMs <= 0 };
}

function useCopyToClipboard(): {
  copy: (text: string) => Promise<void>;
  copied: string | null;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { copy, copied };
}

// Tailwind v4 preflight no longer sets `cursor: pointer` on <button>; opt back in here.
const showQrButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function AdvisorKeyQrShareButton({ initialData }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SerializableQrShareData | null>(initialData);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogHeadingId = useId();
  const { copy, copied } = useCopyToClipboard();
  const { remainingMs, expired } = useCountdown(data?.expiresAt ?? null, open);

  // Native <dialog> gives us focus trap, Esc handling, backdrop, and focus restoration
  // to the trigger for free — manual implementations of these tend to regress.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setRefreshError(null);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshError(null);
    startTransition(async () => {
      const r = await refreshAdvisorQrShareAction();
      if (r.ok) {
        setData(r.data);
      } else if (r.reason === "no_keys") {
        setData(null);
        setRefreshError("No available keys. Buy more to share.");
      } else {
        setRefreshError("Could not refresh QR. Try again.");
      }
    });
  }, []);

  const hasData = data !== null;

  const countdownLabel = expired ? "Expired" : `Expires in ${formatMmSs(remainingMs)}`;
  const showA11yAnnouncement =
    open && hasData && (expired || (remainingMs > 0 && remainingMs <= ONE_MIN_MS));
  const a11yMessage = expired
    ? "QR code expired. Click Refresh to mint a new one."
    : "QR code expires in one minute.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={showQrButtonClass}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Show QR
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogHeadingId}
        // backdrop:bg-* styles the native ::backdrop pseudo-element
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-transparent p-0 shadow-2xl backdrop:bg-slate-900/50"
        onClose={closeDialog}
        onCancel={closeDialog}
        onClick={(e) => {
          // With p-0 on the dialog, any click hitting the dialog element itself is
          // the backdrop (content is in the inner wrapper).
          if (e.target === e.currentTarget) closeDialog();
        }}
      >
        <div className="rounded-2xl bg-white p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2
            id={dialogHeadingId}
            className="text-lg font-semibold tracking-tight text-[#0c192f]"
          >
            Scan to sign up as a new client
          </h2>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="min-h-11 min-w-11 cursor-pointer rounded-full px-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2"
          >
            ✕
          </button>
        </div>

        {!hasData ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
            <p className="font-medium text-slate-900">No available keys.</p>
            <p className="mt-1">
              <Link
                href="/advisor/buy-keys"
                className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-700"
              >
                Buy more keys
              </Link>{" "}
              to share a one-time signup link.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Sharing as: <span className="font-semibold text-slate-900">{data.advisorDisplayName}</span>
            </p>

            <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
              <div
                role="img"
                aria-label={`QR code linking to advisor signup, valid for ${QR_DEEPLINK_EXPIRY_MINUTES} minutes`}
                className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[280px]"
                dangerouslySetInnerHTML={{ __html: data.qrSvg }}
              />
            </div>

            <p className="mt-3 text-center text-sm text-slate-700">
              Point your phone camera at the code. The whole code must be visible.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Can&apos;t scan? Open this link on your phone
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  {/* Anti-quishing trust signal: full domain readable, copyable. break-all keeps the
                      whole URL visible on narrow widths without truncation. */}
                  <code className="block grow break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 sm:text-base">
                    {data.deeplinkUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(data.deeplinkUrl)}
                    className={secondaryButtonClass}
                  >
                    {copied === data.deeplinkUrl ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Or use the access key directly
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <code className="block grow break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm tracking-wide text-slate-900 sm:text-base">
                    {data.accessKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(data.accessKey)}
                    className={secondaryButtonClass}
                  >
                    {copied === data.accessKey ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Tip: bright, even lighting works best.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closeDialog}
                className={secondaryButtonClass}
              >
                Close
              </button>
              <div className="flex items-center gap-3">
                <span
                  className={
                    expired
                      ? "text-sm font-semibold text-amber-700"
                      : "text-sm font-medium text-slate-700"
                  }
                >
                  {countdownLabel}
                </span>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={pending}
                  className={secondaryButtonClass}
                >
                  {pending ? "Refreshing…" : "Refresh QR"}
                </button>
              </div>
            </div>
          </>
        )}

        {refreshError ? (
          <p
            className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            role="alert"
          >
            {refreshError}
          </p>
        ) : null}

        <div role="status" aria-live="polite" className="sr-only">
          {showA11yAnnouncement ? a11yMessage : ""}
        </div>
        <div role="status" aria-live="polite" className="sr-only">
          {copied ? "Copied to clipboard" : ""}
        </div>
        </div>
      </dialog>
    </>
  );
}
