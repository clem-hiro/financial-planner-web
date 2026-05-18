"use client";

import { useMemo } from "react";
import type { HousingPaymentSource } from "@/domain/finance/housing-loan-payments";
import { formatCurrency } from "@/ui/lib/format";

export function HousingPaymentSourceFields({
  paymentSource,
  onPaymentSourceChange,
  monthlyInstalment,
  cpfOaPayment,
  onCpfOaPaymentChange,
  cashPayment,
  onCashPaymentChange,
  currencyCode,
  compact,
}: {
  paymentSource: HousingPaymentSource;
  onPaymentSourceChange: (v: HousingPaymentSource) => void;
  monthlyInstalment: number;
  cpfOaPayment: string;
  onCpfOaPaymentChange: (v: string) => void;
  cashPayment: string;
  onCashPaymentChange: (v: string) => void;
  currencyCode: string;
  compact?: boolean;
}) {
  const instalment = Number.isFinite(monthlyInstalment) ? monthlyInstalment : 0;

  const autoCash = useMemo(() => {
    const cpf = cpfOaPayment.trim() === "" ? NaN : Number(cpfOaPayment);
    if (!Number.isFinite(cpf) || instalment <= 0) return null;
    return Math.max(0, instalment - cpf);
  }, [cpfOaPayment, instalment]);

  const legend = compact
    ? "How you pay each instalment"
    : "Each instalment: payment source";

  return (
    <fieldset className="text-sm sm:col-span-2">
      <legend className="mb-2 font-medium text-zinc-800">{legend}</legend>
      <div className="flex flex-col gap-2">
        <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <input
            type="radio"
            className="mt-0.5"
            checked={paymentSource === "cash"}
            onChange={() => onPaymentSourceChange("cash")}
          />
          <span className="text-xs">
            <strong>Cash</strong> — full instalment counts in monthly budget and
            safe-to-spend; OA projection unchanged.
          </span>
        </label>
        <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <input
            type="radio"
            className="mt-0.5"
            checked={paymentSource === "cpf_oa"}
            onChange={() => onPaymentSourceChange("cpf_oa")}
          />
          <span className="text-xs">
            <strong>CPF OA</strong> — reduces OA in CPF projection only; not
            deducted from monthly cash budgeting.
          </span>
        </label>
        <label className="inline-flex cursor-pointer items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2">
          <input
            type="radio"
            className="mt-0.5"
            checked={paymentSource === "split"}
            onChange={() => onPaymentSourceChange("split")}
          />
          <span className="text-xs">
            <strong>Split</strong> — enter OA portion; cash portion fills the rest
            (editable).
          </span>
        </label>
      </div>
      {instalment > 0 && (
        <p className="mt-2 text-xs text-zinc-600">
          Estimated monthly instalment (total):{" "}
          <strong>{formatCurrency(instalment, currencyCode)}</strong>
        </p>
      )}
      {paymentSource === "split" && instalment > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block text-zinc-600">CPF OA portion / month</span>
            <input
              name="cpf_oa_payment"
              type="number"
              min={0}
              max={instalment}
              step="0.01"
              value={cpfOaPayment}
              onChange={(e) => {
                onCpfOaPaymentChange(e.target.value);
                const cpf = Number(e.target.value);
                if (Number.isFinite(cpf) && instalment > 0) {
                  onCashPaymentChange(
                    String(Math.max(0, Math.round((instalment - cpf) * 100) / 100))
                  );
                }
              }}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1.5"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-zinc-600">Cash portion / month</span>
            <input
              name="cash_payment"
              type="number"
              min={0}
              max={instalment}
              step="0.01"
              value={cashPayment}
              onChange={(e) => onCashPaymentChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1.5"
            />
            {autoCash != null &&
              cashPayment.trim() !== "" &&
              Math.abs(Number(cashPayment) - autoCash) > 0.02 && (
                <p className="mt-1 text-[10px] text-amber-800">
                  Suggested cash: {formatCurrency(autoCash, currencyCode)}
                </p>
              )}
          </label>
        </div>
      )}
      <input type="hidden" name="payment_source" value={paymentSource} />
    </fieldset>
  );
}
