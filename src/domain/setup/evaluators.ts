import { num, profileMonthlyGross, profileMonthlyIncome } from "@/data/mappers";
import type { SetupEvaluationContext } from "@/domain/setup/context";
import {
  SETUP_MODULE_BY_ID,
  SETUP_MODULES,
  SETUP_RECOMMENDATION_PRIORITY,
} from "@/domain/setup/modules";
import type {
  SetupHubSnapshot,
  SetupModuleEvaluation,
  SetupModuleId,
  SetupModuleStatus,
  SetupProgressSummary,
  SetupRecommendedStep,
} from "@/domain/setup/types";

function statusPercent(status: SetupModuleStatus): number {
  if (status === "complete") return 100;
  if (status === "partial") return 50;
  return 0;
}

function maxIsoTimestamp(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

function nonEmptyString(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== "";
}

function liabilityIsComplete(row: SetupEvaluationContext["liabilities"][number]): boolean {
  const hasName = nonEmptyString(row.name);
  const hasBalance = num(row.balance) > 0;
  const hasRate = row.interest_rate_annual != null && num(row.interest_rate_annual) > 0;
  const hasRepayment =
    row.monthly_repayment != null && num(row.monthly_repayment) > 0;
  return hasName && hasBalance && (hasRate || hasRepayment);
}

function housingLoanIsComplete(row: SetupEvaluationContext["housingLoans"][number]): boolean {
  const hasLabel = nonEmptyString(row.label);
  const hasBalance = num(row.principal) > 0;
  const hasRate = num(row.annual_nominal_rate) > 0;
  const hasSchedule =
    row.term_months > 0 || nonEmptyString(row.first_payment_month);
  return hasLabel && hasBalance && (hasRate || hasSchedule);
}

function evaluateProfile(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const profile = ctx.profile;
  const hasName = nonEmptyString(profile?.display_name);
  const hasAge = nonEmptyString(profile?.birth_date);
  let status: SetupModuleStatus = "not_started";
  const missing: string[] = [];
  if (hasName && hasAge) status = "complete";
  else if (hasName || hasAge) {
    status = "partial";
    if (!hasName) missing.push("display name");
    if (!hasAge) missing.push("birth date");
  } else {
    missing.push("display name", "birth date");
  }
  return {
    moduleId: "profile",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: profile?.created_at ?? null,
    missingFields: missing,
  };
}

function evaluateIncomeExpenses(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const profile = ctx.profile;
  const income =
    profileMonthlyIncome(profile) ?? profileMonthlyGross(profile);
  const hasIncome = income != null && income > 0;
  const hasBudgetLines = ctx.budgetLines.length > 0;
  const hasFixed =
    profile?.fixed_expenses_monthly != null &&
    num(profile.fixed_expenses_monthly) > 0;
  const hasExpenses = hasBudgetLines || hasFixed;

  let status: SetupModuleStatus = "not_started";
  const missing: string[] = [];
  if (hasIncome && hasExpenses) status = "complete";
  else if (hasIncome || hasExpenses) {
    status = "partial";
    if (!hasIncome) missing.push("monthly income");
    if (!hasExpenses) missing.push("budget or fixed expenses");
  } else {
    missing.push("monthly income", "budget or fixed expenses");
  }

  const budgetUpdated = maxIsoTimestamp(
    ...ctx.budgetLines.map((b) => b.created_at)
  );

  return {
    moduleId: "income_expenses",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: budgetUpdated ?? profile?.created_at ?? null,
    missingFields: missing,
  };
}

function evaluateLoans(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const currentProperties = ctx.properties.filter(
    (p) => p.planning_scope === "current"
  );
  const trackedDebtCount =
    ctx.liabilities.length +
    ctx.housingLoans.length +
    currentProperties.length;
  if (trackedDebtCount === 0) {
    return {
      moduleId: "loans",
      status: "not_started",
      completionPercentage: 0,
      lastUpdatedAt: null,
      missingFields: ["at least one loan or liability"],
    };
  }
  const completeLiabilities = ctx.liabilities.filter(liabilityIsComplete);
  const completeHousing = ctx.housingLoans.filter(housingLoanIsComplete);
  const completeProperties = currentProperties.filter(
    (p) => p.name.trim().length > 0
  );
  const anyComplete =
    completeLiabilities.length > 0 ||
    completeHousing.length > 0 ||
    completeProperties.length > 0;
  const status: SetupModuleStatus = anyComplete ? "complete" : "partial";
  return {
    moduleId: "loans",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: maxIsoTimestamp(
      ...ctx.liabilities.map((l) => l.created_at),
      ...ctx.housingLoans.map((h) => h.created_at),
      ...currentProperties.map((p) => p.updated_at)
    ),
    missingFields: anyComplete
      ? []
      : ["loan name, balance, and interest or repayment"],
  };
}

function evaluateEmergencyFunds(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const withBalance = ctx.cashAccounts.filter((c) => num(c.balance) > 0);
  const hasAccounts = ctx.cashAccounts.length > 0;
  const hasSavingsTarget =
    ctx.profile?.savings_target_monthly != null &&
    num(ctx.profile.savings_target_monthly) > 0;

  let status: SetupModuleStatus = "not_started";
  const missing: string[] = [];
  if (withBalance.length > 0) status = "complete";
  else if (hasAccounts || hasSavingsTarget) {
    status = "partial";
    if (withBalance.length === 0) missing.push("cash account balance");
  } else {
    missing.push("cash account");
  }

  return {
    moduleId: "emergency_funds",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: maxIsoTimestamp(
      ...ctx.cashAccounts.map((c) => c.updated_at ?? c.created_at)
    ),
    missingFields: missing,
  };
}

/** Placeholder until insurance policies table ships — always not started. */
function evaluateInsurance(): SetupModuleEvaluation {
  return {
    moduleId: "insurance",
    status: "not_started",
    completionPercentage: 0,
    lastUpdatedAt: null,
    missingFields: ["insurance policy"],
  };
}

function evaluateDependents(): SetupModuleEvaluation {
  return {
    moduleId: "dependents",
    status: "not_started",
    completionPercentage: 0,
    lastUpdatedAt: null,
    missingFields: ["dependent record"],
  };
}

function evaluateEstate(): SetupModuleEvaluation {
  return {
    moduleId: "estate",
    status: "not_started",
    completionPercentage: 0,
    lastUpdatedAt: null,
    missingFields: ["estate checklist"],
  };
}

function evaluateInvestments(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const hasAny = ctx.investments.length > 0;
  const status: SetupModuleStatus = hasAny ? "complete" : "not_started";
  return {
    moduleId: "investments",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: maxIsoTimestamp(
      ...ctx.investments.map((i) => i.updated_at ?? i.created_at)
    ),
    missingFields: hasAny ? [] : ["investment account"],
  };
}

function evaluateRetirement(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const profile = ctx.profile;
  const hasTargetAge =
    profile?.target_retirement_age != null && profile.target_retirement_age > 0;
  const hasSpendGoal =
    profile?.retirement_monthly_spend_goal != null &&
    num(profile.retirement_monthly_spend_goal) > 0;

  let status: SetupModuleStatus = "not_started";
  const missing: string[] = [];
  if (hasSpendGoal) status = "complete";
  else if (hasTargetAge) {
    status = "partial";
    missing.push("retirement monthly spend goal");
  } else {
    missing.push("retirement target age", "retirement spend goal");
  }

  return {
    moduleId: "retirement",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: profile?.created_at ?? null,
    missingFields: missing,
  };
}

function evaluateCpf(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const cpf = ctx.cpf;
  if (!cpf) {
    return {
      moduleId: "cpf",
      status: "not_started",
      completionPercentage: 0,
      lastUpdatedAt: null,
      missingFields: ["CPF balances"],
    };
  }
  const total = num(cpf.oa) + num(cpf.sa) + num(cpf.ma);
  const status: SetupModuleStatus = total > 0 ? "complete" : "partial";
  return {
    moduleId: "cpf",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: cpf.updated_at,
    missingFields: total > 0 ? [] : ["OA, SA, or MA balance"],
  };
}

function evaluateGoals(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const hasAny = ctx.goals.length > 0;
  const status: SetupModuleStatus = hasAny ? "complete" : "not_started";
  return {
    moduleId: "goals",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: maxIsoTimestamp(...ctx.goals.map((g) => g.created_at)),
    missingFields: hasAny ? [] : ["financial goal"],
  };
}

function evaluateRiskProfile(ctx: SetupEvaluationContext): SetupModuleEvaluation {
  const profile = ctx.profile;
  const hasLifestyle = nonEmptyString(profile?.lifestyle_profile);
  const hasStrategy = nonEmptyString(profile?.budgeting_strategy);
  let status: SetupModuleStatus = "not_started";
  const missing: string[] = [];
  if (hasLifestyle && hasStrategy) status = "complete";
  else if (hasLifestyle || hasStrategy) {
    status = "partial";
    if (!hasLifestyle) missing.push("budget preferences");
    if (!hasStrategy) missing.push("budgeting strategy");
  } else {
    missing.push("budget preferences", "budgeting strategy");
  }
  return {
    moduleId: "risk_profile",
    status,
    completionPercentage: statusPercent(status),
    lastUpdatedAt: profile?.onboarding_completed_at ?? profile?.created_at ?? null,
    missingFields: missing,
  };
}

function evaluateDocuments(): SetupModuleEvaluation {
  return {
    moduleId: "documents",
    status: "not_started",
    completionPercentage: 0,
    lastUpdatedAt: null,
    missingFields: ["uploaded document"],
  };
}

// Partial: navigation-only modules (e.g. `advisor_proposal`) have no
// completion semantics — they are intentionally absent here so they never
// enter the snapshot / progress % / recommendations. FinancialSetupHub
// renders them unconditionally instead.
const EVALUATORS: Partial<
  Record<SetupModuleId, (ctx: SetupEvaluationContext) => SetupModuleEvaluation>
> = {
  profile: evaluateProfile,
  income_expenses: evaluateIncomeExpenses,
  loans: evaluateLoans,
  emergency_funds: evaluateEmergencyFunds,
  insurance: evaluateInsurance,
  dependents: evaluateDependents,
  estate: evaluateEstate,
  investments: evaluateInvestments,
  retirement: evaluateRetirement,
  cpf: evaluateCpf,
  goals: evaluateGoals,
  risk_profile: evaluateRiskProfile,
  documents: evaluateDocuments,
};

export function evaluateSetupModule(
  moduleId: SetupModuleId,
  ctx: SetupEvaluationContext
): SetupModuleEvaluation {
  const evaluate = EVALUATORS[moduleId];
  if (!evaluate) {
    throw new Error(`No setup evaluator for module: ${moduleId}`);
  }
  return evaluate(ctx);
}

export function evaluateAllSetupModules(
  ctx: SetupEvaluationContext
): SetupModuleEvaluation[] {
  return SETUP_MODULES.flatMap((m) =>
    EVALUATORS[m.id] ? [evaluateSetupModule(m.id, ctx)] : []
  );
}

export function summarizeSetupProgress(
  modules: SetupModuleEvaluation[]
): SetupProgressSummary {
  const totalCount = modules.length;
  const completedCount = modules.filter((m) => m.status === "complete").length;
  const remainingCount = totalCount - completedCount;
  const completionPercent =
    totalCount === 0
      ? 0
      : Math.round(
          modules.reduce((sum, m) => sum + m.completionPercentage, 0) /
            totalCount
        );
  return {
    completionPercent,
    completedCount,
    remainingCount,
    totalCount,
  };
}

export function pickRecommendedSetupStep(
  modules: SetupModuleEvaluation[]
): SetupRecommendedStep | null {
  const byId = Object.fromEntries(modules.map((m) => [m.moduleId, m])) as Record<
    SetupModuleId,
    SetupModuleEvaluation
  >;

  for (const moduleId of SETUP_RECOMMENDATION_PRIORITY) {
    const evaluation = byId[moduleId];
    if (!evaluation || evaluation.status === "complete") continue;
    const def = SETUP_MODULE_BY_ID[moduleId];
    return {
      moduleId,
      title: def.title,
      reason: def.recommendReason,
      href: def.href,
      ctaLabel: def.ctaLabel,
    };
  }
  return null;
}

export function buildSetupHubSnapshot(
  subjectUserId: string,
  ctx: SetupEvaluationContext,
  evaluatedAt: string = new Date().toISOString()
): SetupHubSnapshot {
  const modules = evaluateAllSetupModules(ctx);
  const progress = summarizeSetupProgress(modules);
  const recommended = pickRecommendedSetupStep(modules);
  return {
    subjectUserId,
    evaluatedAt,
    progress,
    modules,
    recommended,
  };
}
