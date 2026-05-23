/** Version label for CPF rules/assumptions used by app calculations. */
export const CPF_RULES_VERSION = "2026-01-01" as const;

/** Month when CPF policy/assumption reviews should recur if no new version shipped. */
export const CPF_RULES_REVIEW_MONTH = 11 as const;

export type CpfRulesReviewProfile = {
  id: string;
  last_cpf_rules_review_at: string | null;
  last_cpf_rules_review_version: string | null;
};

function reviewedInOrAfterMonth(
  iso: string | null,
  year: number,
  month: number
): boolean {
  if (!iso) return false;
  const reviewedAt = new Date(iso);
  if (!Number.isFinite(reviewedAt.getTime())) return false;
  if (reviewedAt.getFullYear() !== year) return false;
  return reviewedAt.getMonth() + 1 >= month;
}

export function shouldPromptCpfRulesReview(params: {
  lastCpfRulesReviewAt: string | null;
  lastCpfRulesReviewVersion: string | null;
  currentRulesVersion?: string;
  reviewMonth?: number;
  now?: Date;
}): boolean {
  const currentRulesVersion = params.currentRulesVersion ?? CPF_RULES_VERSION;
  const reviewMonth = params.reviewMonth ?? CPF_RULES_REVIEW_MONTH;
  const now = params.now ?? new Date();

  if (params.lastCpfRulesReviewVersion !== currentRulesVersion) {
    return true;
  }

  const currentMonth = now.getMonth() + 1;
  if (currentMonth < reviewMonth) return false;

  return !reviewedInOrAfterMonth(
    params.lastCpfRulesReviewAt,
    now.getFullYear(),
    reviewMonth
  );
}

export function cpfRulesReviewDedupeKey(
  year: number,
  version: string = CPF_RULES_VERSION
): string {
  return `cpf_rules_review_due:${version}:${year}`;
}
