import type {
  AdvisorClientConsentStatus,
  AdvisorClientWorkspaceListRow,
} from "@/data/repositories/advisor-clients";
import { advisorClientRosterSignals } from "@/domain/finance/advisor-client-health";

/** Quick roster filters advisors use repeatedly (URL `filter` param). */
export type AdvisorClientListFilterPreset =
  | "all"
  | "pending_onboarding"
  | "consent_missing"
  | "consent_withdrawn"
  | "needs_attention";

export const ADVISOR_CLIENT_LIST_FILTER_PRESETS: {
  id: AdvisorClientListFilterPreset;
  label: string;
}[] = [
  { id: "all", label: "All clients" },
  { id: "pending_onboarding", label: "Pending onboarding" },
  { id: "consent_missing", label: "Consent not granted" },
  { id: "consent_withdrawn", label: "Consent withdrawn" },
  { id: "needs_attention", label: "Needs attention" },
];

const PRESET_IDS = new Set(
  ADVISOR_CLIENT_LIST_FILTER_PRESETS.map((p) => p.id)
);

export function parseAdvisorClientListFilterPreset(
  raw: string | undefined
): AdvisorClientListFilterPreset {
  if (raw && PRESET_IDS.has(raw as AdvisorClientListFilterPreset)) {
    return raw as AdvisorClientListFilterPreset;
  }
  return "all";
}

export function rowMatchesAdvisorClientListFilter(
  row: AdvisorClientWorkspaceListRow,
  preset: AdvisorClientListFilterPreset
): boolean {
  if (preset === "all") return true;

  const consent = row.consent_status;
  const onboarded = Boolean(row.onboarding_completed_at);
  const pendingOnboarding =
    row.onboarding_required && !row.onboarding_completed_at;

  if (preset === "pending_onboarding") {
    return pendingOnboarding;
  }
  if (preset === "consent_missing") {
    return consent === "none";
  }
  if (preset === "consent_withdrawn") {
    return consent === "withdrawn";
  }
  if (preset === "needs_attention") {
    const sig = advisorClientRosterSignals({
      monthly_income: row.monthly_income,
      monthly_gross_salary: row.monthly_gross_salary,
      savings_target_monthly: row.savings_target_monthly,
      fixed_expenses_monthly: row.fixed_expenses_monthly,
      onboarding_completed_at: row.onboarding_completed_at,
      onboarding_required: row.onboarding_required,
      last_expense_spent_at: row.last_expense_spent_at,
      expense_count: row.expense_count,
    });
    return (
      pendingOnboarding ||
      consent !== "active" ||
      sig.riskBand === "high" ||
      sig.tags.includes("Needs Review")
    );
  }

  return true;
}

export function consentLabel(status: AdvisorClientConsentStatus): string {
  switch (status) {
    case "active":
      return "Granted";
    case "withdrawn":
      return "Withdrawn";
    default:
      return "Not Granted";
  }
}
