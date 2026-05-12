"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdvisorNavItem = {
  href: string;
  label: string;
  activeMatch?: (pathname: string) => boolean;
};

const advisorNavItems: readonly AdvisorNavItem[] = [
  {
    href: "/advisor",
    label: "Workspace",
    activeMatch: (pathname) => pathname === "/advisor",
  },
  {
    href: "/advisor/clients",
    label: "Clients",
    activeMatch: (pathname) =>
      pathname === "/advisor/clients" ||
      pathname.startsWith("/advisor/clients/") ||
      pathname.startsWith("/advisor/client/"),
  },
  {
    href: "/advisor/opportunities",
    label: "Opportunities",
    activeMatch: (pathname) => pathname.startsWith("/advisor/opportunities"),
  },
  {
    href: "/advisor/activity",
    label: "Activity",
    activeMatch: (pathname) => pathname.startsWith("/advisor/activity"),
  },
  {
    href: "/advisor/access-keys",
    label: "Access keys",
    activeMatch: (pathname) =>
      pathname === "/advisor/access-keys" ||
      pathname.startsWith("/advisor/access-keys/"),
  },
];

export function AdvisorWorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Financial Advisor
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
        Workspace
      </h2>
      <nav className="mt-5 space-y-1.5" aria-label="Advisor navigation">
        {advisorNavItems.map((item) => {
          const active = item.activeMatch
            ? item.activeMatch(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Coming Soon
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Teams, assistants, segmentation, AI briefs, and billing — architecture stays
          advisor-scoped until those modules ship.
        </p>
      </div>
    </aside>
  );
}
