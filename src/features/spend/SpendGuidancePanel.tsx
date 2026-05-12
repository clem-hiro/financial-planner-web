/**
 * Rule-based “spend less” guidance for the selected month — compact insight cards.
 */
export function SpendGuidancePanel({
  month,
  lines,
}: {
  month: string;
  lines: string[];
}) {
  if (lines.length === 0) return null;

  return (
    <div className="rounded-2xl border border-teal-200/50 bg-linear-to-br from-teal-50/90 via-white to-cyan-50/40 p-5 text-teal-950 shadow-md shadow-teal-900/4 ring-1 ring-teal-100/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Guidance for {month}
        </h2>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-100">
          Highlights
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-teal-900/70">
        Short reads based on this month&apos;s expenses, your budget lines, and
        take-home when set.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {lines.map((line, i) => (
          <li
            key={i}
            className="rounded-xl border border-teal-100/60 bg-white/85 p-3 shadow-sm"
          >
            <p className="text-sm leading-snug text-teal-950">{line}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
