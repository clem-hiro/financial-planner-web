"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";

type SetupTab = {
  id: string;
  label: string;
};

export function SetupTabsNav({
  tabs,
  activeTab,
}: {
  tabs: readonly SetupTab[];
  activeTab: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimisticTab, setOptimisticTab] = useState(activeTab);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    opacity: number;
  }>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const shownTab = isPending ? optimisticTab : activeTab;

  useEffect(() => {
    setOptimisticTab(activeTab);
  }, [activeTab]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current[shownTab];
    if (!container || !activeButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setIndicatorStyle({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
      opacity: 1,
    });
  }, [shownTab, tabs]);

  useEffect(() => {
    const onResize = () => {
      const container = containerRef.current;
      const activeButton = buttonRefs.current[shownTab];
      if (!container || !activeButton) return;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
        opacity: 1,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [shownTab]);

  return (
    <nav
      aria-label="Setup sections"
      className="sticky top-2 z-20 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-sm backdrop-blur"
    >
      <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <div
          ref={containerRef}
          className="relative flex min-w-max snap-x items-center gap-1"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded-xl bg-[#0c192f] shadow-sm shadow-slate-900/20 transition-[transform,width,opacity] duration-300 ease-out"
            style={{
              width: `${indicatorStyle.width}px`,
              transform: `translateX(${indicatorStyle.left}px)`,
              opacity: indicatorStyle.opacity,
            }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              ref={(element) => {
                buttonRefs.current[tab.id] = element;
              }}
              onClick={() => {
                if (tab.id === shownTab) return;
                setOptimisticTab(tab.id);
                startTransition(() => {
                  router.replace(`${pathname}?tab=${tab.id}`, { scroll: false });
                });
              }}
              aria-current={shownTab === tab.id ? "page" : undefined}
              className={`relative z-10 inline-flex min-h-10 snap-start items-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                shownTab === tab.id
                  ? "text-white"
                  : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-900"
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
