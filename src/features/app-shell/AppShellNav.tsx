"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavRoute = {
  href: string;
  label: string;
  activeMatch?: (pathname: string) => boolean;
};

const primaryRoutes = [
  { href: "/dashboard", label: "Dashboard" },
] as const;

const secondaryRoutes: readonly NavRoute[] = [
  {
    href: "/spending",
    label: "Spending",
    activeMatch: (pathname) =>
      pathname === "/spending" ||
      pathname.startsWith("/spending/") ||
      pathname === "/expenses" ||
      pathname.startsWith("/expenses/") ||
      pathname === "/budget" ||
      pathname.startsWith("/budget/"),
  },
  {
    href: "/setup",
    label: "Setup",
    activeMatch: (pathname) =>
      pathname === "/setup" ||
      pathname.startsWith("/setup/") ||
      pathname === "/balances" ||
      pathname.startsWith("/balances/") ||
      pathname === "/financial-profile" ||
      pathname.startsWith("/financial-profile/"),
  },
  { href: "/goals", label: "Goals" },
] as const;

const pill =
  "inline-flex min-h-10 shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:px-3.5 sm:py-1.5";

export function AppShellNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? "hidden" : previousOverflow;
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const routes: readonly NavRoute[] = [...primaryRoutes, ...secondaryRoutes];
  const isActive = (route: NavRoute) =>
    route.activeMatch
      ? route.activeMatch(pathname)
      : pathname === route.href || pathname.startsWith(`${route.href}/`);

  return (
    <nav className="relative w-full sm:w-auto" aria-label="Main">
      <div className="sm:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-main-nav-menu"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
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
                                ? "bg-[#0c192f] text-white shadow-md shadow-slate-900/20"
                                : "text-[#0c192f] hover:bg-slate-100"
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
        <div className="flex min-w-max snap-x items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50/90 p-1 shadow-inner shadow-slate-900/3 sm:min-w-0 sm:flex-wrap">
          {routes.map((route) => {
            const active = isActive(route);
            return (
              <Link
                key={route.href}
                href={route.href}
                className={`${pill} ${
                  active
                    ? "bg-[#0c192f] text-white shadow-sm shadow-slate-900/20"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
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
