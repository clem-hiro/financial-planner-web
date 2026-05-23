import Link from "next/link";
import type { ReactNode } from "react";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

export type AdvisorClientDetailView = "overview" | "proposals" | "proposalDetail";

const TABS: readonly { id: "overview" | "proposals"; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "proposals", label: "Proposals" },
];

/**
 * Shared chrome for the advisor client-detail page: `← Clients` back link
 * + Overview | Proposals sub-tabs (query-param routing on the same `[id]`
 * route, mirroring SetupTabsNav). The active view's body is supplied as one
 * of the `overview` / `proposals` / `proposalDetail` slots; the per-proposal
 * detail keeps the Proposals tab active. Server-renderable (no client JS) —
 * interactive children pass through.
 */
export function AdvisorClientDetailShell({
  clientId,
  activeView,
  overview,
  proposals,
  proposalDetail,
}: {
  clientId: string;
  activeView: AdvisorClientDetailView;
  overview?: ReactNode;
  proposals?: ReactNode;
  proposalDetail?: ReactNode;
}) {
  const body =
    activeView === "overview"
      ? overview
      : activeView === "proposalDetail"
        ? proposalDetail
        : proposals;

  return (
    <div className="space-y-8 lg:space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <Link href="/advisor/clients" className={appInlineLinkClass}>
            ← Clients
          </Link>
        </p>
        <nav aria-label="Client detail sections">
          <div className={appTabRailClass}>
            {TABS.map((tab) => {
              const isActive =
                tab.id === "proposals"
                  ? activeView === "proposals" ||
                    activeView === "proposalDetail"
                  : activeView === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={`/advisor/client/${clientId}?view=${tab.id}`}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={`${appTabPillClass} ${
                    isActive ? appTabPillActiveClass : appTabPillInactiveClass
                  }`}
                  style={isActive ? appActiveGradientStyle : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      {body}
    </div>
  );
}
