import type {
  AgeAssetBreakdownPoint,
  AgeOutflowBreakdownItem,
} from "@/data/age-asset-breakdown";

export type RunwaySegmentKind =
  | "takehome"
  | "passive"
  | "yield"
  | "other"
  | "drawdown"
  | "cash"
  | "shortfall";

export type RunwaySegment = {
  key: string;
  label: string;
  kind: RunwaySegmentKind;
};

export type RunwayAmountDetail = {
  key: string;
  label: string;
  amount: number;
};

export type RunwayRow = {
  [key: string]: unknown;
  age: number;
  expenses: number;
  takehome: number;
  passive: number;
  yield: number;
  other: number;
  drawdown: number;
  cashReserve: number;
  shortfall: number;
  networth: number;
  fundableAssets: number;
  cashBalance: number;
  investmentPrincipal: number;
  cpfBalance: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfCpfis: number;
  propertyNet: number;
  vehiclesNet: number;
  liabilities: number;
  phase: "Working" | "Retired";
  rawTakehome: number;
  rawPassive: number;
  rawYield: number;
  rawOther: number;
  rawDrawdown: number;
  rawCashReserve: number;
  rawCpfLife: number;
  rawRental: number;
  rawInvestmentDividend: number;
  rawIlpIncome: number;
  rawInvestmentWithdrawal: number;
  rawPrincipalWithdrawn: number;
  rawInvestmentPrincipalWithdrawn: number;
  rawIlpPrincipalWithdrawn: number;
  rawGoalsGap: number;
  coveredTakehome: number;
  coveredPassive: number;
  coveredYield: number;
  coveredOther: number;
  coveredDrawdown: number;
  coveredCashReserve: number;
  outflowSegments: RunwayAmountDetail[];
};

export type RunwayRowsResult = {
  rows: RunwayRow[];
  segments: RunwaySegment[];
};

export type RunwayMilestoneKind = "rental" | "retirement" | "goal" | "shortfall";

export type RunwayMilestone = {
  age: number;
  kind: RunwayMilestoneKind;
  icon: string;
  title: string;
  tone: "ok" | "gold" | "risk";
};

const SEGMENTS: RunwaySegment[] = [
  { key: "takehome", label: "Take-home", kind: "takehome" },
  { key: "passive", label: "Passive income", kind: "passive" },
  { key: "yield", label: "Investment income", kind: "yield" },
  { key: "other", label: "Other income", kind: "other" },
  { key: "drawdown", label: "Investment / ILP drawdown", kind: "drawdown" },
  { key: "cashReserve", label: "Cash reserve drawdown", kind: "cash" },
  { key: "shortfall", label: "Shortfall", kind: "shortfall" },
];

const TAX_EXPENSES = "outflow:tax";
const HOUSING_EXPENSES = "outflow:housing";
const GOAL_EXPENSES = "outflow:goals";
const RETIREMENT_EXPENSES = "outflow:retirement";
const OTHER_EXPENSES = "outflow:other";

const num = (v: number | undefined) => (v != null && Number.isFinite(v) ? v : 0);

function safeSegmentKey(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "other";
}

function addAmount(
  map: Map<string, { key: string; label: string; amount: number }>,
  key: string,
  label: string,
  amount: number
): void {
  if (amount <= 0) return;
  const existing = map.get(key);
  if (existing) {
    existing.amount += amount;
    return;
  }
  map.set(key, { key, label, amount });
}

function outflowBreakdownItem(
  item: AgeOutflowBreakdownItem
): { key: string; label: string } {
  if (item.sourceType === "planned_expense") {
    return {
      key: `outflow:budget:${safeSegmentKey(item.key)}`,
      label: item.label,
    };
  }
  if (item.sourceType === "tax") {
    return { key: TAX_EXPENSES, label: "Estimated income tax" };
  }
  if (item.sourceType === "housing_cash") {
    return { key: HOUSING_EXPENSES, label: "Housing cash payment" };
  }
  if (item.sourceType === "goal_event") {
    return { key: GOAL_EXPENSES, label: "Goal outflows" };
  }
  if (item.sourceType === "retirement_spend") {
    return { key: RETIREMENT_EXPENSES, label: "Retirement spending need" };
  }
  return { key: OTHER_EXPENSES, label: "Other outflows" };
}

function outflowSegmentsForPoint(
  point: AgeAssetBreakdownPoint
): RunwayAmountDetail[] {
  const grouped = new Map<string, { key: string; label: string; amount: number }>();
  for (const item of point.outflowBreakdown ?? []) {
    const segment = outflowBreakdownItem(item);
    addAmount(grouped, segment.key, segment.label, item.amount);
  }
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
}

function investmentPrincipalForPoint(point: AgeAssetBreakdownPoint): number {
  return point.investmentPrincipal != null
    ? num(point.investmentPrincipal)
    : num(point.investments);
}

export function toRunwayRows(points: AgeAssetBreakdownPoint[]): RunwayRowsResult {
  const rows: RunwayRow[] = points.map((p, index) => {
    const expenses = num(p.requiredOutflow);
    const rawTakehome = num(p.employmentInflow);
    const rawCpfLife = num(p.cpfLifeInflow);
    const rawRental = num(p.rentalInflow);
    const rawInvestmentDividend = num(p.investmentDividendInflow);
    const rawIlpIncome = num(p.ilpIncomeInflow);
    const rawInvestmentWithdrawal = num(p.investmentWithdrawalInflow);
    const rawPrincipalWithdrawn = num(p.principalWithdrawn);
    const rawInvestmentPrincipalWithdrawn = num(p.investmentPrincipalWithdrawn);
    const rawIlpPrincipalWithdrawn = num(p.ilpPrincipalWithdrawn);
    const rawPassive = rawCpfLife + rawRental;
    const rawYield = rawInvestmentDividend + rawIlpIncome;
    const rawDrawdown =
      rawInvestmentWithdrawal + rawPrincipalWithdrawn;
    const rawCashReserve = num(p.cashReserveDrawdown);
    const rawGoalsGap = num(p.goalsGap);
    const cpfOa = num(p.cpfOa);
    const cpfSa = num(p.cpfSa);
    const cpfMa = num(p.cpfMa);
    const cpfRa = num(p.cpfRa);
    const cpfCpfis = num(p.cpfCpfis);
    const cpfBucketTotal = cpfOa + cpfSa + cpfMa + cpfRa + cpfCpfis;
    const cpfBalance = num(p.cpf) || cpfBucketTotal;
    const namedCashInflow =
      rawTakehome +
      rawCpfLife +
      rawRental +
      rawInvestmentDividend +
      rawIlpIncome +
      rawInvestmentWithdrawal;
    const rawOther = Math.max(0, num(p.cashAccessibleInflow) - namedCashInflow);
    const cashBalance = num(p.cash);
    const previousCashBalance =
      index > 0 ? num(points[index - 1].cash) : cashBalance + rawCashReserve;
    const cashBalanceSpendDown = Math.max(0, previousCashBalance - cashBalance);
    const displayCashReserve = Math.min(rawCashReserve, cashBalanceSpendDown);
    const investmentPrincipal = investmentPrincipalForPoint(p);
    const fundableAssets = cashBalance + investmentPrincipal;

    let need = expenses;
    const cover = (source: number) => {
      const v = Math.min(need, Math.max(0, source));
      need -= v;
      return v;
    };
    const takehome = cover(rawTakehome);
    const passive = cover(rawPassive);
    const yieldValue = cover(rawYield);
    const other = cover(rawOther);
    const drawdown = cover(rawDrawdown);
    const cashReserve = cover(displayCashReserve);
    const shortfall = Math.max(0, need);

    return {
      age: p.age,
      expenses,
      takehome,
      passive,
      yield: yieldValue,
      other,
      drawdown,
      cashReserve,
      shortfall,
      networth: num(p.value),
      fundableAssets,
      cashBalance,
      investmentPrincipal,
      cpfBalance,
      cpfOa,
      cpfSa,
      cpfMa,
      cpfRa,
      cpfCpfis,
      propertyNet: num(p.propertyNet),
      vehiclesNet: num(p.vehiclesNet),
      liabilities: num(p.liabilities),
      phase: p.phase === "post_retirement" ? "Retired" : "Working",
      rawTakehome,
      rawPassive,
      rawYield,
      rawOther,
      rawDrawdown,
      rawCashReserve,
      rawCpfLife,
      rawRental,
      rawInvestmentDividend,
      rawIlpIncome,
      rawInvestmentWithdrawal,
      rawPrincipalWithdrawn,
      rawInvestmentPrincipalWithdrawn,
      rawIlpPrincipalWithdrawn,
      rawGoalsGap,
      coveredTakehome: takehome,
      coveredPassive: passive,
      coveredYield: yieldValue,
      coveredOther: other,
      coveredDrawdown: drawdown,
      coveredCashReserve: cashReserve,
      outflowSegments: outflowSegmentsForPoint(p),
    };
  });

  const activeSegments = SEGMENTS.filter((segment) =>
    rows.some((row) => num(row[segment.key] as number | undefined) > 0.5)
  );
  return { rows, segments: activeSegments };
}

const firstAge = (
  points: AgeAssetBreakdownPoint[],
  match: (p: AgeAssetBreakdownPoint) => boolean
) => points.find(match)?.age ?? null;

/**
 * Milestones derived from the ledger: rental start, retirement / CPF LIFE handoff,
 * the largest one-off spending spike, and the first shortfall year. Sorted by age.
 */
export function deriveMilestones(
  points: AgeAssetBreakdownPoint[]
): RunwayMilestone[] {
  const out: RunwayMilestone[] = [];

  const rentalAge = firstAge(points, (p) => num(p.rentalInflow) > 0.5);
  if (rentalAge != null) {
    out.push({
      age: rentalAge,
      kind: "rental",
      icon: "H",
      title: "Rental income starts",
      tone: "ok",
    });
  }

  const retireAge =
    firstAge(points, (p) => p.phase === "post_retirement") ??
    firstAge(points, (p) => num(p.cpfLifeInflow) > 0.5);
  if (retireAge != null) {
    out.push({
      age: retireAge,
      kind: "retirement",
      icon: "R",
      title: "Retirement starts",
      tone: "ok",
    });
  }

  const goalAge = findSpikeAge(points);
  if (goalAge != null) {
    out.push({
      age: goalAge,
      kind: "goal",
      icon: "G",
      title: "One-off goal outflow",
      tone: "gold",
    });
  }

  const shortfallAge = firstAge(points, (p) => num(p.goalsGap) > 0.5);
  if (shortfallAge != null) {
    out.push({
      age: shortfallAge,
      kind: "shortfall",
      icon: "!",
      title: "Shortfall begins",
      tone: "risk",
    });
  }

  return out.sort((a, b) => a.age - b.age);
}

/** Largest interior `requiredOutflow` spike that exceeds 1.25x both neighbours. */
function findSpikeAge(points: AgeAssetBreakdownPoint[]): number | null {
  let best: { age: number; excess: number } | null = null;
  for (let i = 1; i < points.length - 1; i++) {
    const cur = num(points[i].requiredOutflow);
    const neighbour = Math.max(
      num(points[i - 1].requiredOutflow),
      num(points[i + 1].requiredOutflow)
    );
    if (neighbour > 0 && cur > neighbour * 1.25) {
      const excess = cur - neighbour;
      if (!best || excess > best.excess) best = { age: points[i].age, excess };
    }
  }
  return best?.age ?? null;
}
