"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { AppShellNav } from "@/features/app-shell/AppShellNav";
import { MethodologySheet } from "@/features/help/MethodologySheet";
import {
  MethodologyProvider,
  useMethodology,
} from "@/features/help/methodology-context";
import { signOutAction } from "@/server/actions";

const ghostBtn =
  "rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";

function MethodologyHeaderButton() {
  const { openMethodology } = useMethodology();
  return (
    <button
      type="button"
      onClick={() => openMethodology(null)}
      className="rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition hover:border-teal-300/60 hover:text-teal-900"
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
  return (
    <MethodologyProvider>
      <div className="flex min-h-full flex-col text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 shadow-sm shadow-slate-900/5 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3.5 sm:px-8">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <Link
                href="/dashboard"
                className="text-lg font-semibold tracking-tight text-slate-900 transition-opacity hover:opacity-80"
              >
                Finance Planner
              </Link>
              <span className="hidden text-[11px] font-medium uppercase tracking-wider text-slate-400 sm:inline">
                Clarity for your money
              </span>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <AppShellNav />
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
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
          {children}
        </main>
      </div>
      <MethodologySheet />
    </MethodologyProvider>
  );
}
