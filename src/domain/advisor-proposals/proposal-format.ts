/** Compact date for proposal history tables; em-dash when absent. */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** One-line advisor-note preview for proposal tables; em-dash when empty. */
export function summarize(note: string | null): string {
  const t = note?.trim();
  if (!t) return "—";
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}
