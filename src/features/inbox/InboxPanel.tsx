"use client";

import Link from "next/link";
import type { InboxNotificationRow } from "@/data/supabase/types";
import {
  markAllInboxReadAction,
  markInboxItemReadAction,
} from "@/server/inbox-actions";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export function InboxPanel({
  items,
  onAfterAction,
}: {
  items: InboxNotificationRow[];
  /** Called after a successful mark-as-read so the parent can close the dropdown. */
  onAfterAction?: () => void;
}) {
  async function markOne(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    await markInboxItemReadAction(fd);
    onAfterAction?.();
  }

  async function markAll() {
    await markAllInboxReadAction();
    onAfterAction?.();
  }

  if (items.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-slate-500">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Notifications
        </span>
        <button
          type="button"
          onClick={markAll}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
        >
          Mark all read
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-xl border border-slate-200/90 bg-white p-3 text-sm shadow-sm"
          >
            <p className="font-semibold text-slate-900">{it.title}</p>
            {it.body ? (
              <p className="mt-1 text-slate-600">{it.body}</p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              {it.cta_href && it.cta_label ? (
                <Link
                  href={it.cta_href}
                  onClick={() => markOne(it.id)}
                  className={`text-xs ${appInlineLinkClass}`}
                >
                  {it.cta_label}
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => markOne(it.id)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Mark read
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
