import Link from "next/link";

/**
 * Compact, persistent consent cue — driven by consent status in the DB, not inbox
 * read state. Clients can mark the inbox notification as read without losing
 * visibility that consent is still pending.
 */
export function ClientConsentStrip() {
  return (
    <div className="border-b border-amber-200/70 bg-amber-50/75">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5 text-xs text-amber-950 sm:px-8">
        <span className="font-medium">
          Advisor consent pending — your advisor cannot see your data until you
          grant it.
        </span>
        <Link
          href="/more#privacy-advisor-access"
          className="shrink-0 rounded-full bg-amber-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-950"
        >
          Review consent
        </Link>
      </div>
    </div>
  );
}
