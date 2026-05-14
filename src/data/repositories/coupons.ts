import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCESS_KEY_PRODUCT_CODE } from "@/data/repositories/pricing";

export type AccessKeyPurchaseQuote = {
  ok: boolean;
  message: string | null;
  product_code: string;
  quantity: number;
  currency: string;
  unit_price_cents: number;
  free_key_quantity: number;
  paid_key_quantity: number;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  coupon_code: string | null;
};

export type AccessKeyPurchaseResult = {
  ok: boolean;
  message: string | null;
  purchase_id: string | null;
  keys: string[];
};

export type AdvisorContactResult = {
  available: boolean;
  message: string | null;
  advisor_name: string | null;
  whatsapp_url: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseAccessKeyPurchaseQuote(raw: unknown): AccessKeyPurchaseQuote {
  const r = asRecord(raw);
  return {
    ok: r.ok === true,
    message: readString(r.message),
    product_code: readString(r.product_code) ?? ACCESS_KEY_PRODUCT_CODE,
    quantity: readNumber(r.quantity),
    currency: readString(r.currency) ?? "SGD",
    unit_price_cents: readNumber(r.unit_price_cents),
    free_key_quantity: readNumber(r.free_key_quantity),
    paid_key_quantity: readNumber(r.paid_key_quantity),
    gross_cents: readNumber(r.gross_cents),
    discount_cents: readNumber(r.discount_cents),
    net_cents: readNumber(r.net_cents),
    coupon_code: readString(r.coupon_code),
  };
}

export function parseAccessKeyPurchaseResult(raw: unknown): AccessKeyPurchaseResult {
  const r = asRecord(raw);
  const keys = Array.isArray(r.keys)
    ? r.keys.filter((k): k is string => typeof k === "string")
    : [];
  return {
    ok: r.ok === true,
    message: readString(r.message),
    purchase_id: readString(r.purchase_id),
    keys,
  };
}

export function parseAdvisorContactResult(raw: unknown): AdvisorContactResult {
  const r = asRecord(raw);
  return {
    available: r.available === true,
    message: readString(r.message),
    advisor_name: readString(r.advisor_name),
    whatsapp_url: readString(r.whatsapp_url),
  };
}

export async function validateCouponForPurchase(
  supabase: SupabaseClient,
  quantity: number,
  couponCode: string
): Promise<AccessKeyPurchaseQuote> {
  const { data, error } = await supabase.rpc("validate_coupon_for_purchase", {
    p_product_code: ACCESS_KEY_PRODUCT_CODE,
    p_quantity: quantity,
    p_coupon_code: couponCode.trim() || null,
  });
  if (error) throw error;
  return parseAccessKeyPurchaseQuote(data);
}

export async function fulfillAccessKeyPurchase(
  supabase: SupabaseClient,
  quantity: number,
  idempotencyKey: string,
  couponCode: string
): Promise<AccessKeyPurchaseResult> {
  const { data, error } = await supabase.rpc("fulfill_access_key_purchase", {
    p_product_code: ACCESS_KEY_PRODUCT_CODE,
    p_quantity: quantity,
    p_idempotency_key: idempotencyKey,
    p_coupon_code: couponCode.trim() || null,
  });
  if (error) throw error;
  return parseAccessKeyPurchaseResult(data);
}

export async function getMyAdvisorContact(
  supabase: SupabaseClient
): Promise<AdvisorContactResult> {
  const { data, error } = await supabase.rpc("get_my_advisor_contact");
  if (error) throw error;
  return parseAdvisorContactResult(data);
}
