import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteBudgetLine,
  getBudgetLineBySourceLiabilityId,
  insertBudgetLine,
  updateBudgetLine,
} from "@/data/repositories/budget-lines";
import type { LiabilityRow } from "@/data/supabase/types";
import {
  debtBudgetCategoryName,
  debtRepaymentEndYearMonth,
  debtRepaymentStartYearMonth,
  effectiveMonthlyRepayment,
  liabilityRowToPlanning,
} from "@/domain/finance/debt-repayment";
import { formatYearMonth } from "@/lib/dates";

export { liabilityRowToPlanning } from "@/domain/finance/debt-repayment";

/**
 * Keeps a monthly budget line in sync with liability repayment (cash-flow view).
 * Removes the line when repayment is zero or missing.
 */
export async function syncLiabilityBudgetLine(
  supabase: SupabaseClient,
  userId: string,
  liability: LiabilityRow
): Promise<void> {
  const domain = liabilityRowToPlanning(liability);
  const repayment = effectiveMonthlyRepayment(domain);
  const referenceYm = formatYearMonth(new Date());
  const existing = await getBudgetLineBySourceLiabilityId(
    supabase,
    userId,
    liability.id
  );

  if (repayment <= 0) {
    if (existing) {
      await deleteBudgetLine(supabase, userId, existing.id);
    }
    return;
  }

  const category = debtBudgetCategoryName(domain.name);
  const startYm = debtRepaymentStartYearMonth(domain, referenceYm);
  const endYm = debtRepaymentEndYearMonth(domain, startYm);

  if (existing) {
    await updateBudgetLine(supabase, userId, existing.id, {
      category,
      amount: repayment,
      start_year_month: startYm,
      end_year_month: endYm,
    });
    return;
  }

  await insertBudgetLine(supabase, userId, {
    category,
    cadence: "monthly",
    amount: repayment,
    calendar_year: null,
    start_year_month: startYm,
    end_year_month: endYm,
    source_liability_id: liability.id,
  });
}

export async function removeLiabilityBudgetLines(
  supabase: SupabaseClient,
  userId: string,
  liabilityId: string
): Promise<void> {
  const existing = await getBudgetLineBySourceLiabilityId(
    supabase,
    userId,
    liabilityId
  );
  if (existing) {
    await deleteBudgetLine(supabase, userId, existing.id);
  }
}

