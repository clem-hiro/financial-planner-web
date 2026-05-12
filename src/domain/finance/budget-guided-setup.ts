import { normalizeCategory } from "./budget";

export type LifestyleProfileId =
  | "student"
  | "fresh_graduate"
  | "young_professional"
  | "married_couple"
  | "young_family"
  | "high_saver"
  | "flexible_lifestyle"
  | "freelancer"
  | "business_owner";

export type BudgetingStrategyId =
  | "balanced"
  | "aggressive_saver"
  | "flexible_lifestyle"
  | "custom";

export type OnboardingConfidenceLevel = "rough" | "moderate" | "detailed";

export type FoodSpendBandId =
  | "under_300"
  | "range_300_600"
  | "range_600_1000"
  | "above_1000"
  | "unknown";

export type BudgetSpendBucket = "needs" | "wants" | "savings";

/** Wants / needs / savings shares (sum = 1). `custom` mirrors balanced until bespoke splits exist. */
export function strategyNeedsWantsSavings(
  strategy: BudgetingStrategyId
): { needs: number; wants: number; savings: number } {
  switch (strategy) {
    case "aggressive_saver":
      return { needs: 0.4, wants: 0.2, savings: 0.4 };
    case "flexible_lifestyle":
      return { needs: 0.5, wants: 0.4, savings: 0.1 };
    case "custom":
    case "balanced":
    default:
      return { needs: 0.5, wants: 0.3, savings: 0.2 };
  }
}

export const LIFESTYLE_PRESETS: ReadonlyArray<{
  id: LifestyleProfileId;
  label: string;
  blurb: string;
}> = [
  {
    id: "student",
    label: "Student",
    blurb: "Lean housing, higher transport share — starter Singapore mix.",
  },
  {
    id: "fresh_graduate",
    label: "Fresh graduate",
    blurb: "Early-career rent and social spend balance.",
  },
  {
    id: "young_professional",
    label: "Young professional",
    blurb: "Balanced starter template — good default for most singles.",
  },
  {
    id: "married_couple",
    label: "Married couple",
    blurb: "Slightly higher housing and shared costs.",
  },
  {
    id: "young_family",
    label: "Young family",
    blurb: "More housing and essentials; keeps wants modest.",
  },
  {
    id: "high_saver",
    label: "High saver",
    blurb: "Prioritises savings lines; trims discretionary buckets.",
  },
  {
    id: "flexible_lifestyle",
    label: "Flexible lifestyle",
    blurb: "More room for dining, shopping, and subscriptions.",
  },
  {
    id: "freelancer",
    label: "Freelancer",
    blurb: "Higher buffers for insurance and variable months.",
  },
  {
    id: "business_owner",
    label: "Business owner",
    blurb: "Higher insurance and operations-style essentials.",
  },
];

export const BUDGET_STRATEGY_PRESETS: ReadonlyArray<{
  id: BudgetingStrategyId;
  label: string;
  subtitle: string;
}> = [
  {
    id: "balanced",
    label: "Balanced",
    subtitle: "50 / 30 / 20 — needs / wants / savings",
  },
  {
    id: "aggressive_saver",
    label: "Aggressive saver",
    subtitle: "40 / 20 / 40",
  },
  {
    id: "flexible_lifestyle",
    label: "Flexible lifestyle",
    subtitle: "50 / 40 / 10",
  },
  {
    id: "custom",
    label: "Custom",
    subtitle: "Start like balanced — fine-tune later on Budget",
  },
];

type NeedKey = "housing" | "food" | "transport" | "insurance";

const DEFAULT_NEED_WEIGHT: Record<NeedKey, number> = {
  housing: 0.42,
  food: 0.24,
  transport: 0.18,
  insurance: 0.16,
};

function lifestyleNeedMultipliers(
  lifestyle: LifestyleProfileId
): Record<NeedKey, number> {
  const m = (
    housing: number,
    food: number,
    transport: number,
    insurance: number
  ): Record<NeedKey, number> => ({ housing, food, transport, insurance });
  switch (lifestyle) {
    case "student":
      return m(0.55, 1.15, 1.25, 0.85);
    case "fresh_graduate":
      return m(0.75, 1.05, 1.05, 0.95);
    case "young_professional":
      return m(1, 1, 1, 1);
    case "married_couple":
      return m(1.12, 1.08, 1, 1.05);
    case "young_family":
      return m(1.22, 1.12, 1.05, 1.08);
    case "high_saver":
      return m(0.95, 0.95, 0.95, 1);
    case "flexible_lifestyle":
      return m(0.92, 1.18, 1, 0.95);
    case "freelancer":
      return m(0.95, 1, 1.05, 1.12);
    case "business_owner":
      return m(1, 0.95, 1.05, 1.15);
    default:
      return m(1, 1, 1, 1);
  }
}

function foodBandMidpointSgd(band: FoodSpendBandId | null | undefined): number | null {
  if (!band || band === "unknown") return null;
  switch (band) {
    case "under_300":
      return 150;
    case "range_300_600":
      return 450;
    case "range_600_1000":
      return 800;
    case "above_1000":
      return 1200;
    default:
      return null;
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function distributeRemainder(
  total: number,
  parts: number[],
  eps = 0.000_001
): number[] {
  const sum = parts.reduce((a, b) => a + b, 0);
  if (parts.length === 0) return [];
  if (sum <= eps) {
    const each = total / parts.length;
    return parts.map(() => roundMoney(each));
  }
  const scaled = parts.map((p) => (p / sum) * total);
  const rounded = scaled.map((x) => roundMoney(x));
  let drift = roundMoney(total - rounded.reduce((a, b) => a + b, 0));
  if (Math.abs(drift) < 0.005) {
    rounded[rounded.length - 1] = roundMoney(rounded[rounded.length - 1]! + drift);
    return rounded;
  }
  rounded[rounded.length - 1] = roundMoney(rounded[rounded.length - 1]! + drift);
  return rounded;
}

export type GuidedBudgetLineDraft = {
  category: string;
  amount: number;
  cadence: "monthly";
};

export type GenerateGuidedBudgetParams = {
  monthlyIncome: number;
  lifestyle: LifestyleProfileId;
  strategy: BudgetingStrategyId;
  foodSpendBand?: FoodSpendBandId | null;
};

/**
 * Heuristic monthly budget lines for Singapore-oriented starter plans.
 * Amounts sum to `monthlyIncome` when income &gt; 0 (within rounding).
 */
export function generateGuidedMonthlyBudgetLines(
  params: GenerateGuidedBudgetParams
): GuidedBudgetLineDraft[] {
  const income = params.monthlyIncome;
  if (!Number.isFinite(income) || income <= 0) return [];

  const { needs, wants, savings } = strategyNeedsWantsSavings(params.strategy);
  const needsAmount = income * needs;
  const wantsAmount = income * wants;
  const savingsAmount = income * savings;

  const mult = lifestyleNeedMultipliers(params.lifestyle);
  const needKeys: NeedKey[] = ["housing", "food", "transport", "insurance"];
  const weighted = needKeys.map(
    (k) => DEFAULT_NEED_WEIGHT[k] * mult[k]
  );

  const foodMid = foodBandMidpointSgd(params.foodSpendBand);
  let housingAmt: number;
  let foodAmt: number;
  let transportAmt: number;
  let insuranceAmt: number;

  if (foodMid != null) {
    const cap = needsAmount * 0.48;
    foodAmt = roundMoney(Math.min(foodMid, cap));
    foodAmt = Math.min(foodAmt, Math.max(0, needsAmount * 0.95));
    const remainingNeeds = Math.max(0, needsAmount - foodAmt);
    const idxHousing = 0;
    const idxTransport = 2;
    const idxInsurance = 3;
    const subWeights = [
      weighted[idxHousing]!,
      weighted[idxTransport]!,
      weighted[idxInsurance]!,
    ];
    [housingAmt, transportAmt, insuranceAmt] = distributeRemainder(
      remainingNeeds,
      subWeights
    );
  } else {
    const parts = distributeRemainder(needsAmount, weighted);
    housingAmt = parts[0]!;
    foodAmt = parts[1]!;
    transportAmt = parts[2]!;
    insuranceAmt = parts[3]!;
  }

  let shoppingShare = 0.62;
  let subShare = 0.38;
  if (params.lifestyle === "flexible_lifestyle") {
    shoppingShare = 0.72;
    subShare = 0.28;
  }
  if (params.lifestyle === "high_saver") {
    shoppingShare = 0.48;
    subShare = 0.52;
  }

  const shoppingAmt = roundMoney(wantsAmount * shoppingShare);
  const subscriptionsAmt = roundMoney(wantsAmount - shoppingAmt);

  let savingsLineShare = 0.58;
  let investShare = 0.42;
  if (params.lifestyle === "high_saver" || params.strategy === "aggressive_saver") {
    savingsLineShare = 0.72;
    investShare = 0.28;
  }

  const savingsLineAmt = roundMoney(savingsAmount * savingsLineShare);
  const investmentsAmt = roundMoney(savingsAmount - savingsLineAmt);

  const lines: GuidedBudgetLineDraft[] = [
    { category: "housing", amount: housingAmt, cadence: "monthly" },
    { category: "food", amount: foodAmt, cadence: "monthly" },
    { category: "transport", amount: transportAmt, cadence: "monthly" },
    { category: "insurance", amount: insuranceAmt, cadence: "monthly" },
    { category: "shopping", amount: shoppingAmt, cadence: "monthly" },
    { category: "subscriptions", amount: subscriptionsAmt, cadence: "monthly" },
    { category: "savings", amount: savingsLineAmt, cadence: "monthly" },
    { category: "investments", amount: investmentsAmt, cadence: "monthly" },
  ];

  const sum = lines.reduce((a, l) => a + l.amount, 0);
  const drift = roundMoney(income - sum);
  if (Math.abs(drift) >= 0.01) {
    const foodLine = lines.find((l) => l.category === "food");
    if (foodLine) {
      foodLine.amount = roundMoney(foodLine.amount + drift);
    }
  }

  return lines.filter((l) => l.amount > 0);
}

/** Map expense/budget categories to wants/needs/savings for coarse visuals. */
export function budgetBucketForCategoryLabel(
  categoryRaw: string
): BudgetSpendBucket {
  const k = normalizeCategory(categoryRaw);
  if (
    k.includes("saving") ||
    k.includes("invest") ||
    k === "cpf" ||
    k.includes("retirement")
  ) {
    return "savings";
  }
  if (
    k.includes("shop") ||
    k.includes("subscription") ||
    k.includes("entertain") ||
    k.includes("dining out") ||
    k === "dining" ||
    k.includes("hobby") ||
    (k.includes("travel") && !k.includes("insurance"))
  ) {
    return "wants";
  }
  return "needs";
}

export function sumBucketAmounts(
  lines: ReadonlyArray<{ category: string; amount: number }>
): Record<BudgetSpendBucket, number> {
  const out: Record<BudgetSpendBucket, number> = {
    needs: 0,
    wants: 0,
    savings: 0,
  };
  for (const l of lines) {
    const b = budgetBucketForCategoryLabel(l.category);
    out[b] += l.amount;
  }
  return out;
}
