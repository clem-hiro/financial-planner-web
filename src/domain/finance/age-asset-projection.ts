import { addCalendarMonths } from "@/lib/dates";
import type { BudgetLineForDomain } from "./budget";
import { sumInvestableSurplusOverHorizon } from "./investable-surplus";
import {
  cumulativeVehicleProceedsToCash,
  vehicleNetListedBeforeLiquidation,
} from "./vehicle-sg";
import type { VehicleValuationInput } from "./vehicle-sg";

export interface AgeCashPoint {
  age: number;
  monthsFromToday: number;
  surplusAccrual: number;
  vehicleSaleCash: number;
  vehiclesNet: number;
  /** `cashTotal + vehicleSaleCash + surplusAccrual` (excludes investments/CPF). */
  cash: number;
}

export interface AgeAssetProjectionResult {
  perAge: AgeCashPoint[];
  surplusAccrualToRet: number;
  vehicleSaleCashAtRet: number;
  vehiclesNetAtRet: number;
  cashAtRetirementHorizon: number;
}

export interface AgeAssetProjectionInput {
  agePoints: { age: number; monthsFromToday: number }[];
  asOf: Date;
  monthsToRet: number;
  cashTotal: number;
  vehicleValuationInputs: VehicleValuationInput[];
  startYearMonth: string;
  /** `null` ⇒ zero surplus accrual (bonus still counted when income would apply). */
  monthlyIncome: number | null;
  domainBudgetLines: BudgetLineForDomain[];
  amountOverrideByLineId?: Record<string, number>;
  monthlyGoalContributions: number;
  annualBonusTakeHomeNet: number;
  annualBonusPayoutMonth: number;
  extraMonthlyPlannedSpend?: number;
  incomeGrowthAnnual: number;
  expenseGrowthAnnual: number;
}

/**
 * Single source of truth for the cash/vehicle/surplus terms of the
 * net-worth-by-age chart AND the scalar `projectedAtRetirement`. The per-age
 * accrual is capped at `monthsToRet`, so at the retirement-age point
 * `perAge[i].cash === cashAtRetirementHorizon` exactly (same helper, same
 * months, same args) — the chart cannot diverge from the headline figure.
 * CPF, investments and liabilities are layered on by the caller (unchanged).
 */
export function buildAgeAssetProjection(
  input: AgeAssetProjectionInput
): AgeAssetProjectionResult {
  const accrueSurplus = (months: number) =>
    input.monthlyIncome == null
      ? 0
      : sumInvestableSurplusOverHorizon({
          startYearMonth: input.startYearMonth,
          months,
          monthlyIncome: input.monthlyIncome,
          domainBudgetLines: input.domainBudgetLines,
          amountOverrideByLineId: input.amountOverrideByLineId,
          monthlyGoalContributions: input.monthlyGoalContributions,
          annualBonusTakeHomeNet: input.annualBonusTakeHomeNet,
          annualBonusPayoutMonth: input.annualBonusPayoutMonth,
          extraMonthlyPlannedSpend: input.extraMonthlyPlannedSpend,
          incomeGrowthAnnual: input.incomeGrowthAnnual,
          expenseGrowthAnnual: input.expenseGrowthAnnual,
        });

  const asOfRetirement = addCalendarMonths(input.asOf, input.monthsToRet);
  const vehicleSaleCashAtRet = cumulativeVehicleProceedsToCash(
    input.vehicleValuationInputs,
    asOfRetirement
  );
  const vehiclesNetAtRet = input.vehicleValuationInputs
    .filter((v) => v.vehicleStatus === "active")
    .reduce(
      (s, vi) => s + vehicleNetListedBeforeLiquidation(vi, asOfRetirement),
      0
    );
  const surplusAccrualToRet = accrueSurplus(input.monthsToRet);
  const cashAtRetirementHorizon =
    input.cashTotal + vehicleSaleCashAtRet + surplusAccrualToRet;

  const perAge = input.agePoints.map((p) => {
    const asOfHorizon = addCalendarMonths(input.asOf, p.monthsFromToday);
    const vehicleSaleCash = cumulativeVehicleProceedsToCash(
      input.vehicleValuationInputs,
      asOfHorizon
    );
    const vehiclesNet = input.vehicleValuationInputs
      .filter((v) => v.vehicleStatus === "active")
      .reduce(
        (s, vi) => s + vehicleNetListedBeforeLiquidation(vi, asOfHorizon),
        0
      );
    // Cap at retirement: chart cash must not accrue surplus/bonus past the
    // target retirement age (matches the scalar projectedAtRetirement).
    const surplusAccrual = accrueSurplus(
      Math.min(p.monthsFromToday, input.monthsToRet)
    );
    return {
      age: p.age,
      monthsFromToday: p.monthsFromToday,
      surplusAccrual,
      vehicleSaleCash,
      vehiclesNet,
      cash: input.cashTotal + vehicleSaleCash + surplusAccrual,
    };
  });

  return {
    perAge,
    surplusAccrualToRet,
    vehicleSaleCashAtRet,
    vehiclesNetAtRet,
    cashAtRetirementHorizon,
  };
}
