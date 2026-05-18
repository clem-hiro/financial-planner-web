"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import {
  CLIENT_MAIN_NAV,
  CLIENT_MAIN_NAV_PREFETCH_HREFS,
} from "@/lib/client-main-nav";
import {
  appActiveGradientStyle,
  appShellMainNavRailClass,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
} from "@/ui/app-tab-styles";

function useMainNavActive() {
  const pathname = usePathname();
  return (route: (typeof CLIENT_MAIN_NAV)[number]) => route.activeMatch(pathname);
}

/** Mobile hamburger + full-screen nav drawer (client workspace only). */
export function AppShellMobileNav() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isActive = useMainNavActive();

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

  return (
    <>
      <button
        type="button"
        aria-expanded={mobileOpen}
        aria-controls="mobile-main-nav-menu"
        aria-label="Toggle navigation menu"
        onClick={() => setMobileOpen((v) => !v)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-linear-to-br from-white to-sky-50/80 text-sm font-semibold text-slate-700 shadow-sm transition hover:from-sky-50 hover:to-emerald-50/70"
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
                              ? "text-white shadow-md shadow-slate-900/20"
                              : "text-[#0c192f] hover:bg-sky-50"
                          }`}
                          style={active ? appActiveGradientStyle : undefined}
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
    </>
  );
}

/** Desktop main nav pill rail (client workspace only). */
export function AppShellDesktopNav() {
  const router = useRouter();
  const isActive = useMainNavActive();

  useEffect(() => {
    for (const href of CLIENT_MAIN_NAV_PREFETCH_HREFS) {
      router.prefetch(href);
    }
  }, [router]);

  return (
    <nav
      className="relative mx-auto w-max min-w-0"
      aria-label="Main"
    >
      <div className={appShellMainNavRailClass}>
        {CLIENT_MAIN_NAV.map((route) => {
          const active = isActive(route);
          return (
            <Link
              key={route.id}
              href={route.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={`${appTabPillClass} ${
                active ? appTabPillActiveClass : appTabPillInactiveClass
              }`}
              style={active ? appActiveGradientStyle : undefined}
            >
              {route.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShellNav({
  workspace,
}: {
  workspace: "client" | "advisor";
}) {
  if (workspace === "advisor") {
    return null;
  }

  return (
    <>
      <div className="sm:hidden">
        <AppShellMobileNav />
      </div>
      <div className="hidden sm:block">
        <AppShellDesktopNav />
      </div>
    </>
  );
}
