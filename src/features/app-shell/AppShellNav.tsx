"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import {
  CLIENT_MAIN_NAV,
  CLIENT_MAIN_NAV_PREFETCH_HREFS,
} from "@/lib/client-main-nav";
import {
  appShellMainNavRailClass,
  appTabPillClass,
  appTabPillInactiveClass,
} from "@/ui/app-tab-styles";

export function AppShellNav({
  workspace,
}: {
  workspace: "client" | "advisor";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopRailRef = useRef<HTMLDivElement | null>(null);
  const desktopLinkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [activeIndicator, setActiveIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const activeIndicatorInset = 2;

  useEffect(() => {
    for (const href of CLIENT_MAIN_NAV_PREFETCH_HREFS) {
      router.prefetch(href);
    }
  }, [router]);

  useEffect(() => {
    if (!mobileOpen) return;
    const unlock = lockBodyScroll();
    return unlock;
  }, [mobileOpen]);

  const isActive = (route: (typeof CLIENT_MAIN_NAV)[number]) =>
    route.activeMatch(pathname);

  const activeRoute = CLIENT_MAIN_NAV.find((route) => isActive(route));

  useLayoutEffect(() => {
    const rail = desktopRailRef.current;
    const activeLink = activeRoute
      ? desktopLinkRefs.current[activeRoute.id]
      : null;
    if (!rail || !activeLink) {
      return;
    }

    const updateIndicator = () => {
      const railRect = rail.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setActiveIndicator({
        left: linkRect.left - railRect.left + activeIndicatorInset,
        width: Math.max(0, linkRect.width - activeIndicatorInset * 2),
      });
    };

    const frame = requestAnimationFrame(updateIndicator);
    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(rail);
    resizeObserver.observe(activeLink);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeRoute]);

  if (workspace === "advisor") {
    return null;
  }

  return (
    <nav className="relative w-full min-w-0 sm:w-max" aria-label="Main">
      <div className="sm:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-main-nav-menu"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200/90 bg-linear-to-br from-white to-sky-50/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:from-sky-50 hover:to-emerald-50/70"
        >
          <span className="inline-flex flex-col gap-1" aria-hidden>
            <span className="block h-0.5 w-4 rounded-full bg-slate-700" />
            <span className="block h-0.5 w-4 rounded-full bg-slate-700" />
            <span className="block h-0.5 w-4 rounded-full bg-slate-700" />
          </span>
        </button>
        {mobileOpen &&
          createPortal(
            <div
              id="mobile-main-nav-menu"
              className="fixed inset-0 z-100 bg-white"
            >
              <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-6 pb-10 pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Navigation
                  </p>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
                    aria-label="Close navigation menu"
                  >
                    <span aria-hidden className="text-2xl leading-none">
                      ×
                    </span>
                  </button>
                </div>
                <div className="mt-8 flex flex-1 items-start">
                  <ul className="w-full space-y-2.5">
                    {CLIENT_MAIN_NAV.map((route) => {
                      const active = isActive(route);
                      return (
                        <li key={route.id}>
                          <Link
                            href={route.href}
                            prefetch
                            onClick={() => setMobileOpen(false)}
                            className={`flex min-h-14 items-center rounded-2xl px-5 py-3 text-3xl font-semibold tracking-tight transition ${
                              active
                                ? "bg-linear-to-r from-[#0c192f] via-[#133359] to-[#047857] text-white shadow-md shadow-slate-900/20"
                                : "text-[#0c192f] hover:bg-sky-50"
                            }`}
                          >
                            {route.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      <div className="hidden sm:block">
        <div ref={desktopRailRef} className={`${appShellMainNavRailClass} relative`}>
          {activeIndicator ? (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 left-0 top-1.5 rounded-full bg-linear-to-r from-[#0c192f] via-[#133359] to-[#047857] shadow-sm shadow-slate-900/20 transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
              style={{
                transform: `translateX(${activeIndicator.left}px)`,
                width: `${activeIndicator.width}px`,
              }}
            />
          ) : null}
          {CLIENT_MAIN_NAV.map((route) => {
            const active = isActive(route);
            return (
              <Link
                key={route.id}
                href={route.href}
                prefetch
                ref={(node) => {
                  desktopLinkRefs.current[route.id] = node;
                }}
                className={`${appTabPillClass} relative z-10 ${
                  active ? "text-white" : appTabPillInactiveClass
                }`}
              >
                {route.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
