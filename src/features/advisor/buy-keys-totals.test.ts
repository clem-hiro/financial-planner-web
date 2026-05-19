import { describe, expect, it } from "vitest";
import { deriveBuyKeysTotals } from "./buy-keys-totals";

const PRICE = 500; // cents per key
const QTY = 10;
const uncouponedGross = QTY * PRICE; // 5000

describe("deriveBuyKeysTotals", () => {
  // Task #8 core regression. An invalid-coupon preview is exactly this shape:
  // parseAccessKeyPurchaseQuote maps the RPC's absent money fields through
  // readNumber (default 0), so a !ok quote carries gross/discount/net = 0.
  // Trusting it showed a misleading $0.00 ("looks free"). It must fall back.
  it("failed/!ok quote does NOT zero gross — falls back to quantity*priceCents", () => {
    const t = deriveBuyKeysTotals({
      quote: {
        ok: false,
        coupon_code: "BADCODE",
        quantity: QTY,
        gross_cents: 0,
        discount_cents: 0,
        net_cents: 0,
      },
      couponCode: "BADCODE",
      quantity: QTY,
      priceCents: PRICE,
    });
    expect(t.gross).toBe(uncouponedGross);
    expect(t.discount).toBe(0);
    expect(t.net).toBe(uncouponedGross);
  });

  it("ok quote matching coupon+quantity trusts the server money fields", () => {
    const t = deriveBuyKeysTotals({
      quote: {
        ok: true,
        coupon_code: "SAVE20",
        quantity: QTY,
        gross_cents: 5000,
        discount_cents: 1000,
        net_cents: 4000,
      },
      couponCode: "SAVE20",
      quantity: QTY,
      priceCents: PRICE,
    });
    expect(t).toEqual({ gross: 5000, discount: 1000, net: 4000 });
  });

  it("ok quote but coupon edited after Check ⇒ fallback (stale quote not trusted)", () => {
    const t = deriveBuyKeysTotals({
      quote: {
        ok: true,
        coupon_code: "SAVE20",
        quantity: QTY,
        gross_cents: 5000,
        discount_cents: 1000,
        net_cents: 4000,
      },
      couponCode: "SAVE50",
      quantity: QTY,
      priceCents: PRICE,
    });
    expect(t).toEqual({
      gross: uncouponedGross,
      discount: 0,
      net: uncouponedGross,
    });
  });

  it("ok quote but quantity changed after Check ⇒ fallback", () => {
    const t = deriveBuyKeysTotals({
      quote: {
        ok: true,
        coupon_code: "SAVE20",
        quantity: QTY,
        gross_cents: 5000,
        discount_cents: 1000,
        net_cents: 4000,
      },
      couponCode: "SAVE20",
      quantity: QTY + 5,
      priceCents: PRICE,
    });
    expect(t.gross).toBe((QTY + 5) * PRICE);
    expect(t.discount).toBe(0);
    expect(t.net).toBe((QTY + 5) * PRICE);
  });

  it("no quote (never checked) ⇒ uncouponed totals", () => {
    const t = deriveBuyKeysTotals({
      quote: null,
      couponCode: "",
      quantity: QTY,
      priceCents: PRICE,
    });
    expect(t).toEqual({
      gross: uncouponedGross,
      discount: 0,
      net: uncouponedGross,
    });
  });

  it("matches the trimmed coupon code (input whitespace tolerated)", () => {
    const t = deriveBuyKeysTotals({
      quote: {
        ok: true,
        coupon_code: "SAVE20",
        quantity: QTY,
        gross_cents: 5000,
        discount_cents: 1000,
        net_cents: 4000,
      },
      couponCode: "  SAVE20  ",
      quantity: QTY,
      priceCents: PRICE,
    });
    expect(t).toEqual({ gross: 5000, discount: 1000, net: 4000 });
  });
});
