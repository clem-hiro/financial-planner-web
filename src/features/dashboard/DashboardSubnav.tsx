"use client";

import { useEffect, useRef, useState } from "react";

const items = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Financial profile" },
  { id: "retirement", label: "Retirement" },
  { id: "month", label: "This month" },
] as const;

export function DashboardSubnav() {
  const [activeId, setActiveId] = useState<(typeof items)[number]["id"]>(() => {
    if (typeof window === "undefined") return "overview";
    const ids = items.map((item) => item.id);
    const initialHash = window.location.hash.replace("#", "");
    return ids.includes(initialHash as (typeof items)[number]["id"])
      ? (initialHash as (typeof items)[number]["id"])
      : "overview";
  });
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

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
    <nav aria-label="Dashboard sections" className="sm:mx-0">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        On this page
      </p>
      <div
        data-dashboard-subnav-scroll
        className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        <ul className="inline-flex min-w-max snap-x snap-mandatory gap-1 rounded-xl border border-slate-200/90 bg-linear-to-r from-white via-slate-50/80 to-sky-50/85 p-1 shadow-sm sm:min-w-0 sm:max-w-full sm:flex-wrap">
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
                className={`block min-h-10 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:min-h-0 sm:py-2.5 ${
                  activeId === id
                    ? "bg-linear-to-r from-[#0c192f] via-[#133359] to-[#047857] text-white shadow-sm shadow-slate-900/10"
                    : "text-slate-600 hover:bg-white hover:text-[#0c192f]"
                }`}
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
