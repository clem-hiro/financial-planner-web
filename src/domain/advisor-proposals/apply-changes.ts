import type { SupabaseClient } from "@supabase/supabase-js";
import { updateBudgetLine } from "@/data/repositories/budget-lines";
import { updateFinancialGoal } from "@/data/repositories/goals";
import {
  deleteInvestment,
  insertInvestment,
  updateInvestment,
} from "@/data/repositories/investments";
import { updateProfile } from "@/data/repositories/profiles";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";

type ChangeGroup = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  changes: AdvisorProposalChangeRow[];
};

function groupChanges(changes: AdvisorProposalChangeRow[]): ChangeGroup[] {
  const map = new Map<string, ChangeGroup>();
  for (const c of changes) {
    const key = `${c.entity_type}:${c.entity_id ?? "profile"}`;
    let g = map.get(key);
    if (!g) {
      g = { entityType: c.entity_type, entityId: c.entity_id, changes: [] };
      map.set(key, g);
    }
    g.changes.push(c);
  }
  return [...map.values()];
}

function changeMap(changes: AdvisorProposalChangeRow[]): Map<string, string | null> {
  return new Map(changes.map((c) => [c.field_key, c.new_value]));
}

export async function applyAcceptedProposalChanges(
  supabase: SupabaseClient,
  clientUserId: string,
  changes: AdvisorProposalChangeRow[]
): Promise<void> {
  for (const group of groupChanges(changes)) {
    const m = changeMap(group.changes);

    if (group.entityType === "profile") {
      const patch: Parameters<typeof updateProfile>[2] = {};
      if (m.has("display_name")) patch.display_name = m.get("display_name");
      if (m.has("monthly_income")) patch.monthly_income = numOrNull(m.get("monthly_income"));
      if (m.has("monthly_gross_salary")) {
        patch.monthly_gross_salary = numOrNull(m.get("monthly_gross_salary"));
      }
      if (m.has("savings_target_monthly")) {
        patch.savings_target_monthly = numOrNull(m.get("savings_target_monthly"));
      }
      if (m.has("fixed_expenses_monthly")) {
        patch.fixed_expenses_monthly = numOrNull(m.get("fixed_expenses_monthly"));
      }
      if (m.has("target_retirement_age")) {
        const v = m.get("target_retirement_age");
        patch.target_retirement_age = v != null ? Number(v) : null;
      }
      if (m.has("retirement_monthly_spend_goal")) {
        patch.retirement_monthly_spend_goal = numOrNull(m.get("retirement_monthly_spend_goal"));
      }
      if (Object.keys(patch).length > 0) {
        await updateProfile(supabase, clientUserId, patch);
      }
      continue;
    }

    if (group.entityType === "budget_line" && group.entityId) {
      const amount = numOrNull(m.get("amount"));
      if (amount != null) {
        await updateBudgetLine(supabase, clientUserId, group.entityId, { amount });
      }
      continue;
    }

    if (group.entityType === "goal" && group.entityId) {
      const mc = numOrNull(m.get("monthly_contribution"));
      if (mc != null) {
        await updateFinancialGoal(supabase, clientUserId, group.entityId, {
          monthly_contribution: mc,
        });
      }
      continue;
    }

    if (group.entityType === "investment") {
      if (m.get("_deleted") === "true" && group.entityId) {
        await deleteInvestment(supabase, clientUserId, group.entityId);
        continue;
      }

      const isNewEntity = group.changes.every(
        (c) => c.old_value == null || c.old_value === ""
      );

      const payload = {
        name: m.get("name") ?? "Investment",
        current_value: numOrNull(m.get("current_value")) ?? 0,
        monthly_contribution: numOrNull(m.get("monthly_contribution")) ?? 0,
        expected_annual_return: numOrNull(m.get("expected_annual_return")) ?? 0,
        contribution_type: m.get("contribution_type") || null,
        contribution_duration_years: m.get("contribution_duration_years")
          ? Number(m.get("contribution_duration_years"))
          : null,
      };

      if (isNewEntity) {
        await insertInvestment(supabase, clientUserId, payload);
      } else if (group.entityId) {
        await updateInvestment(supabase, clientUserId, group.entityId, payload);
      }
    }
  }
}

function numOrNull(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
