import type { BudgetSpendBucket } from "@/domain/finance";

export type BudgetQuickPreset = {
  id: string;
  /** Stored category (normalized on save) */
  category: string;
  label: string;
  emoji: string;
  /** Default when no income hint */
  defaultMonthlyAmount: number;
  bucket: BudgetSpendBucket;
  /** Optional helper for recommendation strip */
  typicalRangeLabel?: string;
};

export const BUDGET_QUICK_PRESETS: readonly BudgetQuickPreset[] = [
  {
    id: "housing",
    category: "housing",
    label: "Housing",
    emoji: "\u{1F3E0}",
    defaultMonthlyAmount: 1800,
    bucket: "needs",
    typicalRangeLabel: "Rent / mortgage varies widely — start with your contract amount.",
  },
  {
    id: "food",
    category: "food",
    label: "Food",
    emoji: "\u{1F37D}",
    defaultMonthlyAmount: 550,
    bucket: "needs",
    typicalRangeLabel: "Typical groceries & meals: around S$400–800 for many households.",
  },
  {
    id: "transport",
    category: "transport",
    label: "Transport",
    emoji: "\u{1F697}",
    defaultMonthlyAmount: 280,
    bucket: "needs",
  },
  {
    id: "bills",
    category: "utilities",
    label: "Bills",
    emoji: "\u{1F4A1}",
    defaultMonthlyAmount: 120,
    bucket: "needs",
    typicalRangeLabel: "Utilities, mobile, internet — adjust to your actual bills.",
  },
  {
    id: "insurance",
    category: "insurance",
    label: "Insurance",
    emoji: "\u{1F6E1}",
    defaultMonthlyAmount: 220,
    bucket: "needs",
  },
  {
    id: "shopping",
    category: "shopping",
    label: "Shopping",
    emoji: "\u{1F6CD}",
    defaultMonthlyAmount: 200,
    bucket: "wants",
  },
  {
    id: "entertainment",
    category: "entertainment",
    label: "Fun",
    emoji: "\u{1F3AD}",
    defaultMonthlyAmount: 180,
    bucket: "wants",
  },
  {
    id: "subscriptions",
    category: "subscriptions",
    label: "Subscriptions",
    emoji: "\u{1F4FA}",
    defaultMonthlyAmount: 60,
    bucket: "wants",
  },
  {
    id: "savings",
    category: "savings",
    label: "Savings",
    emoji: "\u{1F4B0}",
    defaultMonthlyAmount: 400,
    bucket: "savings",
    typicalRangeLabel: "Many balanced plans aim for ~20% to savings — tweak to what feels realistic.",
  },
] as const;

export function suggestedMonthlyForPreset(
  preset: BudgetQuickPreset,
  monthlyIncome: number | null
): number {
  if (monthlyIncome != null && monthlyIncome > 0) {
    if (preset.id === "savings") {
      return Math.max(0, Math.round(monthlyIncome * 0.2 * 100) / 100);
    }
    if (preset.id === "housing") {
      return Math.max(0, Math.round(monthlyIncome * 0.35 * 100) / 100);
    }
    if (preset.id === "food") {
      return Math.max(0, Math.round(monthlyIncome * 0.12 * 100) / 100);
    }
  }
  return preset.defaultMonthlyAmount;
}
