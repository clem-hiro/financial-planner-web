import Link from "next/link";
import { isFinancialProfileIncomplete } from "@/data/financial-profile";
import { getDashboardPayload } from "@/data/dashboard";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { IncomeRetirementSectionActions } from "@/features/dashboard/IncomeRetirementSectionActions";
import { DashboardMonthSection } from "@/features/dashboard/DashboardMonthSection";
import { DashboardOverviewSection } from "@/features/dashboard/DashboardOverviewSection";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { DashboardSubnav } from "@/features/dashboard/DashboardSubnav";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { PageSection } from "@/ui/PageSection";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/95 p-6 text-sm leading-relaxed text-amber-950 shadow-sm sm:p-8">
        Set{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-amber-100 px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code className="rounded bg-amber-100 px-1">.env.local</code>, run
        migrations, then sign in.
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90">
            Secure access
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Sign in to review net worth, savings rate, and projections in one
            calm view.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex rounded-full bg-[#0c192f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const month = formatYearMonth(new Date());
  const [payload, profile] = await Promise.all([
    getDashboardPayload(supabase, user.id, month),
    getProfileById(supabase, user.id),
  ]);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const profileIncomplete = isFinancialProfileIncomplete(profile);

  return (
    <div className="space-y-10 sm:space-y-12">
      <header className="space-y-4 border-b border-slate-200/80 pb-8 sm:space-y-5 sm:pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90">
              Your position
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] sm:text-4xl">
              Dashboard
            </h1>
            <p className="text-base leading-relaxed text-slate-600 sm:text-[1.05rem]">
              A steady read on net worth, savings, and this month&apos;s
              activity — built for clarity, not noise.
            </p>
          </div>
          <p className="shrink-0 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-center font-mono text-xs font-medium tabular-nums text-slate-600 shadow-sm sm:text-sm">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Period
            </span>
            {month}
          </p>
        </div>
        <DashboardSubnav />
      </header>

      <section id="overview" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
        <h2 className="sr-only">Overview</h2>
        <DashboardOverviewSection payload={payload} currency={currency} />
      </section>

      <section id="profile" className="scroll-mt-28 sm:scroll-mt-32">
        <PageSection
          title="Financial profile"
          actions={<IncomeRetirementSectionActions />}
        >
          {profileIncomplete ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Complete your financial profile to improve savings rate and projection quality.
              <div className="mt-2">
                <Link href="/setup" className="underline">
                  Complete your financial profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Global assumptions are managed in Financial Profile.
              <div className="mt-2">
                <Link href="/setup" className="underline">
                  Edit financial profile
                </Link>
              </div>
            </div>
          )}
        </PageSection>
      </section>

      <section id="retirement" className="scroll-mt-28 sm:scroll-mt-32">
        <h2 className="sr-only">Projected wealth</h2>
        <DashboardRetirementSection payload={payload} profile={profile} />
      </section>

      <section id="month" className="scroll-mt-28 space-y-6 sm:scroll-mt-32">
        <h2 className="sr-only">This month</h2>
        <DashboardMonthSection payload={payload} />
      </section>
    </div>
  );
}
