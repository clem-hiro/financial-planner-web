/**
 * Waterfall funding across goals in priority order (display_order).
 * Uses the same monthly surplus basis as the dashboard: take-home minus spend,
 * then allocate to each goal's planned contribution until surplus runs out.
 */

export type GoalFundingLine = {
  goalId: string;
  title: string;
  priorityRank: number;
  plannedMonthly: number;
  fundedMonthly: number;
  shortfallMonthly: number;
};

export type GoalPriorityTradeoffAnalysis = {
  takeHomeMonthly: number | null;
  monthlyExpensesTotal: number | null;
  /** Take-home minus expenses, before any goal contributions. */
  surplusBeforeGoals: number | null;
  totalPlannedMonthly: number;
  totalFundedByPriority: number;
  /** Surplus left after funding goals in priority order (0 if over-committed). */
  unallocatedSurplus: number;
  /** max(0, total planned − surplus before goals). */
  overCommitmentMonthly: number;
  lines: GoalFundingLine[];
};

export type GoalPriorityTradeoffInput = {
  goals: Array<{
    id: string;
    title: string;
    display_order: number;
    monthly_contribution: number;
  }>;
  takeHomeMonthly: number | null;
  monthlyExpensesTotal: number | null;
};

export function sortGoalsByPriority<T extends { display_order: number; id: string }>(
  goals: T[]
): T[] {
  return [...goals].sort(
    (a, b) =>
      a.display_order - b.display_order || a.id.localeCompare(b.id)
  );
}

export function analyzeGoalPriorityTradeoff(
  input: GoalPriorityTradeoffInput
): GoalPriorityTradeoffAnalysis {
  const sorted = sortGoalsByPriority(input.goals);
  const takeHomeMonthly = input.takeHomeMonthly;
  const monthlyExpensesTotal = input.monthlyExpensesTotal;
  const surplusBeforeGoals =
    takeHomeMonthly != null && monthlyExpensesTotal != null
      ? takeHomeMonthly - monthlyExpensesTotal
      : null;

  let remaining =
    surplusBeforeGoals != null ? Math.max(0, surplusBeforeGoals) : 0;
  const lines: GoalFundingLine[] = [];
  let totalPlannedMonthly = 0;
  let totalFundedByPriority = 0;

  sorted.forEach((g, index) => {
    const plannedMonthly = Math.max(0, g.monthly_contribution);
    totalPlannedMonthly += plannedMonthly;
    const fundedMonthly =
      surplusBeforeGoals != null
        ? Math.min(plannedMonthly, remaining)
        : 0;
    remaining = Math.max(0, remaining - fundedMonthly);
    totalFundedByPriority += fundedMonthly;
    lines.push({
      goalId: g.id,
      title: g.title,
      priorityRank: index + 1,
      plannedMonthly,
      fundedMonthly,
      shortfallMonthly: Math.max(0, plannedMonthly - fundedMonthly),
    });
  });

  const overCommitmentMonthly =
    surplusBeforeGoals != null
      ? Math.max(0, totalPlannedMonthly - surplusBeforeGoals)
      : 0;

  return {
    takeHomeMonthly,
    monthlyExpensesTotal,
    surplusBeforeGoals,
    totalPlannedMonthly,
    totalFundedByPriority,
    unallocatedSurplus: remaining,
    overCommitmentMonthly,
    lines,
  };
}
