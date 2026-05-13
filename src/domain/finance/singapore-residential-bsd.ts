/**
 * Singapore residential Buyer’s Stamp Duty (BSD) — progressive tiers.
 * Source: IRAS stamp duty rates for residential property (tiers as of common 2020s structure).
 * This is planning / estimate only; actual duty is subject to IRAS rules and rounding.
 */

export type SingaporeBsdBand = {
  /** User-facing tier label */
  label: string;
  /** Amount of consideration taxed at this rate */
  taxableAmount: number;
  rate: number;
  duty: number;
};

const BSD_BRACKET_SIZES = [
  180_000,
  180_000,
  640_000,
  500_000,
  1_500_000,
] as const;

const BSD_BRACKET_RATES = [0.01, 0.02, 0.03, 0.04, 0.05] as const;

const BSD_LABELS = [
  "First S$180,000",
  "Next S$180,000",
  "Next S$640,000",
  "Next S$500,000",
  "Next S$1,500,000",
] as const;

const BSD_REMAINDER_RATE = 0.06;
const BSD_REMAINDER_LABEL = "Remaining amount above S$3,000,000";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * @param purchasePrice — consideration amount in SGD (major units)
 * @returns total BSD and per-tier breakdown (only bands with positive taxable amount)
 */
export function computeSingaporeResidentialBuyersStampDuty(
  purchasePrice: number
): { total: number; bands: SingaporeBsdBand[] } {
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { total: 0, bands: [] };
  }

  const bands: SingaporeBsdBand[] = [];
  let remaining = purchasePrice;
  let total = 0;

  for (let i = 0; i < BSD_BRACKET_SIZES.length; i++) {
    if (remaining <= 0) break;
    const cap = BSD_BRACKET_SIZES[i]!;
    const rate = BSD_BRACKET_RATES[i]!;
    const taxableAmount = Math.min(remaining, cap);
    if (taxableAmount <= 0) continue;
    const duty = taxableAmount * rate;
    total += duty;
    bands.push({
      label: BSD_LABELS[i] ?? `Tier ${i + 1}`,
      taxableAmount,
      rate,
      duty,
    });
    remaining -= taxableAmount;
  }

  if (remaining > 0) {
    const duty = remaining * BSD_REMAINDER_RATE;
    total += duty;
    bands.push({
      label: BSD_REMAINDER_LABEL,
      taxableAmount: remaining,
      rate: BSD_REMAINDER_RATE,
      duty,
    });
  }

  return { total: roundMoney(total), bands };
}
