import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "@/data/mappers";
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
  type LiabilityForPlanning,
} from "@/domain/finance/debt-repayment";
import { formatYearMonth } from "@/lib/dates";

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

/** Map DB row → planning domain (shared with UI and budget sync). */
export function liabilityRowToPlanning(row: LiabilityRow): LiabilityForPlanning {
  return {
    id: row.id,
    name: row.name,
    balance: num(row.balance),
    category: row.category ?? null,
    loanType: row.loan_type ?? null,
    interestRateAnnual:
      row.interest_rate_annual != null && String(row.interest_rate_annual).trim() !== ""
        ? num(row.interest_rate_annual)
        : null,
    remainingTenureMonths: row.remaining_tenure_months ?? null,
    monthlyRepayment:
      row.monthly_repayment != null && String(row.monthly_repayment).trim() !== ""
        ? num(row.monthly_repayment)
        : null,
    repaymentOverride: row.repayment_override === true,
    startDate: row.start_date ?? null,
    notes: row.notes ?? null,
  };
}
