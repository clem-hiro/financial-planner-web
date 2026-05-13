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
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Level 2 · Resilience workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
          Protection & dependents
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Today this area is mostly roadmap — your emergency liquidity still lives under
          Wealth (cash) until dedicated modules ship.
        </p>
      </header>

      <RecommendationCard
        title="Emergency liquidity"
        body="Park three to six months of essential spend in cash accounts you already track. When insurance modules arrive, we will reconcile coverage against this buffer automatically."
        actionSlot={
          <Link
            href="/planning/wealth"
            className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/15"
          >
            Open Wealth workspace →
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
