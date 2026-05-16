"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { ContactAdvisorButton } from "@/features/app-shell/ContactAdvisorButton";
import { OpenMethodologyButton } from "@/features/help/OpenMethodologyButton";
import { signOutAction } from "@/server/actions";

const panelClass =
  "absolute right-0 z-50 mt-2 w-[min(100vw-2rem,15.5rem)] rounded-2xl border border-slate-200/90 bg-white/98 p-2 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl";

const menuRowClass =
  "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50";

const contactMenuRowClass =
  "flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50 disabled:opacity-60";

export function AppShellUserMenu({
  user,
  inboxSlot,
  showContactAdvisor,
}: {
  user: User;
  inboxSlot: React.ReactNode;
  showContactAdvisor?: boolean;
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

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-56 min-h-10 items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-2 text-left text-sm font-semibold text-[#0c192f] shadow-sm transition hover:border-emerald-200/90 sm:min-h-0 sm:py-1.5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#0c192f] to-[#047857] text-xs font-bold text-white">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate">{email}</span>
        <span className="text-slate-400" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className={panelClass}
          role="menu"
          aria-label="Account menu"
        >
          <Link
            role="menuitem"
            href="/more"
            className={menuRowClass}
            onClick={() => setOpen(false)}
          >
            More
          </Link>
          {showContactAdvisor || inboxSlot ? (
            <div className="my-1 border-t border-slate-100" />
          ) : null}
          {showContactAdvisor ? (
            <div className="px-0 py-0.5">
              <ContactAdvisorButton
                menuButtonClassName={contactMenuRowClass}
                onOpened={() => setOpen(false)}
              />
            </div>
          ) : null}
          {inboxSlot ? <div className="px-0 py-0.5">{inboxSlot}</div> : null}
          <div className="my-1 border-t border-slate-100" />
          <div className="px-0 py-0.5">
            <OpenMethodologyButton
              label="How it works"
              onBeforeOpen={() => setOpen(false)}
              className={`${menuRowClass} w-full justify-start text-left font-medium`}
            />
          </div>
          <div className="my-1 border-t border-slate-100" />
          <form action={signOutAction} className="px-0 pb-0.5">
            <button
              type="submit"
              role="menuitem"
              className={`${menuRowClass} w-full text-slate-500 hover:text-slate-900`}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
