import type { ProfileRow } from "@/data/supabase/types";
import { AdvisorBadge, AdvisorComingSoonPanel } from "@/features/advisor/advisor-workspace-primitives";

/**
 * Consent-first gated state (P-ORDER): a linked-but-non-consented advisor
 * cannot view client data or author proposals. Server actions are the trust
 * boundary; this is the explicit gated UI — NOT an empty workspace — reading
 * only `display_name` from the identity-only profile. Shared by Overview and
 * Compose so both views gate identically.
 */
export function AdvisorConsentRequired({ profile }: { profile: ProfileRow }) {
  return (
    <div className="space-y-8 lg:space-y-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {profile.display_name?.trim() || "Client"}
          </h1>
          <AdvisorBadge tone="warning">Consent required</AdvisorBadge>
        </div>
      </header>
      <AdvisorComingSoonPanel
        title="Consent required"
        body="This client has not granted you consent to view their financial data or receive plan suggestions. Proposal authoring unlocks once they grant consent. No client data is shown until then."
      />
    </div>
  );
}
