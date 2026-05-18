import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listBudgetLines,
  advisorReadBudgetLines,
} from "@/data/repositories/budget-lines";
import type { ProfileRow } from "@/data/supabase/types";
import type { SetupEvaluationContext } from "@/domain/setup/context";
import { buildSetupHubSnapshot } from "@/domain/setup/evaluators";
import type { SetupHubSnapshot } from "@/domain/setup/types";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";

const HUB_TABS = new Set([
  "add-account",
  "cash-liabilities",
  "cpf",
  "housing",
  "goals",
  "vehicles",
]);

/**
 * Loads all data needed for setup hub status in one round trip.
 * `subjectUserId` is the financial data owner (self or advisor client view).
 * P2-D1: `viewer:"advisor"` routes all reads through the consent-gated
 * `advisor_read_*` RPCs (subjectUserId = client id); absent ⇒ unchanged self
 * path. `profile` is supplied by the caller — not read here, so it is not
 * gated in this seam.
 */
export async function loadSetupEvaluationContext(
  supabase: SupabaseClient,
  subjectUserId: string,
  profile: ProfileRow | null,
  viewer?: "advisor"
): Promise<SetupEvaluationContext> {
  const [bundle, budgetLines] = await Promise.all([
    loadSetupTabBundle(supabase, subjectUserId, HUB_TABS, viewer),
    (viewer === "advisor" ? advisorReadBudgetLines : listBudgetLines)(
      supabase,
      subjectUserId
    ),
  ]);

  return {
    profile,
    investments: bundle.investments,
    cashAccounts: bundle.cashAccounts,
    liabilities: bundle.liabilityRows,
    properties: bundle.properties,
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
  profile: ProfileRow | null,
  viewer?: "advisor"
): Promise<SetupHubSnapshot> {
  const ctx = await loadSetupEvaluationContext(
    supabase,
    subjectUserId,
    profile,
    viewer
  );
  return buildSetupHubSnapshot(subjectUserId, ctx);
}
