import type { Money, NetWorthInput } from "./types";

function sum(values: Money[] | undefined): Money {
  if (!values?.length) return 0;
  return values.reduce((a, b) => a + b, 0);
}

export function calculateNetWorth(input: NetWorthInput): Money {
  const cpf = input.cpfTotal ?? 0;
  const assets =
    sum(input.investmentValues) + sum(input.cashBalances) + cpf;
  const liabilities = sum(input.liabilities);
  return assets - liabilities;
}
