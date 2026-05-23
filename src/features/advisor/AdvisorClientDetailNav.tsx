import type { AdvisorClientDetailView } from "@/features/advisor/AdvisorClientDetailShell";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "proposals", label: "Proposals" },
] as const;

/**
 * Breadcrumb + Overview|Proposals tab rail.
 *
 * Uses plain `<a href>` (NOT next/link): Next App Router soft-nav — both
 * `<Link>` and `router.push` — is unreliable in WebKit/Safari for same-pathname
 * search-param changes (e.g. ?view=proposals → ?view=overview), verified flaky
 * across runs. A real anchor does a full navigation that works in every engine.
 * Full reload on tab switch is acceptable for these heavy server views (no
 * client state to preserve).
 *
 * Breadcrumb hierarchy: overview/proposals are sibling tabs → `← Clients`;
 * compose is launched from overview → `← Overview`; proposal detail is a child
 * of the list → `← Proposals`.
 */
export function AdvisorClientDetailNav({
  clientId,
  activeView,
}: {
  clientId: string;
  activeView: AdvisorClientDetailView;
}) {
  let breadcrumbHref: string;
  let breadcrumbLabel: string;
  if (activeView === "compose") {
    breadcrumbHref = `/advisor/client/${clientId}?view=overview`;
    breadcrumbLabel = "← Overview";
  } else if (activeView === "proposalDetail") {
    breadcrumbHref = `/advisor/client/${clientId}?view=proposals`;
    breadcrumbLabel = "← Proposals";
  } else {
    breadcrumbHref = "/advisor/clients";
    breadcrumbLabel = "← Clients";
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <a href={breadcrumbHref} className={appInlineLinkClass}>
          {breadcrumbLabel}
        </a>
      </p>
      {activeView !== "compose" && (
        <nav aria-label="Client detail sections">
          <div role="tablist" className={appTabRailClass}>
            {TABS.map((tab) => {
              const isActive =
                tab.id === "proposals"
                  ? activeView === "proposals" || activeView === "proposalDetail"
                  : activeView === tab.id;
              return (
                <a
                  key={tab.id}
                  href={`/advisor/client/${clientId}?view=${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  className={`${appTabPillClass} ${
                    isActive ? appTabPillActiveClass : appTabPillInactiveClass
                  }`}
                  style={isActive ? appActiveGradientStyle : undefined}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
