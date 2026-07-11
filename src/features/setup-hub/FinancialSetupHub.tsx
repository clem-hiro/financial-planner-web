import {
  SETUP_MODULE_BY_ID,
  SETUP_MODULE_GROUP_LABELS,
  SETUP_MODULES,
} from "@/domain/setup/modules";
import type {
  SetupHubSnapshot,
  SetupModuleEvaluation,
  SetupModuleGroupId,
} from "@/domain/setup/types";
import { SetupModuleCard } from "@/features/setup-hub/SetupModuleCard";
import { SetupProgressCard } from "@/features/setup-hub/SetupProgressCard";
import { SetupRecommendedNextStep } from "@/features/setup-hub/SetupRecommendedNextStep";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";
import {
  AdvisorWorkspaceRoadmapCard,
  AiInsightsRoadmapCard,
} from "@/features/planning/roadmap-modules";
import { SETUP_OVERVIEW_PATH, setupTabPath } from "@/lib/setup-urls";
import { buildSetupTabs } from "@/lib/setup-tabs";

const GROUP_ORDER: SetupModuleGroupId[] = [
  "core",
  "protection",
  "future",
  "advisor_system",
];

const GROUP_DESCRIPTIONS: Record<SetupModuleGroupId, string> = {
  core: "Facts that keep Home, cash flow, and net worth grounded.",
  protection:
    "Resilience gaps and roadmap modules — open Protection for insurance, dependents, and estate placeholders.",
  future: "Long-horizon inputs for retirement, CPF, investments, and goals.",
  advisor_system: "Records and readiness items that support reviews later.",
};

export function FinancialSetupHub({
  snapshot,
  advisorProposalPending = false,
}: {
  snapshot: SetupHubSnapshot;
  /** When true, the nav-only Advisor Proposals card shows a "Pending" pill. */
  advisorProposalPending?: boolean;
}) {
  const evaluationsById = Object.fromEntries(
    snapshot.modules.map((m) => [m.moduleId, m])
  );
  const setupTabs = buildSetupTabs();

  // Synthetic, nav-only evaluation so the advisor_proposal card can show a
  // "Pending" pill. Deliberately NOT added to snapshot.modules/progress — it
  // must not affect completion math.
  const advisorProposalEvaluation: SetupModuleEvaluation | null =
    advisorProposalPending
      ? {
          moduleId: "advisor_proposal",
          status: "pending",
          completionPercentage: 0,
          lastUpdatedAt: null,
          missingFields: [],
        }
      : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-start lg:gap-8">
      <SetupTabsNav
        tabs={setupTabs}
        activeTab="overview"
        overviewHref={SETUP_OVERVIEW_PATH}
        buildHref={(tabId) => setupTabPath(tabId, {})}
      />

      <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] dark:text-slate-50 sm:text-4xl">
          Setup
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Review gaps, then open a section to edit the details.
        </p>
      </header>

      <section className="grid gap-5 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-none dark:ring-slate-700/70 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)] lg:items-center">
        <SetupProgressCard progress={snapshot.progress} />
        <div className="border-t border-slate-200/80 pt-4 dark:border-slate-700/80 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <SetupRecommendedNextStep step={snapshot.recommended} />
        </div>
      </section>

      {GROUP_ORDER.map((groupId) => {
        const modules = SETUP_MODULES.filter((m) => m.group === groupId);
        if (modules.length === 0) return null;
        const moduleEvaluations = modules
          .map((m) => evaluationsById[m.id])
          .filter((m) => m != null);
        const completeCount = moduleEvaluations.filter(
          (m) => m.status === "complete"
        ).length;
        const gridClass =
          modules.length >= 4
            ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
        return (
          <section key={groupId} className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[#0c192f] dark:text-slate-50">
                  {SETUP_MODULE_GROUP_LABELS[groupId]}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {GROUP_DESCRIPTIONS[groupId]}
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {completeCount} of {modules.length} complete
              </p>
            </div>
            <div className={gridClass}>
              {modules.map((def) => {
                const alwaysOn = def.id === "advisor_proposal";
                const evaluation =
                  evaluationsById[def.id] ??
                  (def.id === "advisor_proposal"
                    ? advisorProposalEvaluation
                    : undefined);
                // Navigation-only modules (no completion state) render
                // unconditionally; everything else needs an evaluation.
                if (!evaluation && !alwaysOn) return null;
                return (
                  <div key={def.id} className="min-w-0">
                    <SetupModuleCard
                      definition={SETUP_MODULE_BY_ID[def.id]}
                      evaluation={evaluation ?? null}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#0c192f] dark:text-slate-50">
            Roadmap visibility
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Upcoming intelligence layers stay visible here so product direction is
            honest — nothing in this row changes your stored numbers.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AdvisorWorkspaceRoadmapCard />
          <AiInsightsRoadmapCard />
        </div>
      </section>
      </div>
    </div>
  );
}
