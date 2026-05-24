import type { ProposalEntityType, ProposalSectionId } from "@/domain/advisor-proposals/sections";

export type ProposalFieldMeta = {
  label: string;
  section: ProposalSectionId;
  /** When true, values are formatted as currency in review UI. */
  currency?: boolean;
  /** When true, values are shown as percentages (stored as decimal 0–1). */
  percent?: boolean;
};

const PROFILE_FIELDS: Record<string, ProposalFieldMeta> = {
  display_name: { label: "Display name", section: "profile_assumptions" },
  monthly_income: { label: "Monthly income (take-home)", section: "profile_assumptions", currency: true },
  monthly_gross_salary: { label: "Monthly gross salary", section: "profile_assumptions", currency: true },
  savings_target_monthly: { label: "Monthly savings target", section: "profile_assumptions", currency: true },
  fixed_expenses_monthly: { label: "Fixed expenses (monthly)", section: "profile_assumptions", currency: true },
  target_retirement_age: { label: "Retirement age", section: "retirement_planning" },
  retirement_monthly_spend_goal: {
    label: "Monthly retirement expenses",
    section: "retirement_planning",
    currency: true,
  },
  retirement_dividend_yield_annual: {
    label: "Retirement dividend yield",
    section: "retirement_planning",
    percent: true,
  },
  retirement_withdrawal_rate_annual: {
    label: "Retirement withdrawal rate",
    section: "retirement_planning",
    percent: true,
  },
  annual_salary_growth_nominal: {
    label: "Annual salary growth",
    section: "profile_assumptions",
    percent: true,
  },
};

const BUDGET_LINE_FIELDS: Record<string, ProposalFieldMeta> = {
  category: { label: "Category", section: "cash_flow" },
  amount: { label: "Planned amount", section: "cash_flow", currency: true },
};

const GOAL_FIELDS: Record<string, ProposalFieldMeta> = {
  title: { label: "Goal name", section: "goals" },
  target_amount: { label: "Target amount", section: "goals", currency: true },
  monthly_contribution: { label: "Monthly contribution", section: "goals", currency: true },
};

const INVESTMENT_FIELDS: Record<string, ProposalFieldMeta> = {
  name: { label: "Account name", section: "investments" },
  current_value: { label: "Current value", section: "investments", currency: true },
  monthly_contribution: { label: "Monthly contribution", section: "investments", currency: true },
  expected_annual_return: { label: "Expected annual return", section: "investments", percent: true },
  contribution_growth_annual: { label: "Contribution step-up", section: "investments", percent: true },
  contribution_type: { label: "Contribution schedule", section: "investments" },
  contribution_duration_years: { label: "Contribution duration (years)", section: "investments" },
  withdrawal_monthly: { label: "Monthly withdrawal", section: "investments", currency: true },
  withdrawal_start_years: { label: "Withdrawal starts after (years)", section: "investments" },
  _deleted: { label: "Account", section: "investments" },
};

const CASH_ACCOUNT_FIELDS: Record<string, ProposalFieldMeta> = {
  name: { label: "Account name", section: "cash_flow" },
  balance: { label: "Balance", section: "cash_flow", currency: true },
  purpose: { label: "Purpose", section: "cash_flow" },
  _deleted: { label: "Cash account", section: "cash_flow" },
};

const LIABILITY_FIELDS: Record<string, ProposalFieldMeta> = {
  name: { label: "Liability name", section: "cash_flow" },
  balance: { label: "Outstanding balance", section: "cash_flow", currency: true },
  category: { label: "Category", section: "cash_flow" },
  loan_type: { label: "Loan type", section: "cash_flow" },
  interest_rate_annual: { label: "Interest rate", section: "cash_flow", percent: true },
  remaining_tenure_months: { label: "Remaining tenure (months)", section: "cash_flow" },
  monthly_repayment: { label: "Monthly repayment", section: "cash_flow", currency: true },
  repayment_override: { label: "Manual repayment", section: "cash_flow" },
  start_date: { label: "Start date", section: "cash_flow" },
  notes: { label: "Notes", section: "cash_flow" },
  _deleted: { label: "Liability", section: "cash_flow" },
};

export function fieldMeta(
  entityType: ProposalEntityType,
  fieldKey: string
): ProposalFieldMeta {
  const map =
    entityType === "profile"
      ? PROFILE_FIELDS
      : entityType === "budget_line"
        ? BUDGET_LINE_FIELDS
        : entityType === "goal"
          ? GOAL_FIELDS
          : entityType === "cash_account"
            ? CASH_ACCOUNT_FIELDS
            : entityType === "liability"
              ? LIABILITY_FIELDS
              : INVESTMENT_FIELDS;
  return (
    map[fieldKey] ?? {
      label: fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      section:
        entityType === "profile"
          ? "profile_assumptions"
          : entityType === "budget_line"
            ? "cash_flow"
            : entityType === "goal"
              ? "goals"
              : entityType === "cash_account" || entityType === "liability"
                ? "cash_flow"
                : "investments",
    }
  );
}

export function serializeProposalValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function valuesEqual(a: string | null, b: string | null): boolean {
  const na = a === null || a === undefined || a === "" ? null : a;
  const nb = b === null || b === undefined || b === "" ? null : b;
  return na === nb;
}
