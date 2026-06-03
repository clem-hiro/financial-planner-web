import { addMonthsToYearMonth } from "@/lib/dates";

export type ProjectionDirection =
  | "inflow"
  | "outflow"
  | "transfer"
  | "asset_change";

export type ProjectionCashAccess = "cash" | "locked" | "non_cash";

export type ProjectionPhase = "pre_retirement" | "post_retirement" | "both";

export type ProjectionCadence = "monthly" | "annual" | "one_off";

export type ProjectionAssetTarget = "cash" | "investment" | "cpf" | "property";

export type ProjectionSourceType =
  | "employment_income"
  | "bonus_income"
  | "rental_income"
  | "cpf_life"
  | "vehicle_proceeds"
  | "planned_expense"
  | "tax"
  | "housing_cash"
  | "goal_event"
  | "retirement_spend"
  | "investment_contribution"
  | "cpf_life_premium"
  | "other";

export type ProjectionLedgerEntry = {
  id: string;
  sourceType: ProjectionSourceType;
  sourceId?: string | null;
  label: string;
  direction: ProjectionDirection;
  cashAccess: ProjectionCashAccess;
  phase: ProjectionPhase;
  cadence: ProjectionCadence;
  /** Inclusive month index from `startYearMonth`. */
  startMonth: number;
  /** Exclusive month index. Null/undefined means no configured end. */
  endMonth?: number | null;
  /** Major currency units per occurrence. */
  amount: number;
  /**
   * Optional nominal growth. Applied each calendar January after `startYearMonth`,
   * matching the dashboard's existing CPF/surplus January cadence.
   */
  growthAnnual?: number;
  /** Annual entries only; 1-12. */
  monthOfYear?: number;
  /** Asset-change entries only. */
  assetTarget?: ProjectionAssetTarget;
};

export type ProjectionInvestmentComponentKind = "pure_investment" | "ilp";

export type ProjectionInvestmentComponent = {
  id: string;
  label: string;
  kind: ProjectionInvestmentComponentKind;
  initialPrincipal: number;
  annualGrowthRate: number;
  /** Annual cash income rate from this component, e.g. dividend yield or ILP income rate. */
  investmentIncomeRateAnnual?: number | null;
  /** Planned annual withdrawal paid in December and deducted from principal. */
  annualWithdrawal?: number | null;
  /** Zero-based month when planned withdrawals may begin. */
  withdrawalStartMonth?: number | null;
  /** ILP maturity month. Pure investments ignore this. */
  maturityMonth?: number | null;
};

export type ProjectionAssetSnapshot = {
  month: number;
  cpf?: number;
  cpfOa?: number;
  cpfSa?: number;
  cpfMa?: number;
  cpfRa?: number;
  cpfCpfis?: number;
  vehiclesNet?: number;
  propertyNet?: number;
};

export type ProjectionSamplePoint = {
  age: number;
  monthsFromToday: number;
};

export type ProjectionOutflowBreakdownItem = {
  key: string;
  label: string;
  sourceType: ProjectionSourceType;
  amount: number;
};

export type ProjectionPeriodRow = {
  month: number;
  yearMonth: string;
  phase: "pre_retirement" | "post_retirement";
  cashAccessibleInflow: number;
  requiredOutflow: number;
  prePortfolioGap: number;
  /** Deprecated compatibility field. Component income is reported in breakdown fields. */
  investmentYieldAvailable: number;
  /** Deprecated compatibility field. Deficits now sell component principal directly. */
  investmentYieldUsed: number;
  /** Principal sold to fund an inflow/outflow gap, excluding planned annual withdrawals. */
  principalWithdrawn: number;
  investmentPrincipalWithdrawn: number;
  ilpPrincipalWithdrawn: number;
  /** Employment + bonus income; itemizes part of `cashAccessibleInflow`. */
  employmentInflow: number;
  investmentDividendInflow: number;
  ilpIncomeInflow: number;
  cpfLifeInflow: number;
  rentalInflow: number;
  investmentWithdrawalInflow: number;
  /** Cash reserve spent after ordinary inflows and eligible investments cannot cover outflows. */
  cashReserveDrawdown: number;
  goalsGap: number;
  cumulativeGoalsGap: number;
  scheduledInvestmentTransfer: number;
  fundedInvestmentTransfer: number;
  outflowBreakdown: ProjectionOutflowBreakdownItem[];
  cash: number;
  investmentPrincipal: number;
  cpf: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfCpfis: number;
  cpfAssetAdjustment: number;
  vehiclesNet: number;
  propertyNet: number;
  liabilities: number;
  netWorth: number;
};

export type ProjectionAgeRow = ProjectionPeriodRow & {
  age: number;
  monthsFromToday: number;
};

export type RetirementCashflowProjectionInput = {
  startYearMonth: string;
  horizonMonths: number;
  targetRetirementMonth: number;
  initialCash: number;
  initialInvestmentPrincipal: number;
  liabilities: number;
  /** Legacy fallback when `investmentComponents` is empty. */
  investmentTotalReturnAnnual?: number;
  /** Legacy fallback only; new calculations should use component cash inflows. */
  investmentSpendableYieldAnnual?: number;
  investmentComponents?: ProjectionInvestmentComponent[];
  ledger: ProjectionLedgerEntry[];
  samplePoints: ProjectionSamplePoint[];
  externalAssetSnapshots?: ProjectionAssetSnapshot[];
  /**
   * Post-retirement deficits always try pure investments then matured ILP first.
   * When enabled, remaining deficit spends down cash reserves before GoalsGap.
   */
  useCashReserveForDeficits?: boolean;
};

export type RetirementCashflowProjectionResult = {
  periods: ProjectionPeriodRow[];
  samples: ProjectionAgeRow[];
};

type InvestmentComponentState = ProjectionInvestmentComponent & {
  principal: number;
};

type InflowBreakdown = Pick<
  ProjectionPeriodRow,
  | "employmentInflow"
  | "investmentDividendInflow"
  | "ilpIncomeInflow"
  | "cpfLifeInflow"
  | "rentalInflow"
  | "investmentWithdrawalInflow"
>;

type PrincipalDrawBreakdown = Pick<
  ProjectionPeriodRow,
  "investmentPrincipalWithdrawn" | "ilpPrincipalWithdrawn"
>;

const POOLED_INVESTMENT_ID = "__pooled_investments__";
const DECEMBER = 12;

function clampMonth(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function isEntryActive(
  entry: ProjectionLedgerEntry,
  month: number,
  yearMonth: string
): boolean {
  if (month < entry.startMonth) return false;
  if (entry.endMonth != null && month >= entry.endMonth) return false;
  if (entry.cadence === "one_off") return month === entry.startMonth;
  if (entry.cadence === "annual") {
    const payoutMonth = Math.max(
      1,
      Math.min(12, Math.trunc(entry.monthOfYear ?? DECEMBER))
    );
    return Number(yearMonth.slice(5, 7)) === payoutMonth;
  }
  return true;
}

function annualGrowthMultiplier(
  startYearMonth: string,
  yearMonth: string,
  growthAnnual: number | undefined
): number {
  const g = growthAnnual ?? 0;
  if (g === 0) return 1;
  let cursor = startYearMonth;
  let multiplier = 1;
  while (cursor <= yearMonth) {
    if (cursor.endsWith("-01") && cursor > startYearMonth) {
      multiplier *= 1 + g;
    }
    cursor = addMonthsToYearMonth(cursor, 1);
  }
  return multiplier;
}

function amountForEntry(
  entry: ProjectionLedgerEntry,
  startYearMonth: string,
  yearMonth: string
): number {
  return (
    Math.max(0, entry.amount) *
    annualGrowthMultiplier(startYearMonth, yearMonth, entry.growthAnnual)
  );
}

function snapshotForMonth(
  snapshots: ProjectionAssetSnapshot[] | undefined,
  month: number
): ProjectionAssetSnapshot {
  if (!snapshots?.length) return { month };
  let best = snapshots[0];
  for (const s of snapshots) {
    if (s.month <= month && s.month >= best.month) best = s;
  }
  return best;
}

function nonNegativeFinite(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function safeRate(n: number | null | undefined): number {
  if (!Number.isFinite(n ?? Number.NaN)) return 0;
  return Math.max(-0.99, n as number);
}

function incomeRate(n: number | null | undefined): number {
  if (!Number.isFinite(n ?? Number.NaN)) return 0;
  return Math.max(0, n as number);
}

function createInitialBreakdown(): InflowBreakdown {
  return {
    employmentInflow: 0,
    investmentDividendInflow: 0,
    ilpIncomeInflow: 0,
    cpfLifeInflow: 0,
    rentalInflow: 0,
    investmentWithdrawalInflow: 0,
  };
}

function createInitialDrawBreakdown(): PrincipalDrawBreakdown {
  return {
    investmentPrincipalWithdrawn: 0,
    ilpPrincipalWithdrawn: 0,
  };
}

function buildInvestmentStates(
  input: RetirementCashflowProjectionInput
): InvestmentComponentState[] {
  const components = input.investmentComponents ?? [];
  if (components.length > 0) {
    return components.map((component) => ({
      ...component,
      principal: nonNegativeFinite(component.initialPrincipal),
    }));
  }

  const fallbackPrincipal = nonNegativeFinite(input.initialInvestmentPrincipal);
  if (fallbackPrincipal <= 0) return [];
  return [
    {
      id: POOLED_INVESTMENT_ID,
      label: "Investments",
      kind: "pure_investment",
      initialPrincipal: fallbackPrincipal,
      principal: fallbackPrincipal,
      annualGrowthRate: input.investmentTotalReturnAnnual ?? 0,
      investmentIncomeRateAnnual: input.investmentSpendableYieldAnnual ?? 0,
      annualWithdrawal: 0,
      withdrawalStartMonth: null,
      maturityMonth: null,
    },
  ];
}

function investmentPrincipalTotal(components: InvestmentComponentState[]): number {
  return components.reduce((sum, component) => sum + component.principal, 0);
}

function addSourceBreakdown(
  breakdown: InflowBreakdown,
  sourceType: ProjectionSourceType,
  amount: number
): void {
  if (sourceType === "cpf_life") {
    breakdown.cpfLifeInflow += amount;
  } else if (sourceType === "rental_income") {
    breakdown.rentalInflow += amount;
  } else if (
    sourceType === "employment_income" ||
    sourceType === "bonus_income"
  ) {
    breakdown.employmentInflow += amount;
  }
}

function outflowBreakdownKey(entry: ProjectionLedgerEntry): string {
  return `${entry.sourceType}:${entry.sourceId ?? entry.label}`;
}

function addOutflowBreakdown(
  breakdown: Map<string, ProjectionOutflowBreakdownItem>,
  entry: ProjectionLedgerEntry,
  amount: number
): void {
  const key = outflowBreakdownKey(entry);
  const existing = breakdown.get(key);
  if (existing) {
    existing.amount += amount;
    return;
  }
  breakdown.set(key, {
    key,
    label: entry.label,
    sourceType: entry.sourceType,
    amount,
  });
}

function componentCanUsePrincipal(
  component: InvestmentComponentState,
  month: number
): boolean {
  if (component.kind === "pure_investment") return true;
  return component.maturityMonth != null && month >= component.maturityMonth;
}

function componentCanProduceIncome(
  component: InvestmentComponentState,
  month: number
): boolean {
  if (component.kind === "pure_investment") return true;
  return component.maturityMonth != null && month >= component.maturityMonth;
}

function componentCanWithdraw(
  component: InvestmentComponentState,
  month: number
): boolean {
  return (
    component.withdrawalStartMonth != null &&
    Number.isFinite(component.withdrawalStartMonth) &&
    month >= component.withdrawalStartMonth
  );
}

function drawPrincipalProRata(
  components: InvestmentComponentState[],
  needed: number,
  predicate: (component: InvestmentComponentState) => boolean
): number {
  const eligible = components.filter(
    (component) => predicate(component) && component.principal > 0
  );
  if (needed <= 0 || eligible.length === 0) return 0;

  const total = investmentPrincipalTotal(eligible);
  if (total <= 0) return 0;
  const draw = Math.min(needed, total);
  let allocated = 0;
  eligible.forEach((component, index) => {
    const amount =
      index === eligible.length - 1
        ? draw - allocated
        : Math.min(component.principal, draw * (component.principal / total));
    component.principal = Math.max(0, component.principal - amount);
    allocated += amount;
  });
  return draw;
}

function fundTransfersProRata(
  components: InvestmentComponentState[],
  scheduledByComponent: Map<string, number>,
  fundedTotal: number,
  scheduledTotal: number
): void {
  if (fundedTotal <= 0 || scheduledTotal <= 0) return;
  for (const component of components) {
    const scheduled =
      scheduledByComponent.get(component.id) ??
      scheduledByComponent.get(POOLED_INVESTMENT_ID) ??
      0;
    if (scheduled <= 0) continue;
    component.principal += fundedTotal * (scheduled / scheduledTotal);
  }
}

function applyComponentGrowth(components: InvestmentComponentState[]): void {
  for (const component of components) {
    const monthlyGrowthRate = safeRate(component.annualGrowthRate) / 12;
    component.principal = Math.max(
      0,
      component.principal * (1 + monthlyGrowthRate)
    );
  }
}

function addDecemberComponentInflows(
  components: InvestmentComponentState[],
  month: number,
  yearMonth: string,
  breakdown: InflowBreakdown
): number {
  if (Number(yearMonth.slice(5, 7)) !== DECEMBER) return 0;

  let total = 0;
  for (const component of components) {
    if (componentCanProduceIncome(component, month)) {
      const income = component.principal * incomeRate(component.investmentIncomeRateAnnual);
      if (income > 0) {
        total += income;
        if (component.kind === "ilp") {
          breakdown.ilpIncomeInflow += income;
        } else {
          breakdown.investmentDividendInflow += income;
        }
      }
    }

    if (componentCanWithdraw(component, month)) {
      const requested = nonNegativeFinite(component.annualWithdrawal ?? 0);
      const withdrawal = Math.min(requested, component.principal);
      if (withdrawal > 0) {
        component.principal = Math.max(0, component.principal - withdrawal);
        breakdown.investmentWithdrawalInflow += withdrawal;
        total += withdrawal;
      }
    }
  }
  return total;
}

export function buildRetirementCashflowProjection(
  input: RetirementCashflowProjectionInput
): RetirementCashflowProjectionResult {
  const horizonMonths = clampMonth(input.horizonMonths);
  const targetRetirementMonth = clampMonth(input.targetRetirementMonth);
  const periods: ProjectionPeriodRow[] = [];
  const investmentComponents = buildInvestmentStates(input);
  let cash = nonNegativeFinite(input.initialCash);
  let cpfAssetAdjustment = 0;
  let cumulativeGoalsGap = 0;

  // If a conversion event has already happened by the projection start, reflect
  // it in the initial asset state. This keeps CPF LIFE independent of retirement
  // age for users who are already at/past their payout start age.
  for (const entry of input.ledger) {
    if (
      entry.direction === "asset_change" &&
      entry.assetTarget === "cpf" &&
      entry.startMonth <= 0
    ) {
      cpfAssetAdjustment += entry.amount;
    }
  }

  const buildRow = (
    month: number,
    cashAccessibleInflow: number,
    requiredOutflow: number,
    scheduledInvestmentTransfer: number,
    fundedInvestmentTransfer: number,
    cashReserveDrawdown: number,
    drawBreakdown: PrincipalDrawBreakdown,
    inflowBreakdown: InflowBreakdown,
    outflowBreakdown: ProjectionOutflowBreakdownItem[],
    goalsGap: number
  ): ProjectionPeriodRow => {
    const yearMonth = addMonthsToYearMonth(input.startYearMonth, month);
    const snap = snapshotForMonth(input.externalAssetSnapshots, month);
    const cpf = nonNegativeFinite((snap.cpf ?? 0) + cpfAssetAdjustment);
    let remainingCpfDeduction = Math.min(0, cpfAssetAdjustment);
    const cpfRa = nonNegativeFinite((snap.cpfRa ?? 0) + remainingCpfDeduction);
    remainingCpfDeduction = Math.min(
      0,
      (snap.cpfRa ?? 0) + remainingCpfDeduction
    );
    const cpfOa = nonNegativeFinite((snap.cpfOa ?? 0) + remainingCpfDeduction);
    const vehiclesNet = snap.vehiclesNet ?? 0;
    const propertyNet = snap.propertyNet ?? 0;
    const investmentPrincipal = investmentPrincipalTotal(investmentComponents);
    const netWorth =
      investmentPrincipal +
      cash +
      cpf +
      vehiclesNet +
      propertyNet -
      input.liabilities;
    const principalWithdrawn =
      drawBreakdown.investmentPrincipalWithdrawn +
      drawBreakdown.ilpPrincipalWithdrawn;
    return {
      month,
      yearMonth,
      phase:
        month >= targetRetirementMonth ? "post_retirement" : "pre_retirement",
      cashAccessibleInflow,
      requiredOutflow,
      prePortfolioGap: cashAccessibleInflow - requiredOutflow,
      investmentYieldAvailable: 0,
      investmentYieldUsed: 0,
      principalWithdrawn,
      investmentPrincipalWithdrawn: drawBreakdown.investmentPrincipalWithdrawn,
      ilpPrincipalWithdrawn: drawBreakdown.ilpPrincipalWithdrawn,
      ...inflowBreakdown,
      cashReserveDrawdown,
      goalsGap,
      cumulativeGoalsGap,
      scheduledInvestmentTransfer,
      fundedInvestmentTransfer,
      outflowBreakdown,
      cash,
      investmentPrincipal,
      cpf,
      cpfOa,
      cpfSa: snap.cpfSa ?? 0,
      cpfMa: snap.cpfMa ?? 0,
      cpfRa,
      cpfCpfis: snap.cpfCpfis ?? 0,
      cpfAssetAdjustment,
      vehiclesNet,
      propertyNet,
      liabilities: input.liabilities,
      netWorth,
    };
  };

  periods.push(
    buildRow(
      0,
      0,
      0,
      0,
      0,
      0,
      createInitialDrawBreakdown(),
      createInitialBreakdown(),
      [],
      0
    )
  );

  for (let month = 0; month < horizonMonths; month++) {
    const yearMonth = addMonthsToYearMonth(input.startYearMonth, month);
    let cashAccessibleInflow = 0;
    let requiredOutflow = 0;
    let scheduledInvestmentTransfer = 0;
    let cpfAdjustmentThisMonth = 0;
    const scheduledByComponent = new Map<string, number>();
    const inflowBreakdown = createInitialBreakdown();
    const drawBreakdown = createInitialDrawBreakdown();
    const outflowBreakdown = new Map<string, ProjectionOutflowBreakdownItem>();

    for (const entry of input.ledger) {
      if (!isEntryActive(entry, month, yearMonth)) continue;
      // Already reflected in the initial adjustment above.
      if (entry.direction === "asset_change" && entry.startMonth <= 0) continue;
      const amount = amountForEntry(entry, input.startYearMonth, yearMonth);
      if (entry.direction === "inflow" && entry.cashAccess === "cash") {
        cashAccessibleInflow += amount;
        addSourceBreakdown(inflowBreakdown, entry.sourceType, amount);
      } else if (entry.direction === "outflow") {
        requiredOutflow += amount;
        addOutflowBreakdown(outflowBreakdown, entry, amount);
      } else if (
        entry.direction === "transfer" &&
        entry.assetTarget === "investment"
      ) {
        scheduledInvestmentTransfer += amount;
        const componentId = entry.sourceId ?? POOLED_INVESTMENT_ID;
        scheduledByComponent.set(
          componentId,
          (scheduledByComponent.get(componentId) ?? 0) + amount
        );
      } else if (
        entry.direction === "asset_change" &&
        entry.assetTarget === "cpf"
      ) {
        cpfAdjustmentThisMonth += entry.amount;
      }
    }

    cpfAssetAdjustment += cpfAdjustmentThisMonth;

    const periodSurplus = cashAccessibleInflow - requiredOutflow;
    let fundedInvestmentTransfer = 0;
    let cashReserveDrawdown = 0;
    let goalsGap = 0;

    if (periodSurplus >= 0) {
      fundedInvestmentTransfer = Math.min(
        scheduledInvestmentTransfer,
        periodSurplus
      );
      fundTransfersProRata(
        investmentComponents,
        scheduledByComponent,
        fundedInvestmentTransfer,
        scheduledInvestmentTransfer
      );
      cash += periodSurplus - fundedInvestmentTransfer;
    } else {
      let shortfall = Math.abs(periodSurplus);
      if (month < targetRetirementMonth) {
        cashReserveDrawdown = Math.min(shortfall, cash);
        cash -= cashReserveDrawdown;
        shortfall -= cashReserveDrawdown;
      } else {
        const investmentDraw = drawPrincipalProRata(
          investmentComponents,
          shortfall,
          (component) => component.kind === "pure_investment"
        );
        drawBreakdown.investmentPrincipalWithdrawn = investmentDraw;
        shortfall -= investmentDraw;

        const ilpDraw = drawPrincipalProRata(
          investmentComponents,
          shortfall,
          (component) =>
            component.kind === "ilp" && componentCanUsePrincipal(component, month)
        );
        drawBreakdown.ilpPrincipalWithdrawn = ilpDraw;
        shortfall -= ilpDraw;

        if (input.useCashReserveForDeficits && shortfall > 0) {
          cashReserveDrawdown = Math.min(shortfall, cash);
          cash -= cashReserveDrawdown;
          shortfall -= cashReserveDrawdown;
        }
      }

      goalsGap = Math.max(0, shortfall);
      cumulativeGoalsGap += goalsGap;
    }

    applyComponentGrowth(investmentComponents);
    const componentCashInflow = addDecemberComponentInflows(
      investmentComponents,
      month,
      yearMonth,
      inflowBreakdown
    );
    cashAccessibleInflow += componentCashInflow;
    cash += componentCashInflow;

    periods.push(
      buildRow(
        month + 1,
        cashAccessibleInflow,
        requiredOutflow,
        scheduledInvestmentTransfer,
        fundedInvestmentTransfer,
        cashReserveDrawdown,
        drawBreakdown,
        inflowBreakdown,
        Array.from(outflowBreakdown.values()),
        goalsGap
      )
    );
  }

  const samples = input.samplePoints.map((point) => {
    const month = Math.min(clampMonth(point.monthsFromToday), periods.length - 1);
    return {
      ...periods[month],
      age: point.age,
      monthsFromToday: point.monthsFromToday,
    };
  });

  return { periods, samples };
}
