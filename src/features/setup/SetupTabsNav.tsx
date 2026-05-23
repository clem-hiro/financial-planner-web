import Link from "next/link";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

type SetupTab = {
  id: string;
  label: string;
};

export function SetupTabsNav({
  tabs,
  activeTab,
  buildHref,
  overviewHref,
}: {
  tabs: readonly SetupTab[];
  activeTab: string;
  buildHref: (tabId: string) => string;
  overviewHref?: string;
}) {
  return (
    <nav
      aria-label="Setup sections"
      className="sticky top-14 z-20 -mx-4 bg-white/90 px-4 py-1.5 backdrop-blur-md sm:top-22 sm:mx-0 sm:bg-transparent sm:px-0 sm:py-2"
    >
      <div className="scrollbar-hide -mx-1 overflow-x-auto scroll-smooth px-1 pb-0.5 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div
          className={`inline-flex min-w-max snap-x snap-mandatory flex-nowrap items-center gap-2 sm:min-w-0 sm:flex-wrap sm:gap-1.5 ${appTabRailClass} max-sm:rounded-2xl max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:ring-0`}
        >
          {overviewHref ? (
            <Link
              href={overviewHref}
              aria-current={activeTab === "overview" ? "page" : undefined}
              className={`${appTabPillClass} max-sm:min-h-9 max-sm:px-3.5 max-sm:py-1.5 max-sm:text-[13px] ${
                activeTab === "overview"
                  ? appTabPillActiveClass
                  : `${appTabPillInactiveClass} max-sm:bg-slate-100/80 max-sm:text-slate-500 max-sm:hover:bg-slate-100 max-sm:hover:text-slate-700`
              }`}
              style={activeTab === "overview" ? appActiveGradientStyle : undefined}
            >
              Overview
            </Link>
          ) : null}
          {tabs.map((tab) => {
            const href = buildHref(tab.id);
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`${appTabPillClass} max-sm:min-h-9 max-sm:px-3.5 max-sm:py-1.5 max-sm:text-[13px] ${
                  isActive
                    ? appTabPillActiveClass
                    : `${appTabPillInactiveClass} max-sm:bg-slate-100/80 max-sm:text-slate-500 max-sm:hover:bg-slate-100 max-sm:hover:text-slate-700`
                }`}
                style={isActive ? appActiveGradientStyle : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
