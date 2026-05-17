const MS_PER_DAY = 86_400_000;

/**
 * Relative label for setup card “last updated” (e.g. “3 days ago”).
 * Falls back gracefully for missing or invalid timestamps.
 */
export function formatRelativeTimeAgo(
  iso: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "just now";

  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 14) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) {
    return diffWeeks === 1 ? "1 week ago" : `${diffWeeks} weeks ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
}
