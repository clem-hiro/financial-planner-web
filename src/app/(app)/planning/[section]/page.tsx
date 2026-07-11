import { redirect, notFound } from "next/navigation";
import { isPlanningSectionId } from "@/lib/planning-sections";
import { SETUP_OVERVIEW_PATH, setupBudgetPath } from "@/lib/setup-urls";
import {
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";

type PageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
};

/**
 * Legacy Planning workspace routes — redirect into Financial setup so bookmarks
 * and classic aliases keep working without a second editor surface.
 */
export default async function PlanningSectionPage({
  params,
  searchParams,
}: PageProps) {
  const { section } = await params;
  if (!isPlanningSectionId(section)) notFound();

  if (section === "overview") redirect(SETUP_OVERVIEW_PATH);
  if (section === "wealth") redirect("/setup?tab=add-account");
  if (section === "protection") redirect("/setup?tab=protection");
  if (section === "future") redirect("/setup?tab=goals");

  // cash-flow → Setup budget (preserve month/year)
  const sp = await searchParams;
  const month =
    sp.month && parseYearMonth(sp.month) ? sp.month : formatYearMonth(new Date());
  const yearParsed = sp.year != null ? Number(sp.year) : NaN;
  const calendarYear =
    Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
      ? yearParsed
      : yearFromYearMonth(month);
  redirect(setupBudgetPath(month, calendarYear));
}
