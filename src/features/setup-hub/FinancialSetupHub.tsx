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
    "Planning workspaces for resilience gaps that do not have setup editors yet.",
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
    <div className="space-y-6 sm:space-y-8">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Financial setup
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] sm:text-4xl">
          Financial Setup
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Review gaps, then open a section to edit the details.
        </p>
      </header>

      <SetupTabsNav
        tabs={setupTabs}
        activeTab="overview"
        overviewHref={SETUP_OVERVIEW_PATH}
        buildHref={(tabId) => setupTabPath(tabId, {})}
      />

      <section className="grid gap-5 rounded-xl border border-slate-200/90 bg-white/90 px-4 py-4 shadow-sm ring-1 ring-slate-100 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.95fr)] lg:items-center">
        <SetupProgressCard progress={snapshot.progress} />
        <div className="border-t border-slate-200/80 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
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
                <h2 className="text-lg font-semibold tracking-tight text-[#0c192f]">
                  {SETUP_MODULE_GROUP_LABELS[groupId]}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {GROUP_DESCRIPTIONS[groupId]}
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500">
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
    </div>
  );
}
