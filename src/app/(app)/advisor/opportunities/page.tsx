import { AdvisorComingSoonPanel } from "@/features/advisor/advisor-workspace-primitives";

export default function AdvisorOpportunitiesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Opportunities</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Future home for product, insurance, CPF, and retirement gap workflows — structured for
          scale, not wired yet.
        </p>
      </div>
      <AdvisorComingSoonPanel
        title="Coming Soon"
        body="Opportunity Detection Coming: retirement gaps, emergency fund shortfalls, debt
          optimization, and CPF planning will surface here with advisor-safe scoring."
      />
    </div>
  );
}
