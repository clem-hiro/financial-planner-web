"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useEffect } from "react";
import { AppShellNav } from "@/features/app-shell/AppShellNav";
import { MethodologySheet } from "@/features/help/MethodologySheet";
import {
  MethodologyProvider,
  useMethodology,
} from "@/features/help/methodology-context";
import { signOutAction } from "@/server/actions";
import { ScrollToTopButton } from "@/ui/ScrollToTopButton";

const ghostBtn =
  "inline-flex min-h-10 items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:min-h-0 sm:py-1.5";

function MethodologyHeaderButton() {
  const { openMethodology } = useMethodology();
  return (
    <button
      type="button"
      onClick={() => openMethodology(null)}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition hover:border-emerald-200/90 hover:text-emerald-900 sm:min-h-0 sm:py-1.5"
    >
      How it works
    </button>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
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
      <div className="flex min-h-full flex-col text-slate-800">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_0_0_rgba(4,120,87,0.08)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:gap-y-4 sm:px-8 sm:py-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <Link
                href="/dashboard"
                className="text-lg font-semibold tracking-tight text-[#0c192f] transition-opacity hover:opacity-80 sm:text-xl"
              >
                Finance Planner
              </Link>
              <span className="hidden max-w-xs text-[11px] font-medium uppercase leading-snug tracking-[0.18em] text-slate-400 sm:inline">
                Private wealth clarity
              </span>
            </div>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
              <AppShellNav />
              <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                <MethodologyHeaderButton />
                {user ? (
                <form action={signOutAction} className="inline">
                  <button type="submit" className={`${ghostBtn} text-slate-500`}>
                    Sign out
                  </button>
                </form>
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
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-8 sm:py-14 lg:py-16">
          {children}
        </main>
        <ScrollToTopButton />
      </div>
      <MethodologySheet />
    </MethodologyProvider>
  );
}
