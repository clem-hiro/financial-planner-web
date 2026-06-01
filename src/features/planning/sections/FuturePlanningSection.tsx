import Link from "next/link";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";
import { FinancialGoalsPanels } from "@/features/goals/FinancialGoalsPanels";
import { profileRetirementTargetsProps } from "@/features/goals/profile-retirement-props";
import {
  DocumentsVaultRoadmapCard,
  ReportsRoadmapCard,
  RetirementRoadmapCard,
  ScenarioSimulatorRoadmapCard,
  TaxEstimationRoadmapCard,
} from "@/features/planning/roadmap-modules";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { appInlineLinkClass } from "@/ui/app-link-styles";

const FUTURE_TABS = new Set(["goals", "add-account"]);

export async function FuturePlanningSection() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-slate-600">
        <Link href="/login" className={appInlineLinkClass}>
          Sign in
        </Link>{" "}
        to plan future goals.
      </p>
    );
  }

  const [financialProfile, bundle] = await Promise.all([
    getProfileById(supabase, user.id),
    loadSetupTabBundle(supabase, user.id, FUTURE_TABS),
  ]);

  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Level 2 · Horizon workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
          Goals, retirement, and scenarios
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Goals you already track stay here. Longer-horizon modules will plug into the
          same projections you trust on Home.
        </p>
      </header>

      <FinancialGoalsPanels
        goals={bundle.goals}
        investments={bundle.investments}
        currency={currency}
        userId={user.id}
        {...profileRetirementTargetsProps(financialProfile)}
      />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight text-[#0c192f]">
          Coming modules
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <RetirementRoadmapCard />
          <ScenarioSimulatorRoadmapCard />
          <TaxEstimationRoadmapCard />
          <ReportsRoadmapCard />
          <DocumentsVaultRoadmapCard />
        </div>
      </section>
    </div>
  );
}
