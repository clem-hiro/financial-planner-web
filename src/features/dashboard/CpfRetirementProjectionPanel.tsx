"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildCpfRetirementProjection,
  CPF_FRS_BASE_COHORT_YEAR,
  CPF_RA_FORMATION_AGE,
  CPF_SCENARIO_EXAMPLES,
  CURRENT_FRS_SG,
  DEFAULT_CPF_ASSUMPTIONS,
  simulateRaFormationAt55,
  simulateRaForScenario,
  type CpfAssumptions,
  type CpfRetirementTarget,
  type CpfScenarioExample,
} from "@/domain/finance/cpf-retirement-projection";
import { CPF_RULES_VERSION } from "@/domain/finance/cpf-rules-review";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { formatCurrency } from "@/ui/lib/format";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpSelectClass,
} from "@/ui/input-classes";

export type CpfRetirementProjectionPanelProps = {
  currency: string;
  /** Completed age today; null when birth date missing. */
  currentAge: number | null;
  /** Projected OA/SA at age 55 from the dashboard CPF path; null if unavailable. */
  cpfAtAge55: { oa: number; sa: number } | null;
  hasCpfBalances: boolean;
};

function FlowArrow() {
  return (
    <div aria-hidden className="flex justify-center py-1 text-indigo-300 dark:text-indigo-400">
      <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
        <path
          d="M10 2v20m0 0l-6-6m6 6l6-6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function BalancePill({
  label,
  amount,
  currency,
  tone = "default",
}: {
  label: string;
  amount: number;
  currency: string;
  tone?: "default" | "accent" | "muted";
}) {
  const shell =
    tone === "accent"
      ? "border-indigo-200/80 bg-indigo-50/90 text-indigo-950 dark:border-indigo-300/35 dark:bg-indigo-950/45 dark:text-indigo-50"
      : tone === "muted"
        ? "border-slate-200/80 bg-slate-50/90 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200"
        : "border-slate-200/90 bg-white text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-50";
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center shadow-sm ${shell}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
        {formatCurrency(amount, currency)}
      </p>
    </div>
  );
}

function RaFlowVisual({
  simulation,
  currency,
  title,
}: {
  simulation: ReturnType<typeof simulateRaFormationAt55>;
  currency: string;
  title?: string;
}) {
  const { beforeAge55, requiredTarget, transferFromSa, transferFromOa, afterRaCreation } =
    simulation;
  return (
    <div className="space-y-1">
      {title ? (
        <p className="text-center text-xs font-medium text-indigo-900/80 dark:text-indigo-100/80">{title}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <BalancePill label="OA" amount={beforeAge55.oa} currency={currency} />
        <BalancePill label="SA" amount={beforeAge55.sa} currency={currency} />
      </div>
      <FlowArrow />
      <div className="rounded-xl border border-dashed border-indigo-200/90 bg-indigo-50/40 px-4 py-3 text-center dark:border-indigo-300/35 dark:bg-indigo-950/35">
        <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-800/90 dark:text-indigo-200">
          At age {CPF_RA_FORMATION_AGE}
        </p>
        <p className="mt-1 text-sm text-indigo-950 dark:text-indigo-50">
          Target retirement sum{" "}
          <span className="font-semibold tabular-nums">
            {formatCurrency(requiredTarget, currency)}
          </span>
        </p>
      </div>
      <FlowArrow />
      <div className="space-y-2 rounded-xl border border-indigo-100/90 bg-white/80 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
        <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Transfer flow
        </p>
        <div className="flex flex-col gap-2 text-sm text-slate-800 dark:text-slate-200">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-violet-50/80 px-3 py-2 dark:bg-violet-950/35">
            <span>SA → RA</span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(transferFromSa, currency)}
            </span>
          </div>
          {transferFromOa > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-indigo-50/80 px-3 py-2 dark:bg-indigo-950/35">
              <span>OA → RA</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(transferFromOa, currency)}
              </span>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              No OA top-up needed — SA covered the target.
            </p>
          )}
        </div>
      </div>
      <FlowArrow />
      <div className="grid gap-3 sm:grid-cols-2">
        <BalancePill
          label="RA"
          amount={afterRaCreation.ra}
          currency={currency}
          tone="accent"
        />
        <BalancePill
          label="Remaining OA"
          amount={afterRaCreation.remainingOa}
          currency={currency}
          tone="muted"
        />
      </div>
      {!simulation.fullyFunded ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-center text-xs text-amber-950 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100">
          Your illustrated balances are{" "}
          <span className="font-semibold tabular-nums">
            {formatCurrency(simulation.shortfall, currency)}
          </span>{" "}
          below the target — in reality you may need to top up in cash or continue
          growing CPF before 55.
        </p>
      ) : null}
    </div>
  );
}

function ScenarioChip({
  scenario,
  active,
  onSelect,
}: {
  scenario: CpfScenarioExample;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-full border px-3 py-1.5 text-left text-xs font-medium transition ${
        active
          ? "border-indigo-300 bg-indigo-600 text-white shadow-sm dark:border-indigo-300 dark:bg-indigo-300 dark:text-slate-950"
          : "border-slate-200/90 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/35 dark:hover:text-indigo-100"
      }`}
    >
      {scenario.label}
    </button>
  );
}

export function CpfRetirementProjectionPanel({
  currency,
  currentAge,
  cpfAtAge55,
  hasCpfBalances,
}: CpfRetirementProjectionPanelProps) {
  const [assumptions, setAssumptions] = useState<CpfAssumptions>(DEFAULT_CPF_ASSUMPTIONS);
  const [activeScenarioId, setActiveScenarioId] =
    useState<CpfScenarioExample["id"]>("high_sa");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const ageForProjection = currentAge ?? 35;
  const projection = useMemo(
    () =>
      buildCpfRetirementProjection({
        currentAge: ageForProjection,
        assumptions,
      }),
    [ageForProjection, assumptions]
  );

  const userOa = cpfAtAge55?.oa ?? 0;
  const userSa = cpfAtAge55?.sa ?? 0;
  const userSimulation = useMemo(
    () =>
      simulateRaFormationAt55({
        oa: userOa,
        sa: userSa,
        targetRetirementSum: projection.requiredTargetAt55,
      }),
    [userOa, userSa, projection.requiredTargetAt55]
  );

  const activeScenario =
    CPF_SCENARIO_EXAMPLES.find((s) => s.id === activeScenarioId) ??
    CPF_SCENARIO_EXAMPLES[0];
  const scenarioSimulation = useMemo(
    () => simulateRaForScenario(activeScenario, projection.requiredTargetAt55),
    [activeScenario, projection.requiredTargetAt55]
  );

  const targetLabel =
    assumptions.retirementTarget === "brs"
      ? "Basic Retirement Sum (BRS)"
      : assumptions.retirementTarget === "ers"
        ? "Enhanced Retirement Sum (ERS)"
        : "Full Retirement Sum (FRS)";

  if (currentAge == null) {
    return (
      <div className="mt-6 rounded-2xl border border-indigo-100/90 bg-linear-to-br from-indigo-50/50 via-white to-slate-50/40 p-5 shadow-sm ring-1 ring-indigo-100/40 dark:border-indigo-300/35 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 dark:ring-indigo-300/20">
        <h3 className="text-base font-semibold text-indigo-950 dark:text-indigo-50">
          CPF Retirement Projection
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Add your{" "}
          <Link
            href="/setup?tab=profile#profile-assumptions"
            className={appInlineLinkClass}
          >
            birth date in Setup
          </Link>{" "}
          to see how your CPF may be set aside at age 55 and what CPF LIFE could
          roughly pay from 65.
        </p>
      </div>
    );
  }

  return (
    <div
      id="cpf-retirement-projection"
      className="mt-6 scroll-mt-28 space-y-6 rounded-2xl border border-indigo-100/90 bg-linear-to-br from-indigo-50/40 via-white to-slate-50/30 p-4 shadow-sm ring-1 ring-indigo-100/40 dark:border-indigo-300/35 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/25 dark:ring-indigo-300/20 sm:p-5 md:p-6"
    >
      <header className="max-w-2xl space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600/90 dark:text-indigo-300">
              Retirement planning
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-indigo-950 dark:text-indigo-50 sm:text-xl">
              CPF Retirement Projection
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <InfoTooltip
              variant="zinc"
              ariaLabel="Open methodology: CPF retirement projection"
              methodologyTopicId="cpf-retirement-projection"
            >
              <span className="sr-only">CPF retirement projection methodology</span>
            </InfoTooltip>
            <MethodologyOpenLink
              topicId="cpf-retirement-projection"
              className="text-xs font-medium text-indigo-900 underline decoration-indigo-300/60 underline-offset-2 dark:text-indigo-200 dark:decoration-indigo-300/40"
            >
              Assumptions →
            </MethodologyOpenLink>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          See how CPF typically sets aside money at age {CPF_RA_FORMATION_AGE}, what
          your retirement sums might look like, and how SA and OA combine to form your
          Retirement Account (RA).{" "}
          <strong className="font-medium text-slate-700 dark:text-slate-200">
            Illustrative only
          </strong>{" "}
          — not guaranteed CPF LIFE income or financial advice.
        </p>
      </header>

      {/* Section 1: Retirement sum projection */}
      <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:p-5">
        <h4 className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
          Retirement sum projection
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Based on historical CPF retirement sum increases, your estimated{" "}
          <strong>Full Retirement Sum</strong> at age {CPF_RA_FORMATION_AGE} is
          projected to be around{" "}
          <span className="font-semibold tabular-nums text-indigo-950 dark:text-indigo-50">
            {formatCurrency(projection.estimatedFrsAt55, currency)}
          </span>
          {projection.yearsToAge55 > 0 ? (
            <>
              {" "}
              — about{" "}
              <strong>{projection.yearsToAge55}</strong>{" "}
              {projection.yearsToAge55 === 1 ? "year" : "years"} from now.
            </>
          ) : (
            <> — you are at or past age {CPF_RA_FORMATION_AGE} in this view.</>
          )}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Est. FRS at 55</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-indigo-950 dark:text-indigo-50">
              {formatCurrency(projection.estimatedFrsAt55, currency)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Est. BRS</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(projection.estimatedBrsAt55, currency)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Est. ERS</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(projection.estimatedErsAt55, currency)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/70">
            <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Est. CPF LIFE / mo from {assumptions.cpfLifeStartAge}
            </dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatCurrency(projection.cpfLifeMonthlyPayoutLow, currency)}
              <span className="mx-1 font-normal text-slate-400 dark:text-slate-500">–</span>
              {formatCurrency(projection.cpfLifeMonthlyPayoutHigh, currency)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Illustrative estimate only. Actual CPF policies may change in future. CPF LIFE
          payouts are simplified — not actuarial quotes.
        </p>
      </div>

      {/* Section 2: Age 55 simulation */}
      <div className="rounded-xl border border-indigo-100/70 bg-white/95 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 sm:p-5">
        <h4 className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
          Age {CPF_RA_FORMATION_AGE} CPF simulation
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {hasCpfBalances && cpfAtAge55 ? (
            <>
              Using your projected OA and SA just before the age{" "}
              {CPF_RA_FORMATION_AGE} set-aside (from the chart above), targeting{" "}
              <span className="font-medium text-indigo-900 dark:text-indigo-200">{targetLabel}</span>.
            </>
          ) : (
            <>
              Add{" "}
              <Link
                href="/setup?tab=cpf#cpf-balances"
                className={appInlineLinkClass}
              >
                CPF balances in Setup
              </Link>{" "}
              to personalise this flow — showing illustrative zero balances until then.
            </>
          )}
        </p>
        <div className="mt-4 max-w-lg mx-auto">
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Before age {CPF_RA_FORMATION_AGE}
          </p>
          <RaFlowVisual simulation={userSimulation} currency={currency} />
        </div>
      </div>

      {/* Scenarios */}
      <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-none sm:p-5">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Learn with examples</h4>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          These scenarios are educational only — they do not change your saved data.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CPF_SCENARIO_EXAMPLES.map((s) => (
            <ScenarioChip
              key={s.id}
              scenario={s}
              active={s.id === activeScenarioId}
              onSelect={() => setActiveScenarioId(s.id)}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{activeScenario.description}</p>
        <div className="mt-4 max-w-lg mx-auto">
          <RaFlowVisual
            simulation={scenarioSimulation}
            currency={currency}
            title={activeScenario.label}
          />
        </div>
      </div>

      {/* Section 5: Advanced */}
      <div className="rounded-xl border border-slate-200/70 bg-slate-50/30 dark:border-slate-700/80 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
          aria-expanded={showAdvanced}
        >
          Advanced CPF assumptions
          <span className="text-slate-400 dark:text-slate-500">{showAdvanced ? "−" : "+"}</span>
        </button>
        {showAdvanced ? (
          <div className="space-y-4 border-t border-slate-200/70 px-4 pb-4 pt-3 dark:border-slate-700/80">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              For advisors and power users. Defaults work well for most people. App
              CPF rules baseline: <strong>{CPF_RULES_VERSION}</strong>. Published FRS
              for members turning 55 in {CPF_FRS_BASE_COHORT_YEAR}:{" "}
              <strong>{formatCurrency(CURRENT_FRS_SG, currency)}</strong>.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Re-check balances and policy values in{" "}
              <Link href="/setup?tab=cpf#cpf-rules-review" className={appInlineLinkClass}>
                Setup → CPF
              </Link>{" "}
              when the app prompts a CPF assumptions review.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  FRS annual growth %
                </span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  className={fpInputNarrowClass}
                  value={Math.round(assumptions.frsAnnualGrowthRate * 1000) / 10}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    if (!Number.isFinite(p)) return;
                    setAssumptions((a) => ({
                      ...a,
                      frsAnnualGrowthRate: p / 100,
                      manualProjectedFrsOverride: null,
                    }));
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Retirement target</span>
                <select
                  className={fpSelectClass}
                  value={assumptions.retirementTarget}
                  onChange={(e) =>
                    setAssumptions((a) => ({
                      ...a,
                      retirementTarget: e.target.value as CpfRetirementTarget,
                    }))
                  }
                >
                  <option value="brs">BRS (50% of FRS)</option>
                  <option value="frs">FRS</option>
                  <option value="ers">ERS (200% of FRS)</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Manual override — projected FRS at 55 (optional)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="Leave empty to use growth projection"
                  className={fpInputClass}
                  value={
                    assumptions.manualProjectedFrsOverride != null
                      ? assumptions.manualProjectedFrsOverride
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    setAssumptions((a) => ({
                      ...a,
                      manualProjectedFrsOverride:
                        raw === "" ? null : Math.max(0, Number(raw)),
                    }));
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  CPF LIFE payout assumption % (annual of RA)
                </span>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.1}
                  className={fpInputNarrowClass}
                  value={Math.round(assumptions.cpfLifePayoutRateAnnual * 1000) / 10}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    if (!Number.isFinite(p)) return;
                    setAssumptions((a) => ({
                      ...a,
                      cpfLifePayoutRateAnnual: p / 100,
                    }));
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Payout start age
                </span>
                <input
                  type="number"
                  min={65}
                  max={70}
                  step={1}
                  className={fpInputNarrowClass}
                  value={assumptions.cpfLifeStartAge}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setAssumptions((a) => ({
                      ...a,
                      cpfLifeStartAge: Math.min(70, Math.max(65, Math.round(n))),
                    }));
                  }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
