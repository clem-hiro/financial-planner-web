import { projectFutureValue } from "./projection";

/** Same numeric role as `ProjectionSnapshot` in data layer (no cross-import). */
export type InvestmentProjectionLike = {
  currentValue: number;
  monthlyContribution: number;
  annualReturn: number;
};

function parseYmd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/**
 * Completed years of age on `asOf` (local calendar), from `birthISODate` `YYYY-MM-DD`.
 */
export function ageCompletedOnDate(
  birthISODate: string,
  asOf: Date
): number {
  const b = parseYmd(birthISODate);
  let age = asOf.getFullYear() - b.y;
  const mo = asOf.getMonth() + 1;
  const day = asOf.getDate();
  if (mo < b.m || (mo === b.m && day < b.d)) {
    age -= 1;
  }
  return age;
}

/**
 * Simplified trajectory: investment bucket compounds via `projectFutureValue`.
 * Cash and liabilities are **not** stepped here—the dashboard adds surplus
 * (take-home minus expenses) onto projected cash over time; liabilities stay flat.
 * Months to each age: `(age - currentAge) * 12` (approximate year alignment).
 */
export function buildNetWorthByAgeProjection(params: {
  birthDate: string;
  asOf: Date;
  investmentSnapshot: InvestmentProjectionLike;
  cashTotal: number;
  liabilitiesTotal: number;
  /** Sample every N years from current age through `maxAge`. Default 1 (every year). */
  ageStep?: number;
  /** Furthest age on the axis: min(currentAge + 50, 90). */
  maxAge?: number;
  /** Always include this age when it lies in [currentAge, maxAge] (e.g. retirement). */
  emphasizeAge?: number | null;
}): Array<{ age: number; value: number; monthsFromToday: number }> {
  const currentAge = ageCompletedOnDate(params.birthDate, params.asOf);
  const ageStep = params.ageStep ?? 1;
  const maxAge = params.maxAge ?? Math.min(currentAge + 50, 90);
  const snap = params.investmentSnapshot;
  const base = params.cashTotal - params.liabilitiesTotal;

  const ages = new Set<number>();
  for (let a = currentAge; a <= maxAge; a += ageStep) {
    ages.add(a);
  }
  ages.add(currentAge);
  ages.add(maxAge);
  const emphasize = params.emphasizeAge;
  if (
    emphasize != null &&
    Number.isFinite(emphasize) &&
    emphasize >= currentAge &&
    emphasize <= maxAge
  ) {
    ages.add(Math.round(emphasize));
  }

  const sorted = [...ages].sort((x, y) => x - y);

  return sorted.map((age) => {
    const monthsFromToday = Math.max(0, (age - currentAge) * 12);
    const inv = projectFutureValue({
      currentValue: snap.currentValue,
      monthlyContribution: snap.monthlyContribution,
      annualReturn: snap.annualReturn,
      months: monthsFromToday,
    });
    return {
      age,
      value: inv + base,
      monthsFromToday,
    };
  });
}
