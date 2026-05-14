"use server";

import { formatCents, TimerHandle } from "../lib/index.ts";

export async function createTransaction(amount: number): Promise<string> {
  const formatted = formatCents(amount);
  const handle = new TimerHandle(1);
  handle.cancel();
  // Dynamic import — internal target.
  const mod = await import("../lib/util.ts");
  return mod.formatCents(amount) + formatted;
}

export async function unresolvedDispatch(arr: Array<(x: number) => number>, key: number): Promise<number> {
  // Computed-dispatch + as-any erasure: both paths should bump unresolved, not fabricate an edge.
  const opaque = { method: () => 0 } as unknown as { method: () => number };
  (opaque as unknown as { method: () => number }).method();
  return arr[key](0);
}

// Non-exported helper to assert the `exported` field flips correctly.
function _internalOnly(): number {
  return 1;
}
export const exportedArrow = () => _internalOnly();
