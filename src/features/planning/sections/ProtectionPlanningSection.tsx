import Link from "next/link";
import { RecommendationCard } from "@/components/insights/RecommendationCard";
import {
  DependentsPlanningRoadmapCard,
  EstatePlanningRoadmapCard,
  InsuranceRoadmapCard,
  RiskProfilingRoadmapCard,
} from "@/features/planning/roadmap-modules";

export function ProtectionPlanningSection() {
  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Resilience
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0c192f] dark:text-slate-50 sm:text-3xl">
          Protection &amp; dependents
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Today this area is mostly roadmap — your emergency liquidity still lives under
          Cash and debts until dedicated modules ship. Investment-linked plans (ILPs) with
          bundled cover: record fund value and premiums under Investments; add coverage
          details here when insurance tracking ships — do not enter the same dollars twice.
        </p>
      </header>

      <RecommendationCard
        title="Emergency liquidity"
        body="Park three to six months of essential spend in cash accounts you already track. When insurance modules arrive, we will reconcile coverage against this buffer automatically."
        actionSlot={
          <Link
            href="/setup?tab=cash-liabilities"
            className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/15"
          >
            Open Cash and debts →
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <InsuranceRoadmapCard />
        <DependentsPlanningRoadmapCard />
        <EstatePlanningRoadmapCard />
        <RiskProfilingRoadmapCard />
      </section>
    </div>
  );
}
