import type { ReactNode } from "react";
import { AdvisorClientDetailNav } from "@/features/advisor/AdvisorClientDetailNav";

export type AdvisorClientDetailView =
  | "overview"
  | "compose"
  | "proposals"
  | "proposalDetail";

/**
 * Shared chrome for the advisor client-detail page: context-aware breadcrumb
 * + Overview | Proposals sub-tabs (`AdvisorClientDetailNav`, client-side so
 * search-param-only navigation re-renders reliably). The active view's body is
 * supplied as one of the `overview` / `compose` / `proposals` / `proposalDetail`
 * slots; Compose (`?view=compose`) has no tab — it's reached from the overview
 * projection panel — and per-proposal detail keeps the Proposals tab active.
 */
export function AdvisorClientDetailShell({
  clientId,
  activeView,
  overview,
  compose,
  proposals,
  proposalDetail,
}: {
  clientId: string;
  activeView: AdvisorClientDetailView;
  overview?: ReactNode;
  compose?: ReactNode;
  proposals?: ReactNode;
  proposalDetail?: ReactNode;
}) {
  const body =
    activeView === "overview"
      ? overview
      : activeView === "compose"
        ? compose
        : activeView === "proposalDetail"
          ? proposalDetail
          : proposals;

  return (
    <div className="space-y-8 lg:space-y-10">
      <AdvisorClientDetailNav clientId={clientId} activeView={activeView} />
      {body}
    </div>
  );
}
