/** One row of the combined asset / net-worth-by-age path (chart + table). */
export type AgeAssetBreakdownPoint = {
  age: number;
  /** Net after debts: investments + cash + cpf + vehicles − liabilities. */
  value: number;
  investments: number;
  cash: number;
  cpf: number;
  /** OA / SA / MA / RA / notional CPFIS when a CPF projection exists; else zero. */
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfCpfis: number;
  liabilities: number;
  vehiclesNet: number;
};
