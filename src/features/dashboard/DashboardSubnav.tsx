"use client";

const items = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Financial profile" },
  { id: "retirement", label: "Retirement" },
  { id: "month", label: "This month" },
] as const;

export function DashboardSubnav() {
  return (
    <nav aria-label="Dashboard sections" className="sm:mx-0">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        On this page
      </p>
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <ul className="inline-flex min-w-max snap-x gap-1 rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm sm:min-w-0 sm:max-w-full sm:flex-wrap">
          {items.map(({ id, label }) => (
            <li key={id} className="snap-start">
              <a
                href={`#${id}`}
                className="block min-h-10 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0c192f] sm:min-h-0 sm:py-2.5"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
