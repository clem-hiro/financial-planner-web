import type { SupabaseClient } from "@supabase/supabase-js";
import type { PricingRow } from "@/data/supabase/types";

export const ACCESS_KEY_PRODUCT_CODE = "0001";

export async function getPricingByProductCode(
  supabase: SupabaseClient,
  productCode: string
): Promise<PricingRow | null> {
  const { data, error } = await supabase
    .from("pricing")
    .select("*")
    .eq("product_code", productCode)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PricingRow | null;
}
