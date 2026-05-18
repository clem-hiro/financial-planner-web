/**
 * Pure totals derivation for the advisor Buy-keys form. Kept React-free so it
 * is unit-testable under the node test env and reusable outside the component.
 *
 * Why the `ok` gate: a failed/!ok preview quote (e.g. "Coupon not found.")
 * carries gross/discount/net = 0 — `parseAccessKeyPurchaseQuote` maps absent
 * RPC money fields through `readNumber`, whose default is 0. Trusting those
 * zeros rendered a misleading $0.00 Gross/Total ("looks free"). Only trust the
 * quote's money fields when it SUCCEEDED and still matches the current
 * coupon+quantity; otherwise fall back to the uncouponed price.
 */
export type BuyKeysQuote = {
  ok: boolean;
  coupon_code: string;
  quantity: number;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
} | null;

export function deriveBuyKeysTotals(args: {
  quote: BuyKeysQuote;
  couponCode: string;
  quantity: number;
  priceCents: number;
}): { gross: number; discount: number; net: number } {
  const { quote, couponCode, quantity, priceCents } = args;
  const trustQuote =
    quote?.ok === true &&
    quote.coupon_code === couponCode.trim() &&
    quote.quantity === quantity;
  const gross = trustQuote ? quote.gross_cents : quantity * priceCents;
  const discount = trustQuote ? quote.discount_cents : 0;
  const net = trustQuote ? quote.net_cents : gross;
  return { gross, discount, net };
}
