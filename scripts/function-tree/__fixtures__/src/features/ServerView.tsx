// Default server component — no "use client", lives under app/. The dashboard page renders it.

import { formatCents } from "../lib/index.ts";

export function ServerView({ amount }: { amount: number }) {
  return <div>{formatCents(amount)}</div>;
}
