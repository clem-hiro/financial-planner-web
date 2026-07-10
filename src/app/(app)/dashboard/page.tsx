import Link from "next/link";
import { isFinancialProfileIncomplete } from "@/data/financial-profile";
import { getDashboardPayload } from "@/data/dashboard";
import { getRequestAuth } from "@/data/supabase/request-context";
import { DashboardMonthSection } from "@/features/dashboard/DashboardMonthSection";
import { DashboardOverviewSection } from "@/features/dashboard/DashboardOverviewSection";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { DashboardSubnav } from "@/features/dashboard/DashboardSubnav";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import {
  appBrandHeaderCompactStyle,
  appBrandNavyTextStyle,
} from "@/ui/app-tab-styles";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/95 p-6 text-sm leading-relaxed text-amber-950 shadow-sm dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100 dark:shadow-none sm:p-8">
        Set{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/70">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/70">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/70">.env.local</code>, run
        migrations, then sign in.
      </div>
    );
  }

  const { supabase, user, profile } = await getRequestAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90 dark:text-emerald-300">
            Secure access
          </p>
          <h1
            className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
            style={appBrandNavyTextStyle}
          >
            Dashboard
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Sign in to review net worth, savings rate, and projections in one
            calm view.
          </p>
        </div>
        <Link
          href="/login"
          className="exec-navy-btn inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const month = formatYearMonth(new Date());
  const payload = await getDashboardPayload(supabase, user.id, month);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const profileIncomplete = isFinancialProfileIncomplete(profile);

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="border-b border-slate-200/80 pb-4 dark:border-slate-800/80 sm:pb-5">
        <div
          className="rounded-2xl border border-slate-200/80 p-4 text-white dark:border-sky-400/20 sm:p-5"
          style={appBrandHeaderCompactStyle}
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/90">
                Today&apos;s command center
              </p>
              <p className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums text-white/90">
                <span className="sr-only">Period </span>
                {month}
              </p>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your financial day at a glance
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200/90">
              Key numbers for this month — deeper planning in Workspaces.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <DashboardSubnav />

        {profileIncomplete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100">
            Complete your financial profile to improve savings rate and projection
            quality.
            <div className="mt-2">
              <Link href="/setup?tab=profile#profile-assumptions" className="underline">
                Complete your financial profile
              </Link>
            </div>
          </div>
        ) : null}

        <section id="overview" className="scroll-mt-28 sm:scroll-mt-32">
          <h2 className="sr-only">Overview</h2>
          <DashboardOverviewSection payload={payload} currency={currency} />
        </section>
      </div>

      <section id="retirement" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="sr-only">Projected wealth</h2>
        <DashboardRetirementSection payload={payload} profile={profile} />
      </section>

      <section id="month" className="scroll-mt-28 space-y-6 sm:scroll-mt-32">
        <h2 className="sr-only">This month</h2>
        <DashboardMonthSection payload={payload} />
      </section>
    </div>
  );
}
