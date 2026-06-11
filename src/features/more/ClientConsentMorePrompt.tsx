import Link from "next/link";
import { appInlineLinkClass } from "@/ui/app-link-styles";

/** Page-local callout on `/more` when advisor consent is not active. */
export function ClientConsentMorePrompt({
  status,
}: {
  status: "none" | "withdrawn";
}) {
  return (
    <div
      className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-300/45 dark:bg-amber-950/45 sm:px-5"
      role="status"
    >
      <p className="text-sm text-amber-950 dark:text-amber-100">
        {status === "withdrawn"
          ? "You withdrew advisor consent — your advisor cannot see your financial data until you grant it again."
          : "Your advisor cannot see your financial data until you grant consent. You control this and can withdraw anytime."}
      </p>
      <Link
        href="#privacy-advisor-access"
        className={`mt-2 inline-flex text-sm font-semibold ${appInlineLinkClass}`}
      >
        Review consent →
      </Link>
    </div>
  );
}
