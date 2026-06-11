"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ContactAdvisorButton } from "@/features/app-shell/ContactAdvisorButton";
import { OpenMethodologyButton } from "@/features/help/OpenMethodologyButton";
import { signOutAction } from "@/server/actions";
import { ThemeModeToggle } from "@/ui/theme/ThemeModeToggle";

const panelClass =
  "absolute right-0 z-50 mt-2 w-[min(100vw-2rem,17rem)] rounded-2xl border border-slate-200/90 bg-white/98 p-2 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/98 dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.85)]";

const menuRowClass =
  "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900";

const contactMenuRowClass =
  "flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-200 dark:hover:bg-emerald-950/40";

export function AppShellUserMenu({
  user,
  displayName,
  inboxSlot,
  showContactAdvisor,
  showConsentPrompt = false,
}: {
  user: User;
  /** Profile display name; falls back to email when empty. */
  displayName?: string | null;
  inboxSlot: React.ReactNode;
  showContactAdvisor?: boolean;
  /** Amber cue when linked advisor lacks active consent (inbox also has the prompt). */
  showConsentPrompt?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const email = user.email ?? "Account";
  const label = displayName || email;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex max-w-56 min-h-10 items-center gap-2 rounded-full border bg-white px-3 py-2 text-left text-sm font-semibold text-[#0c192f] shadow-sm transition dark:bg-slate-950 dark:text-slate-50 sm:min-h-0 sm:py-1.5 ${
          showConsentPrompt
            ? "border-amber-300/90 hover:border-amber-400/90 dark:border-amber-500/70 dark:hover:border-amber-400"
            : "border-slate-200/90 hover:border-emerald-200/90 dark:border-slate-700/90 dark:hover:border-emerald-500/70"
        }`}
        aria-describedby={
          showConsentPrompt ? "account-consent-cue" : undefined
        }
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#0c192f] to-[#047857] text-xs font-bold text-white">
          {label.slice(0, 1).toUpperCase()}
          {showConsentPrompt ? (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </span>
        {showConsentPrompt ? (
          <span id="account-consent-cue" className="sr-only">
            Advisor consent pending — open notifications or More → Privacy &amp;
            Advisor Access
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-slate-400 dark:text-slate-500" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className={panelClass}
          role="menu"
          aria-label="Account menu"
        >
          {showContactAdvisor ? (
            <div className="px-0 py-0.5">
              <ContactAdvisorButton
                menuButtonClassName={contactMenuRowClass}
                onOpened={() => setOpen(false)}
              />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Theme
            </p>
            <ThemeModeToggle />
          </div>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          {showConsentPrompt ? (
            <div className="px-0 py-0.5">
              <Link
                href="/more#privacy-advisor-access"
                role="menuitem"
                onClick={() => setOpen(false)}
              className={`${menuRowClass} text-amber-950 hover:bg-amber-50 dark:text-amber-100 dark:hover:bg-amber-950/35`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">Advisor consent pending</span>
                  <span className="text-xs font-normal text-amber-800/90 dark:text-amber-200/90">
                    Review in Privacy &amp; Advisor Access
                  </span>
                </span>
              </Link>
            </div>
          ) : null}
          {inboxSlot ? <div className="px-0 py-0.5">{inboxSlot}</div> : null}
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <div className="px-0 py-0.5">
            <OpenMethodologyButton
              label="How it works"
              onBeforeOpen={() => setOpen(false)}
              className={`${menuRowClass} w-full justify-start text-left font-medium`}
            />
          </div>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <form action={signOutAction} className="px-0 pb-0.5">
            <button
              type="submit"
              role="menuitem"
              className={`${menuRowClass} w-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50`}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
