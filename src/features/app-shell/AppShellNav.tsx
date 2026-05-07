"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryRoutes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/budget", label: "Budget" },
] as const;

const secondaryRoutes = [
  { href: "/balances", label: "Balances" },
  { href: "/goals", label: "Goals" },
  { href: "/financial-profile", label: "Financial Profile" },
] as const;

const pill =
  "inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-full px-3.5 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:min-w-0 sm:py-1.5";

export function AppShellNav() {
  const pathname = usePathname();
  const hasActiveSecondary = secondaryRoutes.some(({ href }) =>
    pathname === href || pathname.startsWith(`${href}/`)
  );

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
      <details className="relative">
        <summary
          className={`${pill} list-none cursor-pointer ${
            hasActiveSecondary
              ? "bg-[#0c192f] text-white shadow-sm shadow-slate-900/20"
              : "text-slate-600 hover:bg-white hover:text-slate-900"
          }`}
        >
          More
        </summary>
        <div className="absolute right-0 top-12 z-40 min-w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10">
          {secondaryRoutes.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[#0c192f] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </details>
    </nav>
  );
}
