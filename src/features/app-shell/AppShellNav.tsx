"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  "inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-full px-3.5 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:min-w-0 sm:py-1.5";

export function AppShellNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50/90 p-1 shadow-inner shadow-slate-900/3"
      aria-label="Main"
    >
      {primaryRoutes.map(({ href, label }) => {
        const active =
          pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`${pill} ${
              active
                ? "bg-[#0c192f] text-white shadow-sm shadow-slate-900/20"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
      {secondaryRoutes.map(({ href, label, activeMatch }) => {
        const active = activeMatch
          ? activeMatch(pathname)
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`${pill} ${
              active
                ? "bg-[#0c192f] text-white shadow-sm shadow-slate-900/20"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
