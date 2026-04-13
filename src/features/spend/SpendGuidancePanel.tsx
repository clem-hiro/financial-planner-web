/**
 * Rule-based “spend less” guidance for the selected month (plain text lines).
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
    <div className="rounded-2xl border border-teal-200/40 bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/50 p-6 text-teal-950 shadow-lg shadow-teal-900/[0.06] ring-1 ring-teal-100/50">
      <h2 className="text-sm font-semibold tracking-tight text-teal-950">
        This month — spending guidance ({month})
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-teal-900/75">
        Based on logged expenses this month, monthly budget lines (monthly
        spend type), and your stated take-home when set.
      </p>
      <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-teal-950/90">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
