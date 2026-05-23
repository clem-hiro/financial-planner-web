"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ProfileRow } from "@/data/supabase/types";
import { AdvisorPhonePromptBanner } from "@/features/app-shell/AdvisorPhonePromptBanner";
import { ClientConsentStrip } from "@/features/app-shell/ClientConsentStrip";
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
  /** Linked client whose latest consent event is not active (strip + account cue). */
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
        className={`flex min-h-full flex-col ${
          workspace === "advisor" ? "bg-slate-50 text-slate-800" : "text-slate-800"
        }`}
      >
        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-xl backdrop-saturate-150 ${
            workspace === "advisor"
              ? "border-slate-200 bg-slate-50/95"
              : "border-slate-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(4,120,87,0.08)]"
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
                className="truncate text-base font-semibold tracking-tight text-[#0c192f] transition-opacity hover:opacity-80 sm:text-xl"
              >
                BYOFA Planner
              </Link>
              <span className="hidden max-w-40 text-[11px] font-medium uppercase leading-snug tracking-[0.18em] text-slate-400 sm:inline md:max-w-xs">
                {workspace === "advisor"
                  ? "Advisor workspace"
                  : "Private wealth clarity"}
              </span>
              </div>
            </div>
            {showMainAppNav ? (
              <div className="hidden min-h-0 min-w-0 flex-1 justify-center overflow-x-auto sm:flex">
                <AppShellDesktopNav />
              </div>
            ) : null}
            <div className="flex shrink-0 items-center gap-2">
              {workspace === "advisor" ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45] sm:min-h-0 sm:py-2"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
          {user && workspace === "advisor" ? (
            <AdvisorPhonePromptBanner user={user} />
          ) : null}
          {user &&
          workspace === "client" &&
          clientConsentNeeded &&
          !pathname.startsWith("/onboarding") ? (
            <ClientConsentStrip />
          ) : null}
        </header>
        <main
          className={`mx-auto w-full flex-1 px-4 py-6 sm:px-8 sm:py-14 lg:py-16 ${
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
