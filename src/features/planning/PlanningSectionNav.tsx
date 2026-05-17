"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PLANNING_SECTION_META,
  PLANNING_SECTIONS,
  type PlanningSectionId,
} from "@/lib/planning-sections";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
} from "@/ui/app-tab-styles";

export function PlanningSectionNav() {
  const pathname = usePathname();
  const active: PlanningSectionId | null = PLANNING_SECTIONS.find((id) =>
    pathname.startsWith(`/planning/${id}`)
  ) ?? null;

  return (
    <nav
      aria-label="Planning workspaces"
      className="sticky top-[4.75rem] z-20 py-2 sm:top-[5.5rem]"
    >
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className="inline-flex min-w-max snap-x items-center gap-1.5 rounded-full bg-white/88 p-1 shadow-[0_14px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 backdrop-blur-xl sm:min-w-0 sm:flex-wrap">
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
                style={isActive ? appActiveGradientStyle : undefined}
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
