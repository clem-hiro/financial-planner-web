"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { PurchaseRow } from "@/data/supabase/types";
import {
  buyAdvisorAccessKeysAction,
  validateCouponForPurchaseAction,
  type BuyAccessKeysFormState,
} from "@/server/advisor-key-purchase-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { PageSection } from "@/ui/PageSection";

const initial: BuyAccessKeysFormState = {
  error: null,
  info: null,
  purchaseId: null,
  keys: [],
};

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function purchaseStatusClass(status: PurchaseRow["status"]): string {
  if (status === "fulfilled") return "bg-emerald-50 text-emerald-900 ring-emerald-600/15";
  if (status === "failed" || status === "refunded") {
    return "bg-red-50 text-red-800 ring-red-600/15";
  }
  return "bg-amber-50 text-amber-950 ring-amber-600/20";
}

export function AdvisorBuyKeysSection({
  priceCents,
  currency,
  recentPurchases,
}: {
  priceCents: number;
  currency: string;
  recentPurchases: PurchaseRow[];
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(10);
  const [couponCode, setCouponCode] = useState("POCUNLIMITED");
  const [idempotencyKey, setIdempotencyKey] = useState(makeIdempotencyKey);
  const [quote, setQuote] = useState<{
    ok: boolean;
    message: string | null;
    coupon_code: string;
    quantity: number;
    gross_cents: number;
    discount_cents: number;
    net_cents: number;
  } | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [state, formAction, purchasePending] = useActionState(
    buyAdvisorAccessKeysAction,
    initial
  );
  const busy = quotePending || purchasePending;

  async function checkCoupon() {
    setQuotePending(true);
    const nextGross = quantity * priceCents;
    try {
      const next = await validateCouponForPurchaseAction({ quantity, couponCode });
      setQuote({
        ok: next.ok,
        message: next.message,
        coupon_code: couponCode.trim(),
        quantity,
        gross_cents: next.gross_cents,
        discount_cents: next.discount_cents,
        net_cents: next.net_cents,
      });
    } catch (e) {
      setQuote({
        ok: false,
        message: e instanceof Error ? e.message : "Could not validate coupon.",
        coupon_code: couponCode.trim(),
        quantity,
        gross_cents: nextGross,
        discount_cents: 0,
        net_cents: nextGross,
      });
    } finally {
      setQuotePending(false);
    }
  }

  useEffect(() => {
    if (!state.info) return;
    const timer = window.setTimeout(() => {
      setIdempotencyKey(makeIdempotencyKey());
    }, 0);
    router.refresh();
    return () => window.clearTimeout(timer);
  }, [router, state.info]);

  const totals = useMemo(() => {
    const quoteMatches =
      quote?.coupon_code === couponCode.trim() && quote.quantity === quantity;
    const gross = quoteMatches ? quote.gross_cents : quantity * priceCents;
    const discount = quoteMatches ? quote.discount_cents : 0;
    const net = quoteMatches ? quote.net_cents : gross;
    return { gross, discount, net };
  }, [couponCode, priceCents, quantity, quote]);

  const quoteMatches =
    quote?.coupon_code === couponCode.trim() && quote.quantity === quantity;

  return (
    <div className="space-y-6">
      <PageSection
        id="advisor-buy-keys"
        title="Buy access keys"
        description="Purchase one-time client signup keys. Coupons are validated server-side before fulfillment."
      >
        <form
          action={formAction}
          className="space-y-5"
          {...(busy ? { inert: true } : {})}
        >
          <BlockingSubmitOverlay
            active={busy}
            message={purchasePending ? "Purchasing keys…" : "Checking coupon…"}
          />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-1.5 block">Keys</span>
              <input
                name="quantity"
                type="number"
                min={1}
                max={1000}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-1.5 block">Coupon</span>
              <div className="flex gap-2">
                <input
                  name="coupon_code"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={checkCoupon}
                  disabled={busy}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-900 disabled:opacity-60"
                >
                  {quotePending ? "Checking" : "Check"}
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gross
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatMoney(totals.gross, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coupon
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {quotePending ? "Checking..." : `-${formatMoney(totals.discount, currency)}`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatMoney(totals.net, currency)}
              </p>
            </div>
          </div>

          {quote?.message && quoteMatches ? (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                quote.ok
                  ? "border-emerald-100 bg-emerald-50 text-emerald-900"
                  : "border-red-100 bg-red-50 text-red-800"
              }`}
              role={quote.ok ? "status" : "alert"}
            >
              {quote.message}
            </p>
          ) : null}

          {state.error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.info ? (
            <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">
              <p>{state.info}</p>
              {state.keys.length > 0 ? (
                <div className="grid gap-1 font-mono text-xs">
                  {state.keys.map((key) => (
                    <span key={key} className="truncate">
                      {key}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || (quoteMatches && quote?.ok === false)}
            className="rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {purchasePending ? "Purchasing…" : "Purchase keys"}
          </button>
        </form>
      </PageSection>

      <PageSection
        id="advisor-recent-purchases"
        title="Recent purchases"
        description="Fulfillment history for advisor access keys."
      >
        {recentPurchases.length === 0 ? (
          <p className="text-sm text-slate-600">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Keys</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {new Date(purchase.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-900">
                      {purchase.requested_quantity}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-900">
                      {formatMoney(purchase.net_cents, purchase.currency)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${purchaseStatusClass(purchase.status)}`}
                      >
                        {purchase.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </div>
  );
}
