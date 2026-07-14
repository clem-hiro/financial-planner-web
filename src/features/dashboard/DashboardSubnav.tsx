"use client";

import { useEffect, useRef, useState } from "react";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

const items = [
  { id: "overview", label: "Overview" },
  { id: "retirement", label: "Projected wealth" },
  { id: "month", label: "This month" },
] as const;

export function DashboardSubnav() {
  const [activeId, setActiveId] =
    useState<(typeof items)[number]["id"]>("overview");
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  // Initial `activeId` stays "overview" on both server and client so
  // hydration matches; a deep-link hash is honored by scrolling its section
  // into view, which the IntersectionObserver below then marks active.
  useEffect(() => {
    const ids = items.map((item) => item.id);
    const initialHash = window.location.hash.replace("#", "");
    if (!ids.includes(initialHash as (typeof items)[number]["id"])) return;
    document
      .getElementById(initialHash)
      ?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    const ids = items.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0].target.id as (typeof items)[number]["id"]);
        }
      },
      {
        rootMargin: "-25% 0px -60% 0px",
        threshold: [0.15, 0.3, 0.5, 0.75],
      }
    );

    ids.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const link = linkRefs.current[activeId];
    if (!link) return;
    const scroller = link.closest("[data-dashboard-subnav-scroll]");
    if (!(scroller instanceof HTMLElement)) return;

    const targetLeft =
      link.offsetLeft - (scroller.clientWidth - link.clientWidth) / 2;
    scroller.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeId]);

  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-14 z-20 -mx-4 border-b border-slate-200/70 bg-background/95 px-4 py-1.5 backdrop-blur-md dark:border-slate-800/80 sm:-mx-8 sm:px-8 sm:top-[5.5rem]"
    >
      <div
        data-dashboard-subnav-scroll
        className="-mx-1 overflow-x-auto px-1 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0"
      >
        <ul
          className={`list-none ${appTabRailClass} w-max max-w-none sm:w-fit sm:max-w-none sm:flex-nowrap`}
        >
          {items.map(({ id, label }) => (
            <li key={id} className="snap-start">
              <a
                href={`#${id}`}
                ref={(element) => {
                  linkRefs.current[id] = element;
                }}
                onClick={(event) => {
                  event.preventDefault();
                  const section = document.getElementById(id);
                  if (section) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                  window.history.replaceState(null, "", `#${id}`);
                  setActiveId(id);
                }}
                aria-current={activeId === id ? "page" : undefined}
                className={`${appTabPillClass} ${
                  activeId === id ? appTabPillActiveClass : appTabPillInactiveClass
                }`}
                style={activeId === id ? appActiveGradientStyle : undefined}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
