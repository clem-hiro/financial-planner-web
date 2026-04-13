import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleRow } from "@/data/supabase/types";

export async function listVehicles(
  supabase: SupabaseClient,
  userId: string
): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VehicleRow[];
}

export type VehicleInsert = {
  label: string;
  vehicle_status: "active" | "planned";
  current_market_value: number | null;
  first_registration_ym: string | null;
  on_the_road_paid: number;
  arf_for_parf: number | null;
  body_open_market_at_purchase: number | null;
  body_depreciation_years: number;
  coe_expiry_ym: string | null;
  parf_if_deregistered_today: number | null;
  coe_if_deregistered_today: number | null;
  body_scrap_if_deregistered_today: number | null;
  loan_balance: number;
  loan_monthly_payment: number;
  loan_months_remaining: number | null;
  loan_end_ym: string | null;
  loan_prefer_stored_balance: boolean;
  loan_simple_remaining_estimate: boolean;
  terminal_recovery_at_coe_expiry: number | null;
  loan_annual_nominal_rate: number | null;
  display_order: number;
};

export async function insertVehicle(
  supabase: SupabaseClient,
  userId: string,
  row: VehicleInsert
): Promise<VehicleRow> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      user_id: userId,
      label: row.label,
      vehicle_status: row.vehicle_status,
      current_market_value: row.current_market_value,
      first_registration_ym: row.first_registration_ym,
      on_the_road_paid: row.on_the_road_paid,
      arf_for_parf: row.arf_for_parf,
      body_open_market_at_purchase: row.body_open_market_at_purchase,
      body_depreciation_years: row.body_depreciation_years,
      coe_expiry_ym: row.coe_expiry_ym,
      parf_if_deregistered_today: row.parf_if_deregistered_today,
      coe_if_deregistered_today: row.coe_if_deregistered_today,
      body_scrap_if_deregistered_today: row.body_scrap_if_deregistered_today,
      loan_balance: row.loan_balance,
      loan_monthly_payment: row.loan_monthly_payment,
      loan_months_remaining: row.loan_months_remaining,
      loan_end_ym: row.loan_end_ym,
      loan_prefer_stored_balance: row.loan_prefer_stored_balance,
      loan_simple_remaining_estimate: row.loan_simple_remaining_estimate,
      terminal_recovery_at_coe_expiry: row.terminal_recovery_at_coe_expiry,
      loan_annual_nominal_rate: row.loan_annual_nominal_rate,
      display_order: row.display_order,
    })
    .select()
    .single();
  if (error) throw error;
  return data as VehicleRow;
}

export async function updateVehicle(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<VehicleInsert>
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteVehicle(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
