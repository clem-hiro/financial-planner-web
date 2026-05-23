import { num } from "@/data/mappers";

export type CashAccountHistoryPoint = {
  balance: number;
  recorded_at: string;
};

export const CASH_ACCOUNT_HISTORY_LIMIT = 8;

export function buildCashHistoryByAccountId(
  snapshots: { cash_account_id: string; balance: string; recorded_at: string }[]
): Record<string, CashAccountHistoryPoint[]> {
  const map: Record<string, CashAccountHistoryPoint[]> = {};
  for (const s of snapshots) {
    const list = map[s.cash_account_id] ?? [];
    if (list.length >= CASH_ACCOUNT_HISTORY_LIMIT) continue;
    list.push({
      balance: num(s.balance),
      recorded_at: s.recorded_at,
    });
    map[s.cash_account_id] = list;
  }
  return map;
}
