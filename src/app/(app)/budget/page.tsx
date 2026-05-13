import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";
import { planningCashFlowBudgetPath } from "@/lib/setup-urls";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";

type PageProps = {
  searchParams: Promise<{ month?: string; year?: string }>;
};

export default async function BudgetPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase and run migrations (including financial_budget_lines) to use
        budgets.
      </p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>
          Sign in
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const month =
    sp.month && parseYearMonth(sp.month) ? sp.month : formatYearMonth(new Date());
  const yearParsed = sp.year != null ? Number(sp.year) : NaN;
  const monthDerivedYear = yearFromYearMonth(month);
  const calendarYear =
    Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
      ? yearParsed
      : monthDerivedYear;

  redirect(
    planningCashFlowBudgetPath(month, calendarYear)
  );
}
