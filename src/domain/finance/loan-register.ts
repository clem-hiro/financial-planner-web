import type { LoanSourceKey } from "@/domain/finance/loan-source-registry";

export type LoanRegisterFundingSource = "cash" | "cpf_oa" | "split";
export type LoanRegisterLoanType = "amortized" | "flat_rate" | "revolving";

export type LoanRegisterDetail = {
  label: string;
  value: string;
};

export type SourceOwnedLoanRegisterEntry = {
  id: string;
  sourceKey: LoanSourceKey;
  sourceRowId: string;
  sourceLabel: string;
  rawName: string;
  displayName: string;
  balance: number;
  monthlyPayment: number | null;
  annualInterestRate: number | null;
  remainingTenureMonths: number | null;
  loanType: LoanRegisterLoanType;
  fundingSource: LoanRegisterFundingSource;
  cpfOaPayment: number | null;
  cashPayment: number | null;
  setupTabId: string;
  details: LoanRegisterDetail[];
};

export type SourceOwnedLoanFollowUp = {
  id: string;
  sourceKey: LoanSourceKey;
  sourceLabel: string;
  displayName: string;
  setupTabId: string;
  message: string;
  actionLabel: string;
};

function normalizeLoanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function displayLoanName(name: string): string {
  return name.trim().replace(/\s+/g, " ") || "Loan";
}

function nameCount(
  entries: readonly SourceOwnedLoanRegisterEntry[],
  reservedNames: readonly string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of reservedNames) {
    const normalized = normalizeLoanName(name);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  for (const entry of entries) {
    const normalized = normalizeLoanName(entry.rawName);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

export function dedupeSourceOwnedLoanNames(
  entries: readonly SourceOwnedLoanRegisterEntry[],
  reservedNames: readonly string[] = []
): SourceOwnedLoanRegisterEntry[] {
  const counts = nameCount(entries, reservedNames);
  const seenByNameAndSource = new Map<string, number>();

  return entries.map((entry) => {
    const normalized = normalizeLoanName(entry.rawName);
    const displayBase = displayLoanName(entry.rawName);
    if ((counts.get(normalized) ?? 0) <= 1) {
      return { ...entry, displayName: displayBase };
    }

    const seenKey = `${normalized}:${entry.sourceKey}`;
    const nextSeen = (seenByNameAndSource.get(seenKey) ?? 0) + 1;
    seenByNameAndSource.set(seenKey, nextSeen);

    const suffix =
      nextSeen === 1 ? entry.sourceLabel : `${entry.sourceLabel} ${nextSeen}`;
    return {
      ...entry,
      displayName: `${displayBase} (${suffix})`,
    };
  });
}
