import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import type { ProfileRow } from "@/data/supabase/types";
import type { SetupEvaluationContext } from "@/domain/setup/context";
import { buildSetupHubSnapshot } from "@/domain/setup/evaluators";
import type { SetupHubSnapshot } from "@/domain/setup/types";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";

const HUB_TABS = new Set([
  "add-account",
  "cash-liabilities",
  "cpf",
  "housing-loans",
  "goals",
  "vehicles",
]);

/**
 * Loads all data needed for setup hub status in one round trip.
 * `subjectUserId` is the financial data owner (self or future advisor client view).
 */
export async function loadSetupEvaluationContext(
  supabase: SupabaseClient,
  subjectUserId: string,
  profile: ProfileRow | null
): Promise<SetupEvaluationContext> {
  const [bundle, budgetLines] = await Promise.all([
    loadSetupTabBundle(supabase, subjectUserId, HUB_TABS),
    listBudgetLines(supabase, subjectUserId),
  ]);

  return {
    profile,
    investments: bundle.investments,
    cashAccounts: bundle.cashAccounts,
    liabilities: bundle.liabilityRows,
    housingLoans: bundle.housingLoans,
    vehicles: bundle.vehicleRows,
    cpf: bundle.cpfRow,
    goals: bundle.goals,
    budgetLines,
  };
}

export async function getSetupHubSnapshot(
  supabase: SupabaseClient,
  subjectUserId: string,
  profile: ProfileRow | null
): Promise<SetupHubSnapshot> {
  const ctx = await loadSetupEvaluationContext(supabase, subjectUserId, profile);
  return buildSetupHubSnapshot(subjectUserId, ctx);
}
