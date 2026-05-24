import Link from "next/link";
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
import { appInlineLinkClass } from "@/ui/app-link-styles";

const GROUP_ORDER: SetupModuleGroupId[] = [
  "core",
  "protection",
  "future",
  "advisor_system",
];

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
    <div className="space-y-10 sm:space-y-12">
      <header className="max-w-2xl space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Financial setup
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] sm:text-4xl">
          Financial Setup
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          Complete your financial profile progressively for more accurate planning
          and insights. Resume anytime — your existing forms and tabs stay
          unchanged.
        </p>
        <p className="text-sm">
          <Link href="/setup?tab=profile" className={appInlineLinkClass}>
            Open classic setup tabs →
          </Link>
        </p>
      </header>

      <SetupProgressCard progress={snapshot.progress} />
      <SetupRecommendedNextStep step={snapshot.recommended} />

      {GROUP_ORDER.map((groupId) => {
        const modules = SETUP_MODULES.filter((m) => m.group === groupId);
        if (modules.length === 0) return null;
        return (
          <section key={groupId} className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight text-[#0c192f]">
              {SETUP_MODULE_GROUP_LABELS[groupId]}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <SetupModuleCard
                    key={def.id}
                    definition={SETUP_MODULE_BY_ID[def.id]}
                    evaluation={evaluation ?? null}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
