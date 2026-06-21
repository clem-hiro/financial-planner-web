import { num } from "@/data/mappers";
import type { HousingLoanRow } from "@/data/supabase/types";

export type HousingUpfrontOaEvent = {
  yearMonth: string;
  amount: number;
};

function parseOaEvent(
  yearMonth: string | null | undefined,
  amount: string | number | null | undefined
): HousingUpfrontOaEvent | null {
  if (yearMonth == null || !/^\d{4}-\d{2}$/.test(yearMonth)) return null;
  if (amount == null || String(amount).trim() === "") return null;
  const parsed =
    typeof amount === "number" ? amount : num(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return { yearMonth, amount: parsed };
}

/**
 * Ordered upfront CPF OA deductions for projection timing.
 * Prefers split columns (option fee, BSD, legal); falls back to legacy bsd_legal_*.
 */
export function housingUpfrontOaEvents(
  row: HousingLoanRow
): HousingUpfrontOaEvent[] {
  const hasSplitBsd =
    row.bsd_total != null && String(row.bsd_total).trim() !== "";
  const hasSplitLegal =
    row.legal_fee_total != null && String(row.legal_fee_total).trim() !== "";

  const events: Array<HousingUpfrontOaEvent | null> = [
    parseOaEvent(row.option_fee_paid_month, row.option_fee_cpf_oa),
    parseOaEvent(row.first_downpayment_paid_month, row.first_downpayment_cpf_oa),
    hasSplitBsd
      ? parseOaEvent(row.bsd_paid_month, row.bsd_cpf_oa)
      : parseOaEvent(row.bsd_legal_paid_month, row.bsd_legal_cpf_oa),
    hasSplitLegal
      ? parseOaEvent(row.legal_fee_paid_month, row.legal_fee_cpf_oa)
      : null,
    parseOaEvent(
      row.second_downpayment_paid_month,
      row.second_downpayment_cpf_oa
    ),
  ];

  return events.filter((event): event is HousingUpfrontOaEvent => event != null);
}
