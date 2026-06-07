import {
  analyzeGoalDeadlineGap,
  requiredMonthlyForMonths,
  targetDateYmdForContributionPeriods,
  type GoalDeadlineAnalysis,
} from "./goal-deadline";
import { estimateTimeToGoalStandalone } from "./goal-standalone";
import { calculateTimeToGoal } from "./projection";

const MONEY_EPS = 0.005;

function roundMoneyUp(x: number): number {
  return Math.ceil(x * 100) / 100;
}

export type GoalFeasibilityStatus =
  | "no_cash_context"
  | "on_track"
  | "met"
  | "raise_contribution"
  | "cash_constrained"
  | "not_achievable_on_date"
  | "no_deadline_affordable_slower"
  | "past_deadline"
  | "no_contribution_periods"
  | "cannot_catch_up";

export type GoalFeasibilityAnalysis = {
  status: GoalFeasibilityStatus;
  deadline: GoalDeadlineAnalysis;
  plannedMonthly: number;
  affordableMonthly: number | null;
  requiredMonthly: number | null;
  /** `max(0, required − affordable)` when both are known. */
  spendCutMonthly: number | null;
  /** Latest target date with EOM semantics for `etaMonthsAtAffordable` periods. */
  suggestedDateYmd: string | null;
  /** Extra EOM periods vs current target date (when `short`). */
  extraPeriodsVsDeadline: number | null;
  etaMonthsAtAffordable: number | null;
  etaMonthsAtPlanned: number | null;
};

export type GoalFeasibilityParams = {
  today: Date;
  targetDateYmd: string | null;
  currentAmount: number;
  targetAmount: number;
  plannedMonthly: number;
  expectedAnnualReturn: number;
  /** Funded amount after priority waterfall; null when income/spend unknown. */
  affordableMonthly: number | null;
};

function etaMonths(
  currentAmount: number,
  monthly: number,
  ret: number,
  targetAmount: number
): number | null {
  const est = estimateTimeToGoalStandalone(
    currentAmount,
    monthly,
    ret,
    targetAmount
  );
  if (est.kind === "months") return est.months;
  return null;
}

function requiredForDeadline(
  deadline: GoalDeadlineAnalysis,
  currentAmount: number,
  targetAmount: number,
  ret: number
): number | null {
  if (deadline.kind === "short") return deadline.requiredMonthly;
  if (deadline.kind === "on_track") {
    const raw = requiredMonthlyForMonths(
      currentAmount,
      targetAmount,
      ret,
      deadline.monthsRemaining
    );
    if (raw === null) return null;
    return roundMoneyUp(raw);
  }
  if (deadline.kind === "met") return 0;
  return null;
}

export function analyzeGoalFeasibility(
  params: GoalFeasibilityParams
): GoalFeasibilityAnalysis {
  const {
    today,
    targetDateYmd,
    currentAmount,
    targetAmount,
    plannedMonthly,
    expectedAnnualReturn,
    affordableMonthly,
  } = params;

  const planned = Number.isFinite(plannedMonthly)
    ? Math.max(0, plannedMonthly)
    : 0;
  const affordable =
    affordableMonthly != null && Number.isFinite(affordableMonthly)
      ? Math.max(0, affordableMonthly)
      : null;
  const ret = Number.isFinite(expectedAnnualReturn)
    ? Math.max(0, expectedAnnualReturn)
    : 0;

  const deadline = analyzeGoalDeadlineGap({
    today,
    targetDateYmd,
    currentAmount,
    monthlyContribution: planned,
    expectedAnnualReturn: ret,
    targetAmount,
  });

  const base = {
    deadline,
    plannedMonthly: planned,
    affordableMonthly: affordable,
    requiredMonthly: requiredForDeadline(
      deadline,
      currentAmount,
      targetAmount,
      ret
    ),
    spendCutMonthly: null as number | null,
    suggestedDateYmd: null as string | null,
    extraPeriodsVsDeadline: null as number | null,
    etaMonthsAtAffordable:
      affordable != null
        ? etaMonths(currentAmount, affordable, ret, targetAmount)
        : null,
    etaMonthsAtPlanned: etaMonths(currentAmount, planned, ret, targetAmount),
  };

  if (deadline.kind === "past_deadline") {
    return { ...base, status: "past_deadline" };
  }
  if (deadline.kind === "no_contribution_periods") {
    return { ...base, status: "no_contribution_periods" };
  }
  if (deadline.kind === "cannot_catch_up") {
    return { ...base, status: "cannot_catch_up" };
  }
  if (deadline.kind === "met") {
    return { ...base, status: "met", requiredMonthly: 0 };
  }

  if (affordable === null) {
    if (deadline.kind === "short") {
      return { ...base, status: "raise_contribution" };
    }
    return { ...base, status: "no_cash_context" };
  }

  if (deadline.kind === "no_deadline") {
    const etaA = base.etaMonthsAtAffordable;
    const etaP = base.etaMonthsAtPlanned;
    if (
      etaA != null &&
      etaP != null &&
      affordable + MONEY_EPS < planned &&
      etaA > etaP
    ) {
      return { ...base, status: "no_deadline_affordable_slower" };
    }
    return { ...base, status: "on_track" };
  }

  const required = base.requiredMonthly ?? 0;

  if (deadline.kind === "on_track") {
    if (affordable + MONEY_EPS < planned) {
      return { ...base, status: "cash_constrained" };
    }
    return { ...base, status: "on_track" };
  }

  if (deadline.kind === "short") {
    if (affordable + MONEY_EPS >= required) {
      return { ...base, status: "raise_contribution" };
    }

    const spendCutMonthly = roundMoneyUp(Math.max(0, required - affordable));
    const ttm = calculateTimeToGoal({
      currentValue: currentAmount,
      monthlyContribution: affordable,
      annualReturn: ret,
      targetAmount,
    });
    const etaMonthsAtAffordable = ttm?.months ?? null;
    const suggestedDateYmd =
      etaMonthsAtAffordable != null && etaMonthsAtAffordable > 0
        ? targetDateYmdForContributionPeriods(today, etaMonthsAtAffordable)
        : null;
    const extraPeriodsVsDeadline =
      etaMonthsAtAffordable != null
        ? Math.max(0, etaMonthsAtAffordable - deadline.monthsRemaining)
        : null;

    return {
      ...base,
      status: "not_achievable_on_date",
      spendCutMonthly,
      suggestedDateYmd,
      extraPeriodsVsDeadline,
      etaMonthsAtAffordable,
    };
  }

  return { ...base, status: "no_cash_context" };
}
