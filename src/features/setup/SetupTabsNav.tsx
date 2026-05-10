"use client";

import { useEffect, useState } from "react";
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
  onSelectTab,
}: {
  tabs: readonly SetupTab[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}) {
  const [optimisticTab, setOptimisticTab] = useState(activeTab);
  const shownTab = optimisticTab;

  useEffect(() => {
    setOptimisticTab(activeTab);
  }, [activeTab]);

  return (
    <nav aria-label="Setup sections" className="sticky top-2 z-20">
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className={appTabRailClass}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === shownTab) return;
                setOptimisticTab(tab.id);
                onSelectTab(tab.id);
              }}
              aria-current={shownTab === tab.id ? "page" : undefined}
              className={`${appTabPillClass} ${
                shownTab === tab.id ? appTabPillActiveClass : appTabPillInactiveClass
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
