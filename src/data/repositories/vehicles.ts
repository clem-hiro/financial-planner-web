import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehicleRow } from "@/data/supabase/types";

export async function listVehicles(
  supabase: SupabaseClient,
  userId: string
): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from("financial_vehicles")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VehicleRow[];
}

/**
 * Consent-gated advisor read. Drop-in for `listVehicles` on the advisor path:
 * RPC `returns setof financial_vehicles` ⇒ identical `VehicleRow` shape. Not
 * consented ⇒ zero rows (fail-closed).
 */
export async function advisorReadVehicles(
  supabase: SupabaseClient,
  clientId: string
): Promise<VehicleRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_vehicles", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as VehicleRow[];
}

export type VehicleInsert = {
  label: string;
  vehicle_status: "active" | "planned";
  loan_balance: number;
  loan_monthly_payment: number;
  loan_end_ym: string | null;
  monthly_petrol_cashcard: number;
  annual_insurance: number;
  annual_road_tax: number;
  annual_maintenance: number;
  display_order: number;
};

/** Legacy valuation columns kept at DB defaults — no longer user-facing. */
const LEGACY_VEHICLE_DEFAULTS = {
  current_market_value: null,
  first_registration_ym: null,
  on_the_road_paid: 0,
  arf_for_parf: null,
  body_open_market_at_purchase: null,
  body_depreciation_years: 10,
  coe_expiry_ym: null,
  parf_if_deregistered_today: null,
  coe_if_deregistered_today: null,
  body_scrap_if_deregistered_today: null,
  loan_months_remaining: null,
  loan_prefer_stored_balance: true,
  loan_simple_remaining_estimate: false,
  terminal_recovery_at_coe_expiry: null,
  loan_annual_nominal_rate: null,
} as const;

export async function insertVehicle(
  supabase: SupabaseClient,
  userId: string,
  row: VehicleInsert
): Promise<VehicleRow> {
  const { data, error } = await supabase
    .from("financial_vehicles")
    .insert({
      user_id: userId,
      label: row.label,
      vehicle_status: row.vehicle_status,
      loan_balance: row.loan_balance,
      loan_monthly_payment: row.loan_monthly_payment,
      loan_end_ym: row.loan_end_ym,
      monthly_petrol_cashcard: row.monthly_petrol_cashcard,
      annual_insurance: row.annual_insurance,
      annual_road_tax: row.annual_road_tax,
      annual_maintenance: row.annual_maintenance,
      display_order: row.display_order,
      ...LEGACY_VEHICLE_DEFAULTS,
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
    .from("financial_vehicles")
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
    .from("financial_vehicles")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
