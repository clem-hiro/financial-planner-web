/**
 * Top-level client app navigation — single source of truth for labels, hrefs,
 * active-state rules, and prefetch targets. Keeps shell nav decoupled from
 * individual route implementations so sections can gain sidebars later.
 */

export type ClientMainNavItem = {
  /** Stable id for analytics / future sidebars */
  id: "home" | "financial_setup" | "planning" | "activity" | "more";
  href: string;
  label: string;
  activeMatch: (pathname: string) => boolean;
};

function matchesFinancialSetup(pathname: string) {
  return (
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/financial-profile" ||
    pathname.startsWith("/financial-profile/")
  );
}

function matchesPlanning(pathname: string) {
  return (
    pathname === "/planning" ||
    pathname.startsWith("/planning/") ||
    pathname === "/goals" ||
    pathname.startsWith("/goals/") ||
    pathname === "/balances" ||
    pathname.startsWith("/balances/") ||
    pathname === "/budget" ||
    pathname.startsWith("/budget/")
  );
}

function matchesActivity(pathname: string) {
  return (
    pathname === "/spending" ||
    pathname.startsWith("/spending/") ||
    pathname === "/expenses" ||
    pathname.startsWith("/expenses/")
  );
}

function matchesMore(pathname: string) {
  return (
    pathname === "/more" ||
    pathname.startsWith("/more/") ||
    pathname === "/account-issue" ||
    pathname.startsWith("/account-issue/")
  );
}

export const CLIENT_MAIN_NAV: readonly ClientMainNavItem[] = [
  {
    id: "home",
    href: "/dashboard",
    label: "Home",
    activeMatch: (pathname) =>
      pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
  },
  {
    id: "financial_setup",
    href: "/setup",
    label: "Financial setup",
    activeMatch: matchesFinancialSetup,
  },
  {
    id: "planning",
    href: "/planning/overview",
    label: "Planning",
    activeMatch: matchesPlanning,
  },
  {
    id: "activity",
    href: "/expenses",
    label: "Activity",
    activeMatch: matchesActivity,
  },
  {
    id: "more",
    href: "/more",
    label: "More",
    activeMatch: matchesMore,
  },
] as const;

/** Default prefetch for snappy shell transitions */
export const CLIENT_MAIN_NAV_PREFETCH_HREFS: readonly string[] = [
  "/dashboard",
  "/setup",
  "/planning/overview",
  "/expenses",
  "/more",
] as const;
