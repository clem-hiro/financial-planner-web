import Link from "next/link";
import { getDashboardPayload } from "@/data/dashboard";
import { isFinancialProfileIncomplete } from "@/data/financial-profile";
import { getRequestAuth } from "@/data/supabase/request-context";
import { DashboardOverviewSection } from "@/features/dashboard/DashboardOverviewSection";
import { InsightCard } from "@/components/insights/InsightCard";
import { AiInsightsRoadmapCard, AdvisorWorkspaceRoadmapCard } from "@/features/planning/roadmap-modules";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

export async function OverviewPlanningSection() {
  const { supabase, user, profile } = await getRequestAuth();

  if (!user) {
    return (
      <p className="text-sm text-slate-600">
        <Link href="/login" className={appInlineLinkClass}>
          Sign in
        </Link>{" "}
        to see your planning overview.
      </p>
    );
  }

  const month = formatYearMonth(new Date());
  const payload = await getDashboardPayload(supabase, user.id, month);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const profileIncomplete = isFinancialProfileIncomplete(profile);

  return (
    <div className="space-y-10">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-linear-to-br from-white via-slate-50/60 to-sky-50/30 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 xl:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Level 1 · Snapshot
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
            Financial overview
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            High-signal metrics for this month. Open detailed workspaces below when you
            are ready to adjust assumptions.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200/60">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Safe to spend
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-900">
                {payload.discretionaryAfterGoals != null
                  ? formatCurrency(
                      Math.max(0, payload.discretionaryAfterGoals),
                      payload.baseCurrency
                    )
                  : "Set income"}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200/60">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Net worth
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0c192f]">
                {formatCurrency(payload.netWorth, payload.baseCurrency)}
              </dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/dashboard" className={appInlineLinkClass}>
              Home command center →
            </Link>
            <Link href="/setup?tab=profile" className={appInlineLinkClass}>
              Profile &amp; assumptions →
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          <InsightCard
            tone="neutral"
            title="Cash flow rhythm"
            summary="Keep discretionary spend within the monthly buffer shown on Home after goals and essentials."
            footnote="Derived from the same models as your dashboard — not a new calculation path."
          />
          <InsightCard
            tone="positive"
            title="Progressive planning"
            summary="Use Overview for the headline, then Cash Flow and Wealth when you need levers, not before."
          />
        </div>
      </div>

      {profileIncomplete ? (
        <div className="rounded-2xl bg-amber-50/90 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200/80">
          Complete a few profile fields to sharpen savings rate and projections.{" "}
          <Link href="/setup?tab=profile" className={appInlineLinkClass}>
            Continue setup →
          </Link>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-[#0c192f]">
              Position detail
            </h3>
            <p className="text-sm text-slate-600">
              Level 2 · Same breakdown as Home, without navigation noise.
            </p>
          </div>
        </div>
        <DashboardOverviewSection payload={payload} currency={currency} />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-[#0c192f]">
          Roadmap visibility
        </h3>
        <p className="max-w-2xl text-sm text-slate-600">
          Upcoming intelligence layers stay visible here so the product direction is
          honest — nothing in this row changes your stored numbers.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <AdvisorWorkspaceRoadmapCard />
          <AiInsightsRoadmapCard />
        </div>
      </section>
    </div>
  );
}
