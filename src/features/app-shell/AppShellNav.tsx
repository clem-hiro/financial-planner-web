"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const routes = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/budget", label: "Budget" },
  { href: "/balances", label: "Balances" },
  { href: "/goals", label: "Goals" },
] as const;

const pill =
  "inline-flex min-h-11 min-w-[2.75rem] items-center justify-center rounded-full px-3.5 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:min-w-0 sm:py-1.5";

export function AppShellNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50/90 p-1 shadow-inner shadow-slate-900/[0.03]"
      aria-label="Main"
    >
      {routes.map(({ href, label }) => {
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
    </nav>
  );
}
