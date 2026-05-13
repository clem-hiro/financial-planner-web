"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PLANNING_SECTION_META,
  PLANNING_SECTIONS,
  type PlanningSectionId,
} from "@/lib/planning-sections";
import {
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

export function PlanningSectionNav() {
  const pathname = usePathname();
  const active: PlanningSectionId | null = PLANNING_SECTIONS.find((id) =>
    pathname.startsWith(`/planning/${id}`)
  ) ?? null;

  return (
    <nav aria-label="Planning workspaces" className="sm:mx-0">
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className={appTabRailClass}>
          {PLANNING_SECTIONS.map((id) => {
            const href = `/planning/${id}`;
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                scroll={false}
                title={PLANNING_SECTION_META[id].description}
                aria-current={isActive ? "page" : undefined}
                className={`${appTabPillClass} ${
                  isActive ? appTabPillActiveClass : appTabPillInactiveClass
                }`}
              >
                {PLANNING_SECTION_META[id].label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
