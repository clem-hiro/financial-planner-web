import Link from "next/link";

/**
 * Shown for a linked client whose latest consent event is not active (banner
 * flag is server-resolved in `(app)/layout.tsx`). Styling mirrors
 * `AdvisorPhonePromptBanner` (the established shell-banner precedent). The CTA
 * deep-links to the Privacy & Advisor Access control on `/more`, where the
 * client reads the consent text and grants/withdraws.
 */
export function ClientConsentBanner() {
  return (
    <div className="border-b border-amber-200/80 bg-amber-50/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-amber-950 sm:px-8">
        <span>
          Your advisor can&apos;t see your financial data until you grant
          consent. You control this and can withdraw anytime.
        </span>
        <Link
          href="/more#privacy-advisor-access"
          className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950"
        >
          Review consent
        </Link>
      </div>
    </div>
  );
}
