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
  {
    href: "/advisor/buy-keys",
    label: "Buy keys",
    activeMatch: (pathname) =>
      pathname === "/advisor/buy-keys" ||
      pathname.startsWith("/advisor/buy-keys/"),
  },
];

export function AdvisorWorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
      <nav
        className="flex gap-1 overflow-x-auto"
        aria-label="Advisor navigation"
      >
        {advisorNavItems.map((item) => {
          const active = item.activeMatch
            ? item.activeMatch(pathname)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#0c192f] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
