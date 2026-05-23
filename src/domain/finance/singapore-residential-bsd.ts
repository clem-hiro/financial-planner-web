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

export type SingaporeResidentialBsdSchedule = {
  effectiveLabel: string;
  bands: Array<{ size: number | null; rate: number; label: string }>;
};

const BSD_SCHEDULE_PRE_2018: SingaporeResidentialBsdSchedule = {
  effectiveLabel: "Before 20 Feb 2018",
  bands: [
    { size: 180_000, rate: 0.01, label: "First S$180,000" },
    { size: 180_000, rate: 0.02, label: "Next S$180,000" },
    { size: null, rate: 0.03, label: "Remaining amount above S$360,000" },
  ],
};

const BSD_SCHEDULE_2018_TO_2023: SingaporeResidentialBsdSchedule = {
  effectiveLabel: "20 Feb 2018 to 14 Feb 2023",
  bands: [
    { size: 180_000, rate: 0.01, label: "First S$180,000" },
    { size: 180_000, rate: 0.02, label: "Next S$180,000" },
    { size: 640_000, rate: 0.03, label: "Next S$640,000" },
    { size: null, rate: 0.04, label: "Remaining amount above S$1,000,000" },
  ],
};

const BSD_SCHEDULE_FROM_2023: SingaporeResidentialBsdSchedule = {
  effectiveLabel: "On or after 15 Feb 2023",
  bands: [
    { size: 180_000, rate: 0.01, label: "First S$180,000" },
    { size: 180_000, rate: 0.02, label: "Next S$180,000" },
    { size: 640_000, rate: 0.03, label: "Next S$640,000" },
    { size: 500_000, rate: 0.04, label: "Next S$500,000" },
    { size: 1_500_000, rate: 0.05, label: "Next S$1,500,000" },
    { size: null, rate: 0.06, label: "Remaining amount above S$3,000,000" },
  ],
};

function roundMoney(n: number): number {
  return Math.floor(n);
}

export function singaporeResidentialBsdScheduleForPurchaseYear(
  purchaseYear: number | null | undefined
): SingaporeResidentialBsdSchedule {
  const y =
    purchaseYear != null && Number.isFinite(purchaseYear)
      ? Math.trunc(purchaseYear)
      : new Date().getFullYear();
  if (y <= 2017) return BSD_SCHEDULE_PRE_2018;
  if (y <= 2022) return BSD_SCHEDULE_2018_TO_2023;
  return BSD_SCHEDULE_FROM_2023;
}

/**
 * @param purchasePrice — consideration amount in SGD (major units)
 * @returns total BSD and per-tier breakdown (only bands with positive taxable amount)
 */
export function computeSingaporeResidentialBuyersStampDuty(
  purchasePrice: number,
  options?: { purchaseYear?: number | null }
): {
  total: number;
  bands: SingaporeBsdBand[];
  scheduleLabel: string;
} {
  const schedule = singaporeResidentialBsdScheduleForPurchaseYear(
    options?.purchaseYear
  );
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
    return { total: 0, bands: [], scheduleLabel: schedule.effectiveLabel };
  }

  const bands: SingaporeBsdBand[] = [];
  let remaining = purchasePrice;
  let total = 0;

  for (const band of schedule.bands) {
    if (remaining <= 0) break;
    const taxableAmount =
      band.size == null ? remaining : Math.min(remaining, band.size);
    if (taxableAmount <= 0) continue;
    const duty = taxableAmount * band.rate;
    total += duty;
    bands.push({
      label: band.label,
      taxableAmount,
      rate: band.rate,
      duty,
    });
    remaining -= taxableAmount;
  }

  return { total: roundMoney(total), bands, scheduleLabel: schedule.effectiveLabel };
}
