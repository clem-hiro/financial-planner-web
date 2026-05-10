"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";

type SetupTab = {
  id: string;
  label: string;
};

type Panel = {
  id: string;
  content: ReactNode;
};

export function SetupTabsClient({
  tabs,
  initialTab,
  panels,
}: {
  tabs: readonly SetupTab[];
  initialTab: string;
  panels: readonly Panel[];
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const activePanel =
    panels.find((panel) => panel.id === activeTab) ??
    panels.find((panel) => panel.id === "profile") ??
    panels[0];

  return (
    <>
      <SetupTabsNav
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={(nextTab) => {
          setActiveTab(nextTab);
          if (typeof window !== "undefined") {
            const nextUrl = `${window.location.pathname}?tab=${nextTab}`;
            window.history.replaceState(null, "", nextUrl);
          }
        }}
      />
      <div key={activeTab} className="transition-opacity duration-150 ease-out">
        {activePanel?.content}
      </div>
    </>
  );
}
