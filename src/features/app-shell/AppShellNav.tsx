"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import {
  appShellMainNavRailClass,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
} from "@/ui/app-tab-styles";

type NavRoute = {
  href: string;
  label: string;
  activeMatch?: (pathname: string) => boolean;
};

function matchesFinancialSetup(pathname: string) {
  return (
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/financial-profile" ||
    pathname.startsWith("/financial-profile/")
  );
}

const clientRoutes: readonly NavRoute[] = [
  { href: "/dashboard", label: "Home" },
  {
    href: "/setup",
    label: "Financial setup",
    activeMatch: matchesFinancialSetup,
  },
  {
    href: "/planning/overview",
    label: "Planning",
    activeMatch: (pathname) =>
      pathname === "/planning" ||
      pathname.startsWith("/planning/") ||
      pathname === "/goals" ||
      pathname.startsWith("/goals/") ||
      pathname === "/balances" ||
      pathname.startsWith("/balances/") ||
      pathname === "/budget" ||
      pathname.startsWith("/budget/"),
  },
  {
    href: "/expenses",
    label: "Activity",
    activeMatch: (pathname) =>
      pathname === "/spending" ||
      pathname.startsWith("/spending/") ||
      pathname === "/expenses" ||
      pathname.startsWith("/expenses/"),
  },
  {
    href: "/more",
    label: "More",
    activeMatch: (pathname) =>
      pathname === "/more" ||
      pathname.startsWith("/more/") ||
      pathname === "/account-issue" ||
      pathname.startsWith("/account-issue/"),
  },
] as const;

const prefetchClientRoutes = [
  "/dashboard",
  "/setup",
  "/expenses",
  "/planning/overview",
  "/more",
] as const;

export function AppShellNav({
  workspace,
}: {
  workspace: "client" | "advisor";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    for (const href of prefetchClientRoutes) {
      router.prefetch(href);
    }
  }, [router]);

  useEffect(() => {
    if (!mobileOpen) return;
    const unlock = lockBodyScroll();
    return unlock;
  }, [mobileOpen]);

  if (workspace === "advisor") {
    return null;
  }

  const routes: readonly NavRoute[] = clientRoutes;

  const isActive = (route: NavRoute) =>
    route.activeMatch
      ? route.activeMatch(pathname)
      : pathname === route.href || pathname.startsWith(`${route.href}/`);

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
                    {routes.map((route) => {
                      const active = isActive(route);
                      return (
                        <li key={route.href}>
                          <Link
                            href={route.href}
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
        <div className={appShellMainNavRailClass}>
          {routes.map((route) => {
            const active = isActive(route);
            return (
              <Link
                key={route.href}
                href={route.href}
                className={`${appTabPillClass} ${
                  active ? appTabPillActiveClass : appTabPillInactiveClass
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
