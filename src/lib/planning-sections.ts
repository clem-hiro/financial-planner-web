export const PLANNING_SECTIONS = [
  "overview",
  "cash-flow",
  "wealth",
  "protection",
  "future",
] as const;

export type PlanningSectionId = (typeof PLANNING_SECTIONS)[number];

export function isPlanningSectionId(
  value: string
): value is PlanningSectionId {
  return (PLANNING_SECTIONS as readonly string[]).includes(value);
}

export const PLANNING_SECTION_META: Record<
  PlanningSectionId,
  { label: string; description: string }
> = {
  overview: {
    label: "Overview",
    description: "Snapshot, net worth, health, and goal progress.",
  },
  "cash-flow": {
    label: "Cash Flow",
    description: "Income, budgets, subscriptions, and monthly surplus.",
  },
  wealth: {
    label: "Wealth",
    description: "Investments, CPF, property, vehicles, and liabilities.",
  },
  protection: {
    label: "Protection",
    description: "Insurance, emergency funding, dependents, and estate.",
  },
  future: {
    label: "Future",
    description: "Retirement, scenarios, projections, and long-term planning.",
  },
};
