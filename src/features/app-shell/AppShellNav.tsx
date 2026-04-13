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
  "inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 touch-manipulation sm:min-h-0 sm:py-1.5";

export function AppShellNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/50 p-1 shadow-inner shadow-slate-900/[0.04]"
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
                ? "bg-white text-slate-900 shadow-sm shadow-slate-900/10 ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
