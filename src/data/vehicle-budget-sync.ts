import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteBudgetLine,
  getBudgetLinesBySourceVehicleId,
  insertBudgetLine,
  updateBudgetLine,
} from "@/data/repositories/budget-lines";
import type { VehicleRow } from "@/data/supabase/types";
import {
  vehicleBudgetCategoryName,
  type VehicleBudgetSlot,
  VEHICLE_BUDGET_SLOTS,
} from "@/domain/finance/vehicle-budget";
import { formatYearMonth } from "@/lib/dates";

function num(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : 0;
}

type SlotConfig = {
  slot: VehicleBudgetSlot;
  cadence: "monthly" | "annual";
  amount: number;
  endYearMonth?: string | null;
};

function slotConfigsForVehicle(row: VehicleRow): SlotConfig[] {
  const loanEnd = row.loan_end_ym?.trim() || null;
  return [
    {
      slot: "loan_repayment",
      cadence: "monthly",
      amount: num(row.loan_monthly_payment),
      endYearMonth: loanEnd,
    },
    {
      slot: "petrol",
      cadence: "monthly",
      amount: num(row.monthly_petrol_cashcard),
    },
    {
      slot: "insurance",
      cadence: "annual",
      amount: num(row.annual_insurance),
    },
    {
      slot: "road_tax",
      cadence: "annual",
      amount: num(row.annual_road_tax),
    },
    {
      slot: "maintenance",
      cadence: "annual",
      amount: num(row.annual_maintenance),
    },
  ];
}

/**
 * Keeps vehicle-linked budget lines in sync with running costs.
 * Loan repayment lines are for monthly cash-flow planning; projections use the debt ledger.
 */
export async function syncVehicleBudgetLines(
  supabase: SupabaseClient,
  userId: string,
  vehicle: VehicleRow
): Promise<void> {
  const referenceYm = formatYearMonth(new Date());
  const calendarYear = new Date().getFullYear();
  const existing = await getBudgetLinesBySourceVehicleId(
    supabase,
    userId,
    vehicle.id
  );
  const existingBySlot = new Map(
    existing
      .filter((line) => line.vehicle_budget_slot != null)
      .map((line) => [line.vehicle_budget_slot as VehicleBudgetSlot, line])
  );

  for (const config of slotConfigsForVehicle(vehicle)) {
    const line = existingBySlot.get(config.slot);
    if (config.amount <= 0) {
      if (line) {
        await deleteBudgetLine(supabase, userId, line.id);
      }
      continue;
    }

    const category = vehicleBudgetCategoryName(config.slot, vehicle.label);
    if (line) {
      if (config.cadence === "monthly") {
        await updateBudgetLine(supabase, userId, line.id, {
          category,
          amount: config.amount,
          start_year_month: referenceYm,
          end_year_month: config.endYearMonth ?? null,
        });
      } else {
        await updateBudgetLine(supabase, userId, line.id, {
          category,
          amount: config.amount,
          calendar_year: calendarYear,
        });
      }
      continue;
    }

    await insertBudgetLine(supabase, userId, {
      category,
      cadence: config.cadence,
      amount: config.amount,
      calendar_year: config.cadence === "annual" ? calendarYear : null,
      start_year_month: config.cadence === "monthly" ? referenceYm : null,
      end_year_month:
        config.cadence === "monthly" ? (config.endYearMonth ?? null) : null,
      source_vehicle_id: vehicle.id,
      vehicle_budget_slot: config.slot,
    });
  }

  for (const line of existing) {
    if (
      line.vehicle_budget_slot != null &&
      !VEHICLE_BUDGET_SLOTS.includes(line.vehicle_budget_slot as VehicleBudgetSlot)
    ) {
      await deleteBudgetLine(supabase, userId, line.id);
    }
  }
}

export async function removeVehicleBudgetLines(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string
): Promise<void> {
  const existing = await getBudgetLinesBySourceVehicleId(
    supabase,
    userId,
    vehicleId
  );
  for (const line of existing) {
    await deleteBudgetLine(supabase, userId, line.id);
  }
}
