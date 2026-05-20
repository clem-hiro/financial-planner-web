/** Months without an account update before we suggest reviewing balances/returns. */
export const INVESTMENT_REVIEW_STALE_MONTHS = 12;

/** Months a profile-level acknowledgement suppresses the inbox prompt. */
export const INVESTMENT_REVIEW_ACK_VALID_MONTHS = 12;

export type InvestmentReviewTimestampRow = {
  updated_at?: string | null;
  created_at?: string | null;
};

export function monthsSinceTimestamp(
  iso: string,
  now: Date = new Date()
): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  const diffMs = now.getTime() - t;
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
}

export function investmentRowLastTouchedAt(
  row: InvestmentReviewTimestampRow
): string | null {
  const u = row.updated_at?.trim();
  if (u) return u;
  const c = row.created_at?.trim();
  return c || null;
}

export function investmentRowIsStale(
  row: InvestmentReviewTimestampRow,
  now: Date = new Date(),
  staleMonths: number = INVESTMENT_REVIEW_STALE_MONTHS
): boolean {
  const touched = investmentRowLastTouchedAt(row);
  if (!touched) return true;
  return monthsSinceTimestamp(touched, now) >= staleMonths;
}

export function countStaleInvestments(
  rows: InvestmentReviewTimestampRow[],
  now: Date = new Date(),
  staleMonths: number = INVESTMENT_REVIEW_STALE_MONTHS
): number {
  return rows.filter((r) => investmentRowIsStale(r, now, staleMonths)).length;
}

/**
 * Whether the user should see an investment review reminder (inbox or inline).
 * Requires at least one account and either stale data or no recent acknowledgement.
 */
export function shouldPromptInvestmentReview(params: {
  investments: InvestmentReviewTimestampRow[];
  lastInvestmentReviewAt: string | null;
  now?: Date;
  staleMonths?: number;
  ackValidMonths?: number;
}): boolean {
  const now = params.now ?? new Date();
  const staleMonths = params.staleMonths ?? INVESTMENT_REVIEW_STALE_MONTHS;
  const ackValidMonths =
    params.ackValidMonths ?? INVESTMENT_REVIEW_ACK_VALID_MONTHS;

  if (params.investments.length === 0) return false;

  const staleCount = countStaleInvestments(
    params.investments,
    now,
    staleMonths
  );
  if (staleCount === 0) return false;

  const lastAck = params.lastInvestmentReviewAt?.trim();
  if (!lastAck) return true;

  return monthsSinceTimestamp(lastAck, now) >= ackValidMonths;
}

export function investmentReviewDedupeKeyForYear(year: number): string {
  return `investment_review_due:${year}`;
}
