import { AdvisorComingSoonPanel } from "@/features/advisor/advisor-workspace-primitives";

export default function AdvisorActivityPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Activity</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Cross-client timeline for reviews, follow-ups, and workspace events.
        </p>
      </div>
      <AdvisorComingSoonPanel
        title="Work in Progress"
        body="Activity feed, advisor notes, and meeting prep will aggregate here. For now use each
          client workspace for deep context."
      />
    </div>
  );
}
