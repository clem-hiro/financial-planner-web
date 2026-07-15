"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ProfileRow } from "@/data/supabase/types";
import { AdvisorPhonePromptBanner } from "@/features/app-shell/AdvisorPhonePromptBanner";
import {
  AppShellDesktopNav,
  AppShellMobileNav,
} from "@/features/app-shell/AppShellNav";
import { AppShellUserMenu } from "@/features/app-shell/AppShellUserMenu";
import { MethodologySheet } from "@/features/help/MethodologySheet";
import { MethodologyProvider } from "@/features/help/methodology-context";
import { ScrollToTopButton } from "@/ui/ScrollToTopButton";

export function AppShell({
  user,
  profile,
  workspace,
  inboxSlot,
  clientConsentNeeded = false,
  children,
}: {
  user: User | null;
  profile: ProfileRow | null;
  /** Which product surface the signed-in user should see in the shell. */
  workspace: "client" | "advisor";
  /** Inbox bell loaded in Suspense so page content can stream first. */
  inboxSlot: React.ReactNode;
  /** Linked client whose latest consent event is not active (account menu cue). */
  clientConsentNeeded?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showMainAppNav =
    Boolean(user) &&
    workspace === "client" &&
    !pathname.startsWith("/onboarding");
  const brandHref = workspace === "advisor" ? "/advisor" : "/dashboard";

  useEffect(() => {
    // Defensive reset for stale dev/HMR body lock state.
    document.body.removeAttribute("data-body-scroll-lock-count");
    document.body.removeAttribute("data-body-scroll-lock-prev-overflow");
    if (document.body.style.overflow === "hidden") {
      document.body.style.overflow = "";
    }
  }, []);

  return (
    <MethodologyProvider>
      <div
        className="flex min-h-full flex-col bg-background text-slate-800 dark:text-slate-100"
      >
        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-xl backdrop-saturate-150 ${
            workspace === "advisor"
              ? "border-slate-200 bg-background/95 dark:border-slate-800 dark:bg-background/90"
              : "border-slate-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(4,120,87,0.08)] dark:border-slate-700/70 dark:bg-background/92 dark:shadow-[0_1px_0_0_rgba(45,212,191,0.12)]"
          }`}
        >
          <div
            className={`mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:min-h-0 sm:gap-4 sm:px-8 sm:py-5 ${
              user && showMainAppNav ? "justify-between sm:justify-start" : "justify-between"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
              {showMainAppNav ? (
                <div className="shrink-0 sm:hidden">
                  <AppShellMobileNav />
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                <Link
                  href={brandHref}
                  className="truncate text-base font-semibold tracking-tight text-[#0c192f] transition-opacity hover:opacity-80 dark:text-slate-50 sm:text-xl"
                >
                  BYOFA
                </Link>
                <span className="hidden max-w-40 text-[11px] font-medium leading-snug tracking-wide text-slate-400 dark:text-slate-500 sm:inline md:max-w-xs">
                  {workspace === "advisor"
                    ? "Advisor workspace"
                    : "Wealth planner"}
                </span>
              </div>
            </div>
            {showMainAppNav ? (
              <div className="hidden min-h-0 min-w-0 flex-1 items-center justify-start overflow-x-auto sm:flex sm:pl-2 lg:pl-4">
                <AppShellDesktopNav />
              </div>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {workspace === "advisor" ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Operations
                </span>
              ) : null}
              {user ? (
                <AppShellUserMenu
                  user={user}
                  displayName={profile?.display_name?.trim() || null}
                  inboxSlot={inboxSlot}
                  showContactAdvisor={showMainAppNav && workspace === "client"}
                  showConsentPrompt={
                    showMainAppNav &&
                    workspace === "client" &&
                    clientConsentNeeded
                  }
                />
              ) : (
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45] dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 sm:min-h-0 sm:py-2"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
          {user && workspace === "advisor" ? (
            <AdvisorPhonePromptBanner user={user} />
          ) : null}
        </header>
        <main
          className={`mx-auto w-full flex-1 px-4 py-4 sm:px-8 sm:py-6 lg:py-8 ${
            workspace === "advisor" ? "max-w-7xl" : "max-w-6xl"
          }`}
        >
          {children}
        </main>
        <ScrollToTopButton />
      </div>
      <MethodologySheet />
    </MethodologyProvider>
  );
}
