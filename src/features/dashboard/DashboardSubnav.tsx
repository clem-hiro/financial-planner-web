"use client";

const items = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "retirement", label: "Retirement" },
  { id: "month", label: "This month" },
] as const;

export function DashboardSubnav() {
  return (
    <nav aria-label="Dashboard sections" className="mb-8 sm:mx-0">
      <ul className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-md shadow-slate-900/[0.06] ring-1 ring-slate-950/[0.03] backdrop-blur-md">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
