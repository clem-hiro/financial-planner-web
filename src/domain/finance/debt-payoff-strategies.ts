export type DebtPayoffSimDebt = {
  id: string;
  name: string;
  balance: number;
  annualRate: number;
  minimumPayment: number;
};

export type PayoffStrategyId = "avalanche" | "snowball";

export type DebtPayoffStrategyResult = {
  strategy: PayoffStrategyId;
  label: string;
  monthsToDebtFree: number | null;
  totalInterestPaid: number;
  payoffOrder: string[];
};

const STRATEGY_LABELS: Record<PayoffStrategyId, string> = {
  avalanche: "Avalanche (highest interest first)",
  snowball: "Snowball (smallest balance first)",
};

const MAX_SIM_MONTHS = 600;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

type SimState = DebtPayoffSimDebt & { balance: number };

function pickTarget(
  active: SimState[],
  strategy: PayoffStrategyId
): SimState | null {
  if (active.length === 0) return null;
  if (strategy === "avalanche") {
    return active.reduce((best, s) => {
      if (s.annualRate > best.annualRate) return s;
      if (s.annualRate === best.annualRate && s.balance < best.balance) return s;
      return best;
    });
  }
  return active.reduce((best, s) => {
    if (s.balance < best.balance) return s;
    if (s.balance === best.balance && s.annualRate > best.annualRate) return s;
    return best;
  });
}

function simulateStrategy(
  initial: DebtPayoffSimDebt[],
  strategy: PayoffStrategyId,
  extraMonthly: number
): DebtPayoffStrategyResult {
  const states: SimState[] = initial.map((d) => ({ ...d }));
  const monthlyBudget =
    initial.reduce((sum, d) => sum + d.minimumPayment, 0) +
    Math.max(0, extraMonthly);
  let months = 0;
  let totalInterest = 0;
  const payoffOrder: string[] = [];

  while (states.some((s) => s.balance > 0.01) && months < MAX_SIM_MONTHS) {
    months += 1;

    for (const s of states) {
      if (s.balance <= 0.01) continue;
      const interest = s.balance * (Math.max(0, s.annualRate) / 12);
      totalInterest += interest;
      s.balance += interest;
    }

    let cash = monthlyBudget;
    const active = states.filter((s) => s.balance > 0.01);

    for (const s of active) {
      const minDue = Math.min(s.minimumPayment, s.balance);
      const pay = Math.min(minDue, cash);
      s.balance = roundMoney(s.balance - pay);
      cash = roundMoney(cash - pay);
    }

    while (cash > 0.01) {
      const stillActive = states.filter((s) => s.balance > 0.01);
      const target = pickTarget(stillActive, strategy);
      if (!target) break;
      const pay = Math.min(cash, target.balance);
      target.balance = roundMoney(target.balance - pay);
      cash = roundMoney(cash - pay);
      if (target.balance <= 0.01 && !payoffOrder.includes(target.id)) {
        payoffOrder.push(target.id);
        target.balance = 0;
      }
    }

    for (const s of states) {
      if (s.balance <= 0.01 && !payoffOrder.includes(s.id)) {
        payoffOrder.push(s.id);
        s.balance = 0;
      }
    }
  }

  return {
    strategy,
    label: STRATEGY_LABELS[strategy],
    monthsToDebtFree: months < MAX_SIM_MONTHS ? months : null,
    totalInterestPaid: roundMoney(totalInterest),
    payoffOrder,
  };
}

/** Debts eligible for multi-debt payoff comparison. */
export function debtsEligibleForPayoffComparison(
  debts: DebtPayoffSimDebt[]
): DebtPayoffSimDebt[] {
  return debts.filter((d) => d.balance > 0 && d.minimumPayment > 0);
}

/**
 * Compare avalanche vs snowball using the same total monthly debt budget
 * (sum of minimum repayments + optional extra). Returns empty when fewer than
 * two eligible debts.
 */
export function compareDebtPayoffStrategies(
  debts: DebtPayoffSimDebt[],
  extraMonthly: number
): DebtPayoffStrategyResult[] {
  const eligible = debtsEligibleForPayoffComparison(debts);
  if (eligible.length < 2) return [];

  return (["avalanche", "snowball"] as const).map((strategy) =>
    simulateStrategy(eligible, strategy, extraMonthly)
  );
}
