"use client";

import Link from "next/link";
import type { InvestmentPlanNature } from "@/lib/investment-plan-nature";

export function InvestmentPlanGuidancePanel({
  planNature,
  onPlanNatureChange,
}: {
  planNature: InvestmentPlanNature | "";
  onPlanNatureChange: (value: InvestmentPlanNature | "") => void;
}) {
  return (
    <div className="space-y-3">
      <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900">
        <legend className="text-sm font-medium text-slate-800 dark:text-slate-100">
          What is this plan mainly for?
        </legend>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-300">
          Helps place ILPs and similar products (e.g. PruVantage) in the right
          workspace. You can still record it here either way — see the note below.
        </p>
        <div className="mt-3 space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="radio"
              name="plan_nature"
              value="pure_investment"
              className="mt-0.5"
              checked={planNature === "pure_investment"}
              onChange={() => onPlanNatureChange("pure_investment")}
            />
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-50">
                Pure investment / savings
              </span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-300">
                Brokerage, SRS, robo, endowment focused on accumulation — no
                meaningful life/health cover bundled in.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="radio"
              name="plan_nature"
              value="includes_insurance_coverage"
              className="mt-0.5"
              checked={planNature === "includes_insurance_coverage"}
              onChange={() => onPlanNatureChange("includes_insurance_coverage")}
            />
            <span>
              <span className="font-medium text-slate-900 dark:text-slate-50">
                Investment-linked plan (ILP) or bundled cover
              </span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-300">
                Premiums partly fund protection (e.g. PruVantage, many ILPs).
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {planNature === "pure_investment" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs leading-relaxed text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-400/12 dark:text-emerald-100">
          <strong className="font-semibold">Investments is the right place.</strong>{" "}
          Enter fund value and premiums here for wealth projections. When{" "}
          <Link href="/setup?tab=protection" className="font-medium underline">
            Protection → Insurance
          </Link>{" "}
          ships, you will not need to duplicate the same dollars there.
        </p>
      ) : null}

      {planNature === "includes_insurance_coverage" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-300/45 dark:bg-amber-300/12 dark:text-amber-100">
          <strong className="font-semibold">Use both sections for different facts.</strong>{" "}
          Record <em>investment value and premiums</em> here for net worth and
          retirement charts. When insurance tracking is available under{" "}
          <Link href="/setup?tab=protection" className="font-medium underline">
            Protection
          </Link>
          , add <em>coverage sums and riders</em> there — not the same fields twice.
        </p>
      ) : null}

      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-slate-600/80 dark:bg-slate-800/70 dark:text-slate-300">
        <strong className="font-medium text-slate-700 dark:text-slate-100">
          Avoid double counting.
        </strong>{" "}
        Each plan should appear once in Investments for balances and premium timing.
        Do not add the same policy again as a separate “insurance premium” budget line
        unless you are modeling cash outflow only (and then exclude it here).
      </p>
    </div>
  );
}
