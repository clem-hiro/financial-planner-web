"use client";

import { useEffect, useRef, useState } from "react";
import type { InboxNotificationRow } from "@/data/supabase/types";
import { InboxPanel } from "@/features/inbox/InboxPanel";

const panelClass =
  "absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200/90 bg-white/98 p-3 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl";

export function InboxBell({
  unreadCount,
  initialItems,
}: {
  unreadCount: number;
  initialItems: InboxNotificationRow[];
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

  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold tracking-wide text-slate-600 shadow-sm transition hover:border-emerald-200/90 hover:text-emerald-900 sm:min-h-0 sm:py-1.5"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span
            className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={panelClass} role="menu" aria-label="Inbox">
          <InboxPanel items={initialItems} onAfterAction={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
