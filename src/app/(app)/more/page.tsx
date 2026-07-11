import Link from "next/link";
import {
  getRequestAuth,
  getSupabaseServerClient,
} from "@/data/supabase/request-context";
import {
  getMyAdvisorCategoryVisibility,
  getMyConsentStatusForAdvisor,
} from "@/data/repositories/advisor-clients";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import { getMyAdvisorContact } from "@/data/repositories/coupons";
import { ClientConsentMorePrompt } from "@/features/more/ClientConsentMorePrompt";
import { OpenMethodologyButton } from "@/features/help/OpenMethodologyButton";
import { CLIENT_UI_VERSION_LABEL } from "@/lib/client-release";
import { isClient } from "@/lib/profile-role";
import { renderConsentText } from "@/server/advisor-consent";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export default async function MorePage() {
  const { profile } = await getRequestAuth();
  const advisorUserId = profile?.advisor_user_id ?? null;
  const showConsent = isClient(profile) && !!advisorUserId;
  let consentStatus: "active" | "withdrawn" | "none" = "none";
  let consentText = "";
  let categoryVisibility: AdvisorCategoryVisibility | undefined;
  if (showConsent && profile && advisorUserId) {
    const supabase = await getSupabaseServerClient();
    // Three independent reads — one round-trip instead of three. The contact
    // read is error-tolerant (a failure must not reject the batch); the other
    // two are required.
    const [status, visibility, contact] = await Promise.all([
      getMyConsentStatusForAdvisor(supabase, profile.id, advisorUserId),
      getMyAdvisorCategoryVisibility(supabase, profile.id, advisorUserId),
      getMyAdvisorContact(supabase).catch(() => null),
    ]);
    consentStatus = status;
    categoryVisibility = visibility;
    consentText = renderConsentText(
      contact?.advisor_name ?? "your linked financial adviser"
    );
  }

  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          More
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] dark:text-slate-50 sm:text-4xl">
          Account &amp; reference
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
          Secondary destinations stay here so the top bar stays calm. Nothing on this
          page changes your financial data.
        </p>
      </header>

      {showConsent ? (
        <ClientConsentMorePrompt
          status={consentStatus}
          consentText={consentText}
          categoryVisibility={categoryVisibility}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/setup/overview"
          className="rounded-2xl bg-linear-to-br from-white via-slate-50/50 to-sky-50/20 p-5 ring-1 ring-slate-200/70 transition hover:ring-slate-300/90 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/30 dark:ring-slate-700/80 dark:hover:ring-slate-500/80"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Financial setup
          </p>
          <p className="mt-2 text-lg font-semibold text-[#0c192f] dark:text-slate-50">
            Setup hub &amp; progress
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Track completion across profile, cash flow, protection, and goals — then
            jump into any section.
          </p>
          <p className={`mt-4 text-sm font-semibold ${appInlineLinkClass}`}>Open →</p>
        </Link>

        <Link
          href="/expenses"
          className="rounded-2xl bg-linear-to-br from-white via-slate-50/50 to-sky-50/20 p-5 ring-1 ring-slate-200/70 transition hover:ring-slate-300/90 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/30 dark:ring-slate-700/80 dark:hover:ring-slate-500/80"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Activity
          </p>
          <p className="mt-2 text-lg font-semibold text-[#0c192f] dark:text-slate-50">Spending hub</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Expenses, charts, and monthly guidance.
          </p>
          <p className={`mt-4 text-sm font-semibold ${appInlineLinkClass}`}>Open →</p>
        </Link>

        <div className="rounded-2xl bg-linear-to-br from-[#0c192f] via-[#10213a] to-[#123355] p-5 text-white ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
            Methodology
          </p>
          <p className="mt-2 text-lg font-semibold">How numbers are built</p>
          <p className="mt-1 text-sm text-slate-200">
            Transparent explanations for net worth, CPF, housing, and budgets.
          </p>
          <div className="mt-4">
            <OpenMethodologyButton
              label="Open methodology"
              className="inline-flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/15 sm:w-auto"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-200/80 pt-8 dark:border-slate-700/80">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sign out lives in the account menu on the top bar for quick access anywhere in
          the app.
        </p>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {CLIENT_UI_VERSION_LABEL}
        </p>
        <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Version 2 reflects a major navigation and planning workspace redesign; core
          calculations and data models stayed compatible with version 1.
        </p>
      </div>
    </div>
  );
}
