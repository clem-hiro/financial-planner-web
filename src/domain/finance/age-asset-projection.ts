import { addCalendarMonths } from "@/lib/dates";
import { accrueTakeHomeSurplus } from "./cash-flow-accrual";
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
  monthlyIncome: number | null;
  monthlyExpenses: number;
  monthlyGoalContrib: number;
  annualBonusNet: number;
  bonusPayoutMonth: number;
  startYearMonth: string;
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
  const accrualBase = {
    monthlyIncome: input.monthlyIncome,
    monthlyExpenses: input.monthlyExpenses,
    monthlyGoalContrib: input.monthlyGoalContrib,
    annualBonusNet: input.annualBonusNet,
    bonusPayoutMonth: input.bonusPayoutMonth,
    startYearMonth: input.startYearMonth,
    incomeGrowthAnnual: input.incomeGrowthAnnual,
    expenseGrowthAnnual: input.expenseGrowthAnnual,
  };

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
  const surplusAccrualToRet = accrueTakeHomeSurplus({
    ...accrualBase,
    months: input.monthsToRet,
  });
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
    const surplusAccrual = accrueTakeHomeSurplus({
      ...accrualBase,
      months: Math.min(p.monthsFromToday, input.monthsToRet),
    });
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
