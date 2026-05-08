"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  createVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
} from "@/server/actions";
import type { VehicleRow } from "@/data/supabase/types";
import { vehicleRowToValuationInput } from "@/data/mappers";
import {
  bodyValueEstimate,
  effectiveLoanBalance,
  loanMonthsRemainingResolved,
  parfRebateEstimateIllustrative,
  usesDeregistrationAnchors,
  usesMarketValueGross,
  usesPurchaseToCoeTerminalSchedule,
  usesRebateRemainingToTerminal,
  usesNoParfBasisImplicitWithCoeTaper,
  vehicleGrossAssetEstimate,
  vehicleGrossAssetFromDeregistrationAnchors,
  vehicleGrossFromPurchaseToTerminalLinear,
  vehicleNetEquity,
} from "@/domain/finance";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { formatCurrency } from "@/ui/lib/format";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpPrimaryButtonClass,
  fpSelectClass,
} from "@/ui/input-classes";

const initial = { error: null as string | null };

function VehicleSummary({
  row,
  currencyCode,
}: {
  row: VehicleRow;
  currencyCode: string;
}) {
  const asOf = new Date();
  const input = vehicleRowToValuationInput(row);
  if (input.vehicleStatus === "planned") {
    return (
      <p className="text-xs text-zinc-600">
        Planned · budget / OTR {formatCurrency(input.onTheRoadPaid, currencyCode)}{" "}
        — not counted in net worth until status is Active.
      </p>
    );
  }
  const loan = effectiveLoanBalance(input, asOf);
  const gross = vehicleGrossAssetEstimate(input, asOf);
  const net = vehicleNetEquity(input, asOf);
  const nRem = loanMonthsRemainingResolved(input, asOf);
  const fromMarket = usesMarketValueGross(input);
  const fromRebateRamp = usesRebateRemainingToTerminal(input);
  const fromPurchaseSchedule = usesPurchaseToCoeTerminalSchedule(input);
  const fromLta = usesDeregistrationAnchors(input);
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
      {fromMarket ? (
        <li>
          Gross from your <strong>current market estimate</strong> (e.g. motorcycle
          listings):{" "}
          {formatCurrency(
            input.currentMarketValue ?? 0,
            currencyCode
          )}
          <span className="mt-0.5 block text-zinc-500">
            Clear this field to use PARF/COE or other paths below. Re-check Carousell
            / dealers periodically and update the number. By-age projections do not add
            this amount to cash at COE (no assumed sale/rebate); the asset drops off
            after expiry unless you use a rebate or terminal schedule below.
          </span>
        </li>
      ) : fromRebateRamp ? (
        <li>
          Gross asset ramps from your <strong>PARF+COE (+ scrap)</strong> toward{" "}
          <strong>terminal at COE expiry</strong> by month:{" "}
          {formatCurrency(vehicleGrossAssetEstimate(input, asOf), currencyCode)}
          <span className="mt-0.5 block text-zinc-500">
            Formula: terminal + (rebates today − terminal) × (months left to COE ÷
            months from first reg to COE). Instalment does not change this — it only
            affects loan / net equity.
          </span>
        </li>
      ) : fromPurchaseSchedule ? (
        <li>
          Gross from <strong>OTR → terminal at COE expiry</strong> (straight line
          from first reg to expected rebates+body):{" "}
          {formatCurrency(
            vehicleGrossFromPurchaseToTerminalLinear(input, asOf),
            currencyCode
          )}
          <span className="mt-0.5 block text-zinc-500">
            OTR {formatCurrency(input.onTheRoadPaid, currencyCode)} at{" "}
            {input.firstRegistrationYm} →{" "}
            {formatCurrency(
              input.terminalRecoveryAtCoeExpiry ?? 0,
              currencyCode
            )}{" "}
            by COE {input.coeExpiryYm}. PARF/COE &quot;today&quot; rows are not used
            for this gross while this field is set.
          </span>
        </li>
      ) : fromLta ? (
        <li>
          Asset from <strong>PARF + COE (+ body/scrap if entered)</strong> as at
          deregistration today:{" "}
          {formatCurrency(
            vehicleGrossAssetFromDeregistrationAnchors(input),
            currencyCode
          )}
          {input.coeExpiryYm != null && (
            <span className="text-zinc-500">
              {" "}
              · COE expires {input.coeExpiryYm}
            </span>
          )}
        </li>
      ) : usesNoParfBasisImplicitWithCoeTaper(input) ? (
        <li>
          <strong>No PARF/COE “today” and ARF for PARF blank</strong> with first reg +
          COE expiry: modelled gross is tapered to <strong>zero</strong> by{" "}
          <strong>{input.coeExpiryYm}</strong> so the dashboard does not add cash
          proceeds at COE you would not receive (typical for many motorcycles).
          Today&apos;s gross: {formatCurrency(gross, currencyCode)}. Use{" "}
          <strong>market estimate</strong> above for a resale-style value, or fill
          PARF+COE / terminal recovery if rebates apply.
        </li>
      ) : (
        <li>
          Modelled asset: illustrative PARF{" "}
          {formatCurrency(
            parfRebateEstimateIllustrative(
              input.arfForParf ?? 0,
              input.firstRegistrationYm,
              asOf
            ),
            currencyCode
          )}{" "}
          + straight-line body{" "}
          {formatCurrency(bodyValueEstimate(input, asOf), currencyCode)} ={" "}
          {formatCurrency(gross, currencyCode)}
          <span className="mt-0.5 block text-zinc-500">
            (Fill PARF/COE “today” above to use OneMotoring numbers instead.{" "}
            <em>Body depreciate years</em> is only for this fallback: years to
            write off the body portion from first registration.)
          </span>
        </li>
      )}
      <li>
        Loan:{" "}
        {nRem != null ? (
          <span>~{nRem} mo to end · </span>
        ) : null}
        {input.loanPreferStoredBalance
          ? "Typed balance"
          : input.loanSimpleRemainingEstimate === true
            ? "Instalment × months"
            : "PV from instalment"}{" "}
        {formatCurrency(loan, currencyCode)} · Net:{" "}
        <span className={net >= 0 ? "font-medium text-zinc-800" : "text-rose-700"}>
          {formatCurrency(net, currencyCode)}
        </span>
      </li>
    </ul>
  );
}

function vehicleMoneyDefault(
  v: string | null | undefined
): number | "" {
  if (v == null || String(v).trim() === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function MarketValueFields({
  row,
  currencyCode,
}: {
  row?: VehicleRow;
  currencyCode: string;
}) {
  return (
    <div className="rounded-md border border-sky-200/70 bg-sky-50/50 p-3 sm:col-span-2">
      <p className="mb-2 text-xs font-semibold text-sky-950">
        Market value (motorcycles, etc.)
      </p>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600">
          Current market / listing estimate ({currencyCode})
        </span>
        <input
          name="current_market_value"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.current_market_value)}
          className={fpInputClass}
          placeholder="e.g. 14300"
        />
      </label>
      <p className="mt-2 text-[11px] leading-relaxed text-sky-900/85">
        Enter one current resale estimate. Leave PARF/COE blank if using this method.
      </p>
    </div>
  );
}

function OneMotoringFields({
  row,
  currencyCode,
}: {
  row?: VehicleRow;
  currencyCode: string;
}) {
  return (
    <div className="rounded-md border border-teal-200/60 bg-teal-50/40 p-3 sm:col-span-2">
      <p className="mb-2 text-xs font-semibold text-teal-950">
        OneMotoring / LTA (cars — skip if you use market value above)
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">COE expiry (YYYY-MM)</span>
          <input
            name="coe_expiry_ym"
            type="text"
            defaultValue={row?.coe_expiry_ym ?? ""}
            placeholder="2034-05"
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Loan ends (YYYY-MM)</span>
          <input
            name="loan_end_ym"
            type="text"
            defaultValue={row?.loan_end_ym ?? ""}
            placeholder="2028-11"
            className={fpInputClass}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">
            PARF rebate if deregistered today ({currencyCode})
          </span>
          <input
            name="parf_if_deregistered_today"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicleMoneyDefault(row?.parf_if_deregistered_today)}
            className={fpInputClass}
          />
          <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">
            Use the PARF value shown in OneMotoring.
          </span>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">
            Body / scrap if deregistered today ({currencyCode}, optional)
          </span>
          <input
            name="body_scrap_if_deregistered_today"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicleMoneyDefault(row?.body_scrap_if_deregistered_today)}
            className={fpInputClass}
          />
          <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500">
            Optional. Add scrap/export value not included in PARF.
          </span>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">
            COE rebate if deregistered today ({currencyCode})
          </span>
          <input
            name="coe_if_deregistered_today"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicleMoneyDefault(row?.coe_if_deregistered_today)}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">
            Monthly instalment ({currencyCode})
          </span>
          <input
            name="loan_monthly_payment"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={row != null ? Number(row.loan_monthly_payment) : 0}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">
            Loan balance ({currencyCode}, optional)
          </span>
          <input
            name="loan_balance"
            type="number"
            min={0}
            step="0.01"
            defaultValue={row != null ? Number(row.loan_balance) : 0}
            className={fpInputClass}
          />
          <span className="mt-0.5 block text-[10px] text-zinc-500">
            Optional. Fill only if you want to use the exact statement balance.
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs sm:col-span-2">
          <input
            type="checkbox"
            name="loan_simple_remaining_estimate"
            value="on"
            defaultChecked={row?.loan_simple_remaining_estimate === true}
            disabled={row?.loan_prefer_stored_balance === true}
            className="size-3.5 rounded border-zinc-300 enabled:cursor-pointer disabled:opacity-40"
          />
          <span className="text-zinc-600">
            Simple estimate: instalment x months left.
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs sm:col-span-2">
          <input
            type="checkbox"
            name="loan_prefer_stored_balance"
            value="on"
            defaultChecked={row?.loan_prefer_stored_balance === true}
            className="size-3.5 rounded border-zinc-300"
          />
          <span className="text-zinc-600">
            Use typed loan balance for net worth (dealer/bank payoff figure)
          </span>
        </label>
      </div>
    </div>
  );
}

function PurchaseToCoeTerminalFields({
  row,
  currencyCode,
}: {
  row?: VehicleRow;
  currencyCode: string;
}) {
  return (
    <div className="rounded-md border border-violet-200/70 bg-violet-50/40 p-3 sm:col-span-2">
      <p className="mb-2 text-xs font-semibold text-violet-950">
        OTR → COE expiry (optional)
      </p>
      <p className="mb-2 text-[11px] leading-relaxed text-violet-900/80">
        Optional. Use when you want to model value from purchase price to COE expiry.
      </p>
      <label className="text-xs">
        <span className="mb-0.5 block text-zinc-600">
          Expected total back at COE expiry — rebates + body ({currencyCode})
        </span>
        <input
          name="terminal_recovery_at_coe_expiry"
          type="number"
          min={0}
          step="0.01"
          defaultValue={vehicleMoneyDefault(row?.terminal_recovery_at_coe_expiry)}
          className={fpInputClass}
          placeholder="e.g. 6000"
        />
      </label>
    </div>
  );
}

function AdvancedModelFields({ row }: { row?: VehicleRow }) {
  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900">
        Advanced (OTR / first reg / fallback model)
      </summary>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        Optional fields for detailed modelling.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">
            First reg YYYY-MM (purchase month)
          </span>
          <input
            name="first_registration_ym"
            type="text"
            defaultValue={row?.first_registration_ym ?? ""}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">OTR / paid</span>
          <input
            name="on_the_road_paid"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={row != null ? Number(row.on_the_road_paid) : 0}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">ARF for PARF</span>
          <input
            name="arf_for_parf"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicleMoneyDefault(row?.arf_for_parf)}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Body at purchase (optional)</span>
          <input
            name="body_open_market_at_purchase"
            type="number"
            min={0}
            step="0.01"
            defaultValue={vehicleMoneyDefault(row?.body_open_market_at_purchase)}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Body depreciate (years)</span>
          <input
            name="body_depreciation_years"
            type="number"
            min={1}
            max={20}
            required
            defaultValue={row?.body_depreciation_years ?? 10}
            className={fpInputNarrowClass}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Months remaining (override)</span>
          <input
            name="loan_months_remaining"
            type="number"
            min={0}
            defaultValue={row?.loan_months_remaining ?? ""}
            className={fpInputNarrowClass}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Loan annual rate (decimal)</span>
          <input
            name="loan_annual_nominal_rate"
            type="number"
            min={0}
            max={0.5}
            step="0.0001"
            defaultValue={vehicleMoneyDefault(row?.loan_annual_nominal_rate)}
            placeholder="0.0278"
            className={fpInputClass}
          />
        </label>
      </div>
    </details>
  );
}

function VehicleEditForm({
  row,
  currencyCode,
}: {
  row: VehicleRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateVehicleAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, action] = useActionState(wrapped, initial);
  return (
    <form action={action} className="mt-2 space-y-2 rounded border border-zinc-200 bg-white p-3">
      <input type="hidden" name="id" value={row.id} />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Label</span>
          <input
            name="label"
            type="text"
            defaultValue={row.label}
            className={fpInputClass}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Status</span>
          <select
            name="vehicle_status"
            className={fpSelectClass}
            defaultValue={row.vehicle_status}
          >
            <option value="active">Active (in net worth)</option>
            <option value="planned">Planned future (not in net worth)</option>
          </select>
        </label>
        <MarketValueFields row={row} currencyCode={currencyCode} />
        <OneMotoringFields row={row} currencyCode={currencyCode} />
        <PurchaseToCoeTerminalFields row={row} currencyCode={currencyCode} />
        <AdvancedModelFields row={row} />
      </div>
      <div className="flex justify-end">
        <button type="submit" className={fpPrimaryButtonClass}>
          Save vehicle
        </button>
      </div>
    </form>
  );
}

function AddVehicleForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await createVehicleAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, action] = useActionState(wrapped, initial);
  return (
    <form
      action={action}
      className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-4"
    >
      <p className="mb-2 text-sm font-medium text-zinc-800">Add vehicle</p>
      {state.error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Label</span>
          <input name="label" type="text" placeholder="Car" className={fpInputClass} />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Status</span>
          <select name="vehicle_status" className={fpSelectClass} defaultValue="active">
            <option value="active">Active</option>
            <option value="planned">Planned future</option>
          </select>
        </label>
        <MarketValueFields currencyCode={currencyCode} />
        <OneMotoringFields currencyCode={currencyCode} />
        <PurchaseToCoeTerminalFields currencyCode={currencyCode} />
        <AdvancedModelFields />
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" className={fpPrimaryButtonClass}>
          Add vehicle
        </button>
      </div>
    </form>
  );
}

export function VehiclesPanel({
  vehicles,
  currencyCode,
}: {
  vehicles: VehicleRow[];
  currencyCode: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 text-xs text-amber-950">
        <strong className="font-semibold">Tip:</strong> keep each vehicle loan in one place only
        (here or Debts) to avoid double-counting.{" "}
        <MethodologyOpenLink topicId="vehicles-sg" className={appInlineLinkClass}>
          Methodology →
        </MethodologyOpenLink>
        </div>
        <p className="text-xs text-zinc-600">
          Quick start: enter <strong>current market estimate</strong> and monthly loan instalment.
          Add PARF/COE or advanced fields only if you want a more detailed model.
        </p>
      </div>
      <div className="p-4 sm:p-5">
        <AddVehicleForm currencyCode={currencyCode} />
      </div>
      {vehicles.length > 0 && (
        <ul className="space-y-3 p-4 sm:p-5">
          {vehicles.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{row.label}</p>
                  <p className="text-xs capitalize text-zinc-500">
                    {row.vehicle_status === "planned" ? "Planned" : "Active"}
                  </p>
                </div>
                <form action={deleteVehicleAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-rose-700 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              </div>
              <VehicleSummary row={row} currencyCode={currencyCode} />
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900">
                  Edit
                </summary>
                <VehicleEditForm row={row} currencyCode={currencyCode} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
