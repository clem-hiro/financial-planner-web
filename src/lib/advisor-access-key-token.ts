import { randomBytes } from "node:crypto";

/** POC batch size when an advisor generates free keys from the app. */
export const ADVISOR_ACCESS_KEY_BATCH_POC = 10;

export function generateAdvisorAccessKeyToken(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

/** Build `count` unique keys; `existing` is updated in place for collision avoidance. */
export function generateUniqueAdvisorAccessKeys(
  count: number,
  existing: Set<string>
): string[] {
  const out: string[] = [];
  let guard = 0;
  const maxAttempts = Math.max(count * 40, 40);
  while (out.length < count && guard < maxAttempts) {
    guard += 1;
    const k = generateAdvisorAccessKeyToken();
    if (existing.has(k)) continue;
    existing.add(k);
    out.push(k);
  }
  if (out.length < count) {
    throw new Error("Could not generate enough unique access keys");
  }
  return out;
}
