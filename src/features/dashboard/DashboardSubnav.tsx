"use client";

const items = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "retirement", label: "Retirement" },
  { id: "month", label: "This month" },
] as const;

export function DashboardSubnav() {
  return (
    <nav aria-label="Dashboard sections" className="sm:mx-0">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        On this page
      </p>
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block min-h-11 rounded-lg px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0c192f] sm:min-h-0 sm:py-2.5"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
