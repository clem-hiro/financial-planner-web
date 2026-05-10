import Link from "next/link";
import {
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
}: {
  tabs: readonly SetupTab[];
  activeTab: string;
  buildHref: (tabId: string) => string;
}) {
  return (
    <nav aria-label="Setup sections" className="sticky top-2 z-20">
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className={appTabRailClass}>
          {tabs.map((tab) => {
            const href = buildHref(tab.id);
            const isActive = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`${appTabPillClass} ${
                  isActive ? appTabPillActiveClass : appTabPillInactiveClass
                }`}
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
