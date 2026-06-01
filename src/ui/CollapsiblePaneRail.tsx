import type { ReactNode } from "react";
import { railStickyMaxHeightStyle } from "@/ui/collapsible-pane-styles";

/**
 * Reusable right-rail primitive. Server-renderable (no client JS): the
 * panes are native `<details>`, so collapse/expand needs zero hydration.
 *
 * Sticky on `lg+`; the inline `maxHeight` (JIT-drop-safe — see
 * collapsible-pane-styles.ts) plus `overflow-y-auto` make the rail a
 * viewport-bounded scroll region so the last open pane can always be
 * reached and never escapes below the fold. Below `lg` it degrades to a
 * non-sticky scrollable column (acceptable — content stays reachable).
 *
 * The rail is content-agnostic: callers compose whatever `CollapsiblePane`
 * set a surface needs (3 panes advisor / 2 panes client review). No
 * internal variant flags.
 */
export function CollapsiblePaneRail({ children }: { children: ReactNode }) {
  return (
    <aside
      style={railStickyMaxHeightStyle}
      className="space-y-4 overflow-y-auto overscroll-contain lg:sticky lg:top-24"
    >
      {children}
    </aside>
  );
}

/**
 * One collapsible pane. `title` (+ optional `eyebrow`) is a prop; body is
 * composed via `children`. `defaultOpen` sets the native `<details open>`
 * initial state — pure presentation, no variant logic.
 */
export function CollapsiblePane({
  title,
  eyebrow,
  defaultOpen = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-slate-200/90 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-slate-100 px-5 py-5">{children}</div>
    </details>
  );
}
