import Link from "next/link";
import type { AdvisorClientListSort, AdvisorClientWorkspaceListRow } from "@/data/repositories/advisor-clients";
import { advisorClientRosterSignals } from "@/domain/finance/advisor-client-health";
import { AdvisorBadge, AdvisorComingSoonPanel } from "@/features/advisor/advisor-workspace-primitives";
import {
  ADVISOR_CLIENT_LIST_FILTER_PRESETS,
  type AdvisorClientListFilterPreset,
} from "@/lib/advisor-client-list-filters";

function buildListHref(opts: {
  page: number;
  q: string;
  sort: AdvisorClientListSort;
  filter: AdvisorClientListFilterPreset;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.sort !== "created_desc") p.set("sort", opts.sort);
  if (opts.filter !== "all") p.set("filter", opts.filter);
  if (opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/advisor/clients?${s}` : "/advisor/clients";
}

function onboardingShort(row: AdvisorClientWorkspaceListRow) {
  if (row.onboarding_completed_at) return "Onboarded";
  if (row.onboarding_required) return "Pending";
  return "—";
}

function consentBadge(row: AdvisorClientWorkspaceListRow): {
  tone: "positive" | "warning" | "neutral";
  label: string;
} {
  switch (row.consent_status) {
    case "active":
      return { tone: "positive", label: "Granted" };
    case "withdrawn":
      return { tone: "warning", label: "Withdrawn" };
    default:
      return { tone: "neutral", label: "Not Granted" };
  }
}

export function AdvisorClientsBoard({
  rows,
  totalCount,
  page,
  pageSize,
  q,
  sort,
  filter,
}: {
  rows: AdvisorClientWorkspaceListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  q: string;
  sort: AdvisorClientListSort;
  filter: AdvisorClientListFilterPreset;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const filterActive = filter !== "all";

  return (
    <div className="space-y-6">
      <form
        method="get"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="advisor-client-q" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              id="advisor-client-q"
              name="q"
              defaultValue={q}
              placeholder="Name contains…"
              className="mt-1.5 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 outline-none ring-slate-300/40 focus:ring-2"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="advisor-client-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick filter
            </label>
            <select
              id="advisor-client-filter"
              name="filter"
              defaultValue={filter}
              className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-slate-300/40 focus:ring-2 sm:w-auto"
            >
              {ADVISOR_CLIENT_LIST_FILTER_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="advisor-client-sort" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sort
            </label>
            <select
              id="advisor-client-sort"
              name="sort"
              defaultValue={sort}
              className="w-full min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none ring-slate-300/40 focus:ring-2 sm:w-auto"
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
        </div>
        {filterActive ? (
          <p className="text-xs text-slate-600">
            Showing clients matching{" "}
            <span className="font-semibold text-slate-800">
              {ADVISOR_CLIENT_LIST_FILTER_PRESETS.find((p) => p.id === filter)?.label}
            </span>
            . Filters apply across your linked book (up to 200 clients) before pagination.
          </p>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-sm leading-relaxed text-slate-700">
          {q.trim() || filterActive ? (
            <p className="font-medium text-slate-900">
              {filterActive && q.trim()
                ? "No clients match this search and filter."
                : filterActive
                  ? "No clients match this filter."
                  : "No clients match this search."}
            </p>
          ) : totalCount === 0 ? (
            <>
              <p className="font-semibold text-slate-900">
                No clients are linked to the advisor account you are signed in with.
              </p>
              <p className="mt-3">
                This list only includes profiles where{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-800">
                  financial_profiles.profile_type
                </code>{" "}
                is{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-800">client</code>{" "}
                and{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-800">
                  advisor_user_id
                </code>{" "}
                equals <strong>your</strong> Supabase user id (not your email). That id is set
                automatically when someone signs up as a client using an access key you created
                while logged in as <em>this same</em> advisor.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600">
                <li>
                  If the keys were created under a different login (or a different Supabase
                  project), those clients will not appear here.
                </li>
                <li>
                  Clients who registered before keys existed, or without a valid key, may have
                  empty <code className="rounded bg-white px-1 text-xs">advisor_user_id</code> and
                  will not show up.
                </li>
                <li>
                  In Supabase: Table Editor → <code className="rounded bg-white px-1 text-xs">financial_profiles</code>{" "}
                  on each client row — confirm <code className="rounded bg-white px-1 text-xs">advisor_user_id</code>{" "}
                  matches Auth → Users → id for the advisor you expect.
                </li>
              </ul>
            </>
          ) : (
            <p className="font-medium text-slate-900">No clients on this page.</p>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Client</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Consent</th>
                  <th scope="col" className="px-4 py-3">Savings</th>
                  <th scope="col" className="px-4 py-3">Budget</th>
                  <th scope="col" className="px-4 py-3">Last activity</th>
                  <th scope="col" className="px-4 py-3">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  if (!row.id) return null;
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
                  const consent = consentBadge(row);
                  const href = `/advisor/client/${row.id}`;
                  return (
                    <tr key={row.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle">
                        <Link
                          href={href}
                          className="font-semibold tracking-tight text-slate-900 hover:underline"
                        >
                          {row.display_name?.trim() || "Unnamed client"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <AdvisorBadge tone={sig.riskBand === "high" ? "risk" : "neutral"}>
                          {onboardingShort(row)}
                        </AdvisorBadge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <AdvisorBadge tone={consent.tone}>
                          {consent.label}
                        </AdvisorBadge>
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-700">
                        {sig.savingsHealthLabel}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-700">
                        {sig.budgetHealthLabel}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-700">
                        {row.last_expense_spent_at
                          ? new Date(row.last_expense_spent_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-700">
                        {sig.nextActionHint}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center">
            <p>
              Page {page} of {totalPages} · {totalCount} client{totalCount === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildListHref({ page: page - 1, q, sort, filter })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildListHref({ page: page + 1, q, sort, filter })}
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
        body="Bulk actions, named saved views, and CSV export are planned for large books. Quick filters and server-side pagination are live now."
      />
    </div>
  );
}
