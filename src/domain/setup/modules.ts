import type { SetupModuleGroupId, SetupModuleId } from "@/domain/setup/types";

export type SetupModuleDefinition = {
  id: SetupModuleId;
  group: SetupModuleGroupId;
  title: string;
  description: string;
  icon: string;
  href: string;
  /** Lower = higher priority for “recommended next step” */
  priority: number;
  /** Optional copy when module is incomplete */
  recommendReason: string;
  ctaLabel: string;
};

export const SETUP_MODULE_GROUP_LABELS: Record<SetupModuleGroupId, string> = {
  core: "Core",
  protection: "Protection",
  future: "Future Planning",
  advisor_system: "Records & Readiness",
};

export const SETUP_MODULES: readonly SetupModuleDefinition[] = [
  {
    id: "profile",
    group: "core",
    title: "Personal Profile",
    description: "Identity, birth date, and planning assumptions that anchor every projection.",
    icon: "👤",
    href: "/setup?tab=profile",
    priority: 10,
    recommendReason:
      "Your age and display name unlock accurate CPF age banding and projections.",
    ctaLabel: "Open profile",
  },
  {
    id: "income_expenses",
    group: "core",
    title: "Income & Expenses",
    description: "Take-home income, budget lines, and monthly spend rhythm.",
    icon: "💵",
    href: "/setup?tab=budget",
    priority: 20,
    recommendReason:
      "Cash-flow and safe-to-spend stay approximate until income and expenses are set.",
    ctaLabel: "Review budget",
  },
  {
    id: "loans",
    group: "core",
    title: "Loans & Liabilities",
    description: "Debts, housing (properties and mortgages), and repayment assumptions.",
    icon: "🏦",
    href: "/setup?tab=cash-liabilities",
    priority: 40,
    recommendReason:
      "Debt balances and repayments shape net worth and monthly surplus projections.",
    ctaLabel: "Add liabilities",
  },
  {
    id: "emergency_funds",
    group: "core",
    title: "Emergency Funds",
    description: "Liquid cash buffers for three to six months of essential spend.",
    icon: "🛟",
    href: "/setup?tab=cash-liabilities",
    priority: 30,
    recommendReason:
      "Track cash accounts so resilience and safe-to-spend reflect real liquidity.",
    ctaLabel: "Add cash accounts",
  },
  {
    id: "insurance",
    group: "protection",
    title: "Insurance",
    description: "Policies and coverage gaps for protection analysis.",
    icon: "🛡️",
    href: "/planning/protection",
    priority: 50,
    recommendReason:
      "Your protection analysis may be inaccurate without insurance data.",
    ctaLabel: "View protection workspace",
  },
  {
    id: "dependents",
    group: "protection",
    title: "Dependents",
    description: "Family members, education timelines, and caregiver obligations.",
    icon: "👨‍👩‍👧",
    href: "/planning/protection",
    priority: 110,
    recommendReason:
      "Dependents affect coverage needs and long-term cash-flow planning.",
    ctaLabel: "View dependents roadmap",
  },
  {
    id: "estate",
    group: "protection",
    title: "Estate Planning",
    description: "Wills, LPAs, and liquidity for estate charges — structured, not legal advice.",
    icon: "📜",
    href: "/planning/protection",
    priority: 120,
    recommendReason:
      "Estate readiness helps advisors align liquidity and beneficiary intent.",
    ctaLabel: "View estate roadmap",
  },
  {
    id: "investments",
    group: "future",
    title: "Investments",
    description: "Portfolio balances, contributions, and return assumptions.",
    icon: "📈",
    href: "/setup?tab=add-account",
    priority: 60,
    recommendReason:
      "Investment balances power wealth projections and retirement runway charts.",
    ctaLabel: "Add investments",
  },
  {
    id: "retirement",
    group: "future",
    title: "Retirement",
    description: "Target age, spend goals, and withdrawal assumptions.",
    icon: "⏳",
    href: "/setup?tab=goals",
    priority: 70,
    recommendReason:
      "Retirement targets unlock long-horizon charts on Home and Future planning.",
    ctaLabel: "Set retirement goals",
  },
  {
    id: "cpf",
    group: "future",
    title: "CPF Planning",
    description: "OA, SA, MA balances and CPF LIFE projection inputs.",
    icon: "🇸🇬",
    href: "/setup?tab=cpf",
    priority: 80,
    recommendReason:
      "CPF balances feed Singapore retirement projections on your dashboard.",
    ctaLabel: "Update CPF",
  },
  {
    id: "goals",
    group: "future",
    title: "Goals & Scenarios",
    description: "Savings targets, timelines, and monthly contributions.",
    icon: "🎯",
    href: "/setup?tab=goals",
    priority: 90,
    recommendReason:
      "Goals reduce discretionary spend in your plan — add targets you are funding.",
    ctaLabel: "Manage goals",
  },
  {
    id: "risk_profile",
    group: "advisor_system",
    title: "Risk Profile",
    description: "Lifestyle and budgeting style that calibrate guidance.",
    icon: "⚖️",
    href: "/setup?tab=profile",
    priority: 100,
    recommendReason:
      "A risk and budgeting profile helps align portfolio and insurance conversations.",
    ctaLabel: "Complete profile",
  },
  {
    id: "documents",
    group: "advisor_system",
    title: "Documents",
    description: "Statements, policies, and deeds in one secure place.",
    icon: "🗄️",
    href: "/planning/future",
    priority: 130,
    recommendReason:
      "Uploading key documents speeds up advisor reviews when the vault ships.",
    ctaLabel: "View documents roadmap",
  },
] as const;

export const SETUP_MODULE_BY_ID: Record<
  SetupModuleId,
  SetupModuleDefinition
> = Object.fromEntries(
  SETUP_MODULES.map((m) => [m.id, m])
) as Record<SetupModuleId, SetupModuleDefinition>;

/** Default recommendation priority (lower runs first). */
export const SETUP_RECOMMENDATION_PRIORITY: readonly SetupModuleId[] =
  [...SETUP_MODULES]
    .sort((a, b) => a.priority - b.priority)
    .map((m) => m.id);
