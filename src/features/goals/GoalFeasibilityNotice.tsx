import type { GoalFeasibilityAnalysis } from "@/domain/finance/goal-feasibility";
import { formatMonthsApprox } from "@/ui/lib/duration";
import { formatCurrency } from "@/ui/lib/format";

type Props = {
  feasibility: GoalFeasibilityAnalysis;
  targetDateYmd: string | null;
  currency: string;
};

function noticeClass(tone: "amber" | "red"): string {
  if (tone === "red") {
    return "mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950";
  }
  return "mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950";
}

export function GoalFeasibilityNotice({
  feasibility,
  targetDateYmd,
  currency,
}: Props) {
  const {
    status,
    deadline,
    plannedMonthly,
    affordableMonthly,
    requiredMonthly,
    spendCutMonthly,
    suggestedDateYmd,
    extraPeriodsVsDeadline,
    etaMonthsAtAffordable,
    etaMonthsAtPlanned,
  } = feasibility;

  if (status === "met" || status === "on_track" || status === "no_cash_context") {
    return null;
  }

  if (status === "past_deadline" && deadline.kind === "past_deadline") {
    return (
      <p className={noticeClass("red")} role="status">
        <span className="font-medium">Target date has passed. </span>
        You still need about{" "}
        <strong>{formatCurrency(deadline.remaining, currency)}</strong> to reach
        this goal.
      </p>
    );
  }

  if (status === "no_contribution_periods") {
    return (
      <p className={noticeClass("amber")} role="status">
        Your target date is too soon for another end-of-month deposit before the
        deadline. Move the date later or add to &quot;already saved&quot; now.
      </p>
    );
  }

  if (status === "cannot_catch_up") {
    return (
      <p className={noticeClass("amber")} role="status">
        Could not compute a monthly catch-up for this deadline; check amounts and
        dates.
      </p>
    );
  }

  if (status === "raise_contribution" && deadline.kind === "short") {
    return (
      <p className={noticeClass("amber")} role="status">
        <span className="font-medium">Behind your target date: </span>
        at your current plan you won&apos;t reach the goal by {targetDateYmd}. To
        hit it on time ({deadline.monthsRemaining} end-of-month deposit
        {deadline.monthsRemaining === 1 ? "" : "s"}, your return assumption),
        plan about{" "}
        <strong>{formatCurrency(deadline.requiredMonthly, currency)}</strong>/mo
        {affordableMonthly != null &&
        affordableMonthly + 0.005 >= deadline.requiredMonthly ? (
          <>
            {" "}
            — your monthly surplus allows about{" "}
            <strong>{formatCurrency(affordableMonthly, currency)}</strong>/mo for
            this goal after higher-priority goals.
          </>
        ) : (
          <>
            {" "}
            — increase your monthly contribution by about{" "}
            <strong>{formatCurrency(deadline.increaseBy, currency)}</strong>/mo.
          </>
        )}
      </p>
    );
  }

  if (status === "cash_constrained") {
    return (
      <p className={noticeClass("amber")} role="status">
        <span className="font-medium">Funding gap: </span>
        your plan assumes{" "}
        <strong>{formatCurrency(plannedMonthly, currency)}</strong>/mo, but after
        higher-priority goals only about{" "}
        <strong>{formatCurrency(affordableMonthly ?? 0, currency)}</strong>/mo is
        available
        {targetDateYmd ? (
          <>
            {" "}
            — you may miss {targetDateYmd} unless you raise this goal&apos;s
            priority or lower other goal contributions.
          </>
        ) : (
          <> — actual progress may be slower than your plan.</>
        )}
      </p>
    );
  }

  if (status === "not_achievable_on_date") {
    const required = requiredMonthly ?? 0;
    const affordable = affordableMonthly ?? 0;
    return (
      <div className={noticeClass("amber")} role="status">
        <p>
          <span className="font-medium">Not achievable on {targetDateYmd}: </span>
          you need about{" "}
          <strong>{formatCurrency(required, currency)}</strong>/mo to hit the date,
          but only about{" "}
          <strong>{formatCurrency(affordable, currency)}</strong>/mo is available
          for this goal after priority funding.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {spendCutMonthly != null && spendCutMonthly > 0 ? (
            <li>
              <span className="font-medium">Free up cash: </span>
              find about{" "}
              <strong>{formatCurrency(spendCutMonthly, currency)}</strong>/mo
              (lower spend or other savings commitments) to keep {targetDateYmd}.
            </li>
          ) : null}
          {suggestedDateYmd ? (
            <li>
              <span className="font-medium">More time: </span>
              at{" "}
              <strong>{formatCurrency(affordable, currency)}</strong>/mo, you could
              reach the target around <strong>{suggestedDateYmd}</strong>
              {extraPeriodsVsDeadline != null && extraPeriodsVsDeadline > 0 ? (
                <>
                  {" "}
                  (~{formatMonthsApprox(extraPeriodsVsDeadline)} later than your
                  current date)
                </>
              ) : null}
              .
            </li>
          ) : null}
        </ul>
      </div>
    );
  }

  if (status === "no_deadline_affordable_slower") {
    return (
      <p className={noticeClass("amber")} role="status">
        <span className="font-medium">Surplus vs plan: </span>
        your plan uses{" "}
        <strong>{formatCurrency(plannedMonthly, currency)}</strong>/mo (~
        {etaMonthsAtPlanned != null
          ? formatMonthsApprox(etaMonthsAtPlanned)
          : "—"}{" "}
        to target), but only about{" "}
        <strong>{formatCurrency(affordableMonthly ?? 0, currency)}</strong>/mo is
        available after priority goals (~
        {etaMonthsAtAffordable != null
          ? formatMonthsApprox(etaMonthsAtAffordable)
          : "—"}
        ).
      </p>
    );
  }

  return null;
}
