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
import { formatCurrency } from "@/ui/lib/format";

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
    <div className="space-y-10 sm:space-y-12">
      <header className="space-y-5 border-b border-slate-200/80 pb-6 dark:border-slate-800/80 sm:space-y-6 sm:pb-8">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-300/35 dark:bg-emerald-950/35">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              Safe to Spend
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">
              {payload.discretionaryAfterGoals != null
                ? formatCurrency(
                    Math.max(0, payload.discretionaryAfterGoals),
                    payload.baseCurrency
                  )
                : "Set income"}
            </p>
            <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/85">
              Monthly buffer after spend basis and planned goals.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Monthly health
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {payload.savingsRate != null ? "On track" : "Needs setup"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Based on income, spend, and goals.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Spending control
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {payload.monthlyBudgetAggregate.onTrack ? "Within plan" : "Over plan"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Budget check below.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Retirement progress
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {payload.ageProjection ? "Projection ready" : "Add birth date"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Long-term view from your current plan.</p>
          </div>
        </div>
        <DashboardSubnav />
      </header>

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

      <section id="overview" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
        <h2 className="sr-only">Overview</h2>
        <DashboardOverviewSection payload={payload} currency={currency} />
      </section>

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
