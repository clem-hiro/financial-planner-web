import Link from "next/link";
import type { AdvisorClientListSort, AdvisorClientWorkspaceListRow } from "@/data/repositories/advisor-clients";
import { advisorClientRosterSignals } from "@/domain/finance/advisor-client-health";
import { AdvisorBadge, AdvisorComingSoonPanel } from "@/features/advisor/advisor-workspace-primitives";

function buildListHref(opts: {
  page: number;
  q: string;
  sort: AdvisorClientListSort;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.sort !== "created_desc") p.set("sort", opts.sort);
  if (opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/advisor/clients?${s}` : "/advisor/clients";
}

function onboardingShort(row: AdvisorClientWorkspaceListRow) {
  if (row.onboarding_completed_at) return "Onboarded";
  if (row.onboarding_required) return "Pending";
  return "—";
}

export function AdvisorClientsBoard({
  rows,
  totalCount,
  page,
  pageSize,
  q,
  sort,
}: {
  rows: AdvisorClientWorkspaceListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  q: string;
  sort: AdvisorClientListSort;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4 sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="advisor-client-q" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </label>
          <input
            id="advisor-client-q"
            name="q"
            defaultValue={q}
            placeholder="Name contains…"
            className="mt-1 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300/40 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="advisor-client-sort" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort
          </label>
          <select
            id="advisor-client-sort"
            name="sort"
            defaultValue={sort}
            className="mt-1 w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-slate-300/40 focus:ring-2 sm:w-auto"
          >
            <option value="created_desc">Newest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="last_active_desc">Last activity</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Apply
          </button>
          <Link
            href="/advisor/clients"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No clients match this filter.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const sig = advisorClientRosterSignals({
                monthly_income: row.monthly_income,
                monthly_gross_salary: row.monthly_gross_salary,
                savings_target_monthly: row.savings_target_monthly,
                fixed_expenses_monthly: row.fixed_expenses_monthly,
                onboarding_completed_at: row.onboarding_completed_at,
                onboarding_required: row.onboarding_required,
                last_expense_spent_at: row.last_expense_spent_at,
                expense_count: row.expense_count,
              });
              return (
                <Link
                  key={row.id}
                  href={`/advisor/client/${row.id}`}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold tracking-tight text-slate-900 group-hover:underline">
                        {row.display_name?.trim() || "Unnamed client"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Last activity:{" "}
                        {row.last_expense_spent_at
                          ? new Date(row.last_expense_spent_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <AdvisorBadge tone={sig.riskBand === "high" ? "risk" : "neutral"}>
                      {onboardingShort(row)}
                    </AdvisorBadge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">
                        Savings
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{sig.savingsHealthLabel}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-slate-500">
                        Budget
                      </p>
                      <p className="mt-1 font-medium text-slate-800">{sig.budgetHealthLabel}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {sig.tags.slice(0, 3).map((t) => (
                      <AdvisorBadge key={t} tone="neutral">
                        {t}
                      </AdvisorBadge>
                    ))}
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
                    Next: <span className="text-slate-900">{sig.nextActionHint}</span>
                  </p>
                  <p className="mt-3 text-xs font-semibold text-slate-500 transition group-hover:text-slate-900">
                    Open workspace →
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center">
            <p>
              Page {page} of {totalPages} · {totalCount} client{totalCount === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildListHref({ page: page - 1, q, sort })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildListHref({ page: page + 1, q, sort })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}

      <AdvisorComingSoonPanel
        title="Work in Progress"
        body="Bulk actions, saved views, and CSV export are planned for large books. Server-side pagination is enabled now for scale."
      />
    </div>
  );
}
