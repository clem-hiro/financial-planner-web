import Link from "next/link";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";
import { SETUP_NAV_GROUPS, type SetupTabDef } from "@/lib/setup-tabs";

type SetupTab = SetupTabDef;

function tabById(
  tabs: readonly SetupTab[],
  id: string
): SetupTab | undefined {
  return tabs.find((t) => t.id === id);
}

function NavLink({
  href,
  label,
  isActive,
  badge = 0,
  variant,
}: {
  href: string;
  label: string;
  isActive: boolean;
  badge?: number;
  variant: "pill" | "side";
}) {
  if (variant === "pill") {
    return (
      <Link
        href={href}
        scroll={false}
        aria-current={isActive ? "page" : undefined}
        className={`${appTabPillClass} inline-flex items-center gap-1.5 max-sm:min-h-9 max-sm:px-3.5 max-sm:py-1.5 max-sm:text-[13px] ${
          isActive
            ? appTabPillActiveClass
            : `${appTabPillInactiveClass} max-sm:bg-slate-100/80 max-sm:text-slate-500 max-sm:hover:bg-slate-100 max-sm:hover:text-slate-700 max-sm:dark:bg-slate-900 max-sm:dark:text-slate-300 max-sm:dark:hover:bg-slate-800 max-sm:dark:hover:text-slate-100`
        }`}
        style={isActive ? appActiveGradientStyle : undefined}
      >
        {label}
        {badge > 0 ? (
          <span
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white"
            aria-label={`${badge} pending`}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "text-white shadow-sm shadow-slate-900/15 dark:text-slate-950"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
      style={isActive ? appActiveGradientStyle : undefined}
    >
      <span>{label}</span>
      {badge > 0 ? (
        <span
          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 ${
            isActive
              ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
              : "bg-rose-600 text-white"
          }`}
          aria-label={`${badge} pending`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Setup section navigator: horizontal scroll rail on small screens,
 * grouped sticky side menu from `lg` up.
 */
export function SetupTabsNav({
  tabs,
  activeTab,
  buildHref,
  overviewHref,
  badges,
}: {
  tabs: readonly SetupTab[];
  activeTab: string;
  buildHref: (tabId: string) => string;
  overviewHref?: string;
  /** Per-tab count pills (e.g. pending advisor proposals); rendered when > 0. */
  badges?: Record<string, number>;
}) {
  return (
    <>
      {/* Mobile / tablet: horizontal rail */}
      <nav
        aria-label="Setup sections"
        className="sticky top-14 z-20 -mx-4 bg-white/90 px-4 py-1.5 backdrop-blur-md dark:bg-background/90 lg:hidden"
      >
        <div className="scrollbar-hide -mx-1 overflow-x-auto scroll-smooth px-1 pb-0.5">
          <div
            className={`inline-flex min-w-max snap-x snap-mandatory flex-nowrap items-center gap-2 ${appTabRailClass} rounded-2xl border-0 bg-transparent p-0 shadow-none ring-0`}
          >
            {overviewHref ? (
              <NavLink
                href={overviewHref}
                label="Overview"
                isActive={activeTab === "overview"}
                variant="pill"
              />
            ) : null}
            {tabs.map((tab) => (
              <NavLink
                key={tab.id}
                href={buildHref(tab.id)}
                label={tab.label}
                isActive={activeTab === tab.id}
                badge={badges?.[tab.id] ?? 0}
                variant="pill"
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Desktop: grouped side menu */}
      <nav
        aria-label="Setup sections"
        className="hidden lg:sticky lg:top-24 lg:block lg:self-start lg:w-52 lg:shrink-0 xl:w-56"
      >
        <div className="space-y-5 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90">
          {SETUP_NAV_GROUPS.map((group) => {
            const items: Array<{
              key: string;
              href: string;
              label: string;
              isActive: boolean;
              badge: number;
            }> = [];

            if (group.id === "progress" && overviewHref) {
              items.push({
                key: "overview",
                href: overviewHref,
                label: "Overview",
                isActive: activeTab === "overview",
                badge: 0,
              });
            }

            for (const tabId of group.tabIds) {
              const tab = tabById(tabs, tabId);
              if (!tab) continue;
              items.push({
                key: tab.id,
                href: buildHref(tab.id),
                label: tab.label,
                isActive: activeTab === tab.id,
                badge: badges?.[tab.id] ?? 0,
              });
            }

            if (items.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.key}>
                      <NavLink
                        href={item.href}
                        label={item.label}
                        isActive={item.isActive}
                        badge={item.badge}
                        variant="side"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
