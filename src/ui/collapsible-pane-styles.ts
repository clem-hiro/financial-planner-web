/**
 * Sticky rail height cap as an inline style. Tailwind v4 + Turbopack
 * intermittently JIT-drops arbitrary `max-h-[calc(...)]` utilities
 * (same failure class as app-tab-styles.ts / LEARNINGS.md). If the cap
 * is dropped the rail grows unbounded and the last pane escapes below
 * the viewport with no way to scroll back to it. An inline style ships
 * in the JS bundle and cannot be JIT-dropped.
 *
 * `7rem` is the single source synced to the rail's `lg:top-24` sticky
 * offset: 6rem (top-24) + 1rem bottom breathing room. If the sticky
 * offset changes, change it here too.
 */
export const railStickyMaxHeightStyle = {
  maxHeight: "calc(100vh - 7rem)",
} as const;
