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
  appBrandHeaderStyle,
  appBrandNavyTextStyle,
} from "@/ui/app-tab-styles";
import { formatCurrency } from "@/ui/lib/format";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/95 p-6 text-sm leading-relaxed text-amber-950 shadow-sm sm:p-8">
        Set{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-amber-100 px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code className="rounded bg-amber-100 px-1">.env.local</code>, run
        migrations, then sign in.
      </div>
    );
  }

  const { supabase, user, profile } = await getRequestAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90">
            Secure access
          </p>
          <h1
            className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
            style={appBrandNavyTextStyle}
          >
            Dashboard
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
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
      <header className="space-y-6 border-b border-slate-200/80 pb-8 sm:pb-10">
        <div
          className="rounded-3xl border border-slate-200/80 p-6 text-white sm:p-8"
          style={appBrandHeaderStyle}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                Today&apos;s command center
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Your financial day at a glance.
              </h1>
              <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
                Safe to spend, recent rhythm, and alerts — with deeper planning one tap
                away in Workspaces.
              </p>
            </div>
            <p className="shrink-0 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center font-mono text-xs font-medium tabular-nums text-white/90 sm:text-sm">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Period
              </span>
              {month}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              Safe to Spend
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-950">
              {payload.discretionaryAfterGoals != null
                ? formatCurrency(
                    Math.max(0, payload.discretionaryAfterGoals),
                    payload.baseCurrency
                  )
                : "Set income"}
            </p>
            <p className="mt-1 text-xs text-emerald-900/90">
              Monthly buffer after spend basis and planned goals.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Monthly health
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {payload.savingsRate != null ? "On track" : "Needs setup"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Based on income, spend, and goals.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Spending control
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {payload.monthlyBudgetAggregate.onTrack ? "Within plan" : "Over plan"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Top categories and guidance below.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Retirement progress
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {payload.ageProjection ? "Projection ready" : "Add birth date"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Long-term view from your current plan.</p>
          </div>
        </div>
        <DashboardSubnav />
      </header>

      {profileIncomplete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
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
