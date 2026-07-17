"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardPayload } from "@/data/dashboard";
import { formatYearMonthLong, yearFromYearMonth } from "@/lib/dates";
import { setupBudgetPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appBrandHeaderCompactStyle } from "@/ui/app-tab-styles";
import { formatCurrency } from "@/ui/lib/format";

type CompositionSegment = {
  key: string;
  label: string;
  value: number;
  fill: string;
};

function buildCompositionSegments(
  breakdown: DashboardPayload["netWorthBreakdown"],
  hasCpf: boolean
): CompositionSegment[] {
  const segments: CompositionSegment[] = [
    {
      key: "investments",
      label: "Investments",
      value: breakdown.investments,
      fill: "bg-emerald-600",
    },
    {
      key: "cash",
      label: "Cash",
      value: breakdown.cash,
      fill: "bg-sky-500",
    },
  ];
  if (hasCpf && breakdown.cpf > 0) {
    segments.push({
      key: "cpf",
      label: "CPF",
      value: breakdown.cpf,
      fill: "bg-indigo-400",
    });
  }
  if (breakdown.propertyCount > 0 && breakdown.propertiesNet > 0) {
    segments.push({
      key: "property",
      label: "Property",
      value: breakdown.propertiesNet,
      fill: "bg-slate-700 dark:bg-slate-300",
    });
  }
  if (breakdown.vehicleCount > 0 && breakdown.vehiclesGrossAsset > 0) {
    segments.push({
      key: "vehicles",
      label: "Vehicles",
      value: breakdown.vehiclesGrossAsset,
      fill: "bg-teal-600",
    });
  }
  return segments.filter((segment) => segment.value > 0);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function useCountUp(
  target: number,
  durationMs: number,
  enabled: boolean,
  delayMs = 0
): number {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    let frame = 0;
    let startAt = 0;
    const timeout = window.setTimeout(() => {
      startAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startAt) / durationMs);
        const eased = 1 - (1 - progress) ** 3;
        setValue(target * eased);
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, enabled, delayMs]);

  return value;
}

export function DashboardOverviewSection({
  payload,
}: {
  payload: DashboardPayload;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;

  const hasLoggedSpend = payload.monthlyExpensesLoggedTotal > 0;
  const hasBudgetForecast = payload.monthlyPlannedMonthlyBudgetTotal > 0;
  const expensesAction = hasLoggedSpend
    ? { href: "/expenses", label: "View" }
    : hasBudgetForecast
      ? {
          href: setupBudgetPath(
            payload.month,
            yearFromYearMonth(payload.month)
          ),
          label: "Budget",
        }
      : {
          href: setupBudgetPath(
            payload.month,
            yearFromYearMonth(payload.month)
          ),
          label: "Set up",
        };
  const leftAfterExpenses = payload.takeHomeMinusExpenses;
  const leftNegative =
    leftAfterExpenses != null && leftAfterExpenses < 0;
  const segments = buildCompositionSegments(
    payload.netWorthBreakdown,
    payload.hasCpfBalanceRecord
  );
  const compositionTotal = segments.reduce(
    (sum, segment) => sum + segment.value,
    0
  );
  const debts = payload.netWorthBreakdown.liabilities;
  const accountCount = payload.investmentSummary.count;

  const netWorthDisplay = useCountUp(payload.netWorth, 900, animate, 120);
  const incomeDisplay = useCountUp(
    payload.monthlyTakeHome ?? 0,
    700,
    animate && payload.monthlyTakeHome != null,
    280
  );
  const expensesDisplay = useCountUp(
    payload.monthlyExpensesTotal,
    700,
    animate,
    340
  );
  const leftDisplay = useCountUp(
    leftAfterExpenses ?? 0,
    700,
    animate && leftAfterExpenses != null,
    400
  );

  return (
    <div
      className={`home-hero-shell overflow-hidden rounded-[1.35rem] shadow-[0_20px_50px_-28px_rgba(12,25,47,0.45)] ring-1 ring-slate-900/10 dark:ring-white/10 ${
        animate ? "home-hero-animate" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden px-5 pb-5 pt-5 text-white sm:px-7 sm:pb-6 sm:pt-6 ${
          animate ? "home-hero-shimmer" : ""
        }`}
        style={appBrandHeaderCompactStyle}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(125,211,252,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -right-10 top-0 h-full w-1/3 bg-linear-to-l from-white/4 to-transparent" />

        <div className="relative z-[2] space-y-6 sm:space-y-7">
          <div
            className={`flex items-start justify-between gap-4 ${
              animate ? "home-hero-stagger home-hero-stagger-1" : ""
            }`}
          >
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300/85">
                Position
              </p>
              <h1 className="sr-only">Home</h1>
            </div>
            <p className="shrink-0 text-sm font-medium text-slate-300/90">
              {formatYearMonthLong(payload.month)}
            </p>
          </div>

          <div className={animate ? "home-hero-stagger home-hero-stagger-2" : ""}>
            <p className="font-mono text-[2.35rem] font-semibold leading-none tracking-tight tabular-nums sm:text-5xl sm:tracking-[-0.03em]">
              {formatCurrency(Math.round(netWorthDisplay), payload.baseCurrency)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-slate-300/90">
              <span className="font-medium text-white/88">Net worth</span>
              {payload.netWorthBreakdown.cpf > 0 ? (
                <>
                  <span className="text-white/25" aria-hidden>
                    ·
                  </span>
                  <span>
                    {formatCurrency(
                      payload.netWorthExcludingCpf,
                      payload.baseCurrency
                    )}{" "}
                    excl. CPF
                  </span>
                </>
              ) : null}
              {accountCount > 0 ? (
                <>
                  <span className="text-white/25" aria-hidden>
                    ·
                  </span>
                  <Link
                    href="/setup?tab=add-account#add-investment"
                    className="text-emerald-200/95 underline decoration-emerald-300/35 underline-offset-2 transition hover:text-emerald-100"
                  >
                    {accountCount} account
                    {accountCount === 1 ? "" : "s"}
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-white/25" aria-hidden>
                    ·
                  </span>
                  <Link
                    href="/setup?tab=add-account#add-investment"
                    className="text-slate-300/90 underline decoration-white/20 underline-offset-2 transition hover:text-white"
                  >
                    Add investments
                  </Link>
                </>
              )}
            </div>
          </div>

          <div
            className={`grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-3 ${
              animate ? "home-hero-stagger home-hero-stagger-3" : ""
            }`}
          >
            <div className="bg-white/5 px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200/80">
                Income
              </p>
              <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums text-white">
                {payload.monthlyTakeHome != null
                  ? formatCurrency(
                      Math.round(incomeDisplay),
                      payload.baseCurrency
                    )
                  : "—"}
              </p>
              {payload.monthlyTakeHome == null ? (
                <p className="mt-1.5 text-xs text-slate-300/85">
                  <Link
                    href="/setup?tab=profile"
                    className="underline decoration-white/25 underline-offset-2 hover:text-white"
                  >
                    Set in Profile
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="bg-white/5 px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-300/80">
                Expenses
              </p>
              <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums text-white">
                {formatCurrency(
                  Math.round(expensesDisplay),
                  payload.baseCurrency
                )}
              </p>
              <p className="mt-1.5 text-xs text-slate-300/85">
                {hasLoggedSpend
                  ? "Logged"
                  : hasBudgetForecast
                    ? "Budget"
                    : "Not set"}{" "}
                <Link
                  href={expensesAction.href}
                  className="underline decoration-white/25 underline-offset-2 hover:text-white"
                >
                  {expensesAction.label}
                </Link>
              </p>
            </div>
            <div className="bg-white/5 px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-300/80">
                Left
              </p>
              <p
                className={`mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums ${
                  leftNegative ? "text-amber-200" : "text-white"
                }`}
              >
                {leftAfterExpenses != null
                  ? formatCurrency(Math.round(leftDisplay), payload.baseCurrency)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`border-t border-slate-200/70 bg-white px-5 py-4 dark:border-slate-700/70 dark:bg-slate-900/95 sm:px-7 sm:py-5 ${
          animate ? "home-hero-stagger home-hero-stagger-4" : ""
        }`}
      >
        {compositionTotal > 0 ? (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              What makes up your net worth
            </p>
            <div
              className={`flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${
                animate ? "home-composition-track" : ""
              }`}
              role="img"
              aria-label="Net worth composition"
            >
              {segments.map((segment) => (
                <div
                  key={segment.key}
                  className={`${segment.fill} min-w-0 ${
                    animate ? "home-composition-segment" : ""
                  }`}
                  style={{
                    width: `${Math.max(
                      2,
                      (segment.value / compositionTotal) * 100
                    )}%`,
                  }}
                  title={`${segment.label}: ${formatCurrency(
                    segment.value,
                    payload.baseCurrency
                  )}`}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
              {segments.map((segment) => (
                <li key={segment.key} className="inline-flex items-baseline gap-2">
                  <span
                    className={`mt-1 size-1.5 shrink-0 rounded-full ${segment.fill}`}
                    aria-hidden
                  />
                  <span>{segment.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatCurrency(segment.value, payload.baseCurrency)}
                  </span>
                  <span className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500">
                    {Math.round((segment.value / compositionTotal) * 100)}%
                  </span>
                </li>
              ))}
              {debts > 0 ? (
                <li className="inline-flex items-baseline gap-2">
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-400"
                    aria-hidden
                  />
                  <span>Debts</span>
                  <span className="font-mono tabular-nums text-rose-600 dark:text-rose-300">
                    −{formatCurrency(debts, payload.baseCurrency)}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add cash, investments, or property in{" "}
            <Link href="/setup" className={appInlineLinkClass}>
              Setup
            </Link>{" "}
            to build this picture.
          </p>
        )}
      </div>
    </div>
  );
}
