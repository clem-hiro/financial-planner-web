import { yearMonthSchema } from "@/lib/validation";

function optionalYearMonth(
  raw: string
): { ok: true; value: string | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!yearMonthSchema.safeParse(t).success) return { ok: false };
  return { ok: true, value: t };
}

export type ParsedVehicleForm = {
  label: string;
  vehicle_status: "active";
  loan_balance: number;
  loan_monthly_payment: number;
  loan_end_ym: string | null;
  monthly_petrol_cashcard: number;
  annual_insurance: number;
  annual_road_tax: number;
  annual_maintenance: number;
};

function nonNegativeMoney(
  raw: string,
  label: string,
  { allowBlank = false }: { allowBlank?: boolean } = {}
):
  | { ok: true; value: number }
  | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    if (allowBlank) return { ok: true, value: 0 };
    return { ok: false, error: `${label} is required` };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `Invalid ${label.toLowerCase()}` };
  }
  return { ok: true, value: n };
}

export function parseVehicleFormData(
  formData: FormData
): { ok: true; data: ParsedVehicleForm } | { ok: false; error: string } {
  const label = String(formData.get("label") ?? "").trim() || "Vehicle";

  const loanBalParsed = nonNegativeMoney(
    String(formData.get("loan_balance") ?? ""),
    "Outstanding loan",
    { allowBlank: true }
  );
  if (!loanBalParsed.ok) return loanBalParsed;

  const instalmentParsed = nonNegativeMoney(
    String(formData.get("loan_monthly_payment") ?? ""),
    "Monthly instalment",
    { allowBlank: true }
  );
  if (!instalmentParsed.ok) return instalmentParsed;

  const petrolParsed = nonNegativeMoney(
    String(formData.get("monthly_petrol_cashcard") ?? ""),
    "Monthly petrol + Cashcard",
    { allowBlank: true }
  );
  if (!petrolParsed.ok) return petrolParsed;

  const insuranceParsed = nonNegativeMoney(
    String(formData.get("annual_insurance") ?? ""),
    "Annual insurance",
    { allowBlank: true }
  );
  if (!insuranceParsed.ok) return insuranceParsed;

  const roadTaxParsed = nonNegativeMoney(
    String(formData.get("annual_road_tax") ?? ""),
    "Annual road tax",
    { allowBlank: true }
  );
  if (!roadTaxParsed.ok) return roadTaxParsed;

  const maintenanceParsed = nonNegativeMoney(
    String(formData.get("annual_maintenance") ?? ""),
    "Annual maintenance",
    { allowBlank: true }
  );
  if (!maintenanceParsed.ok) return maintenanceParsed;

  const loanEndParsed = optionalYearMonth(
    String(formData.get("loan_end_ym") ?? "")
  );
  if (!loanEndParsed.ok) {
    return { error: "Loan end month must be YYYY-MM or blank", ok: false };
  }

  return {
    ok: true,
    data: {
      label,
      vehicle_status: "active",
      loan_balance: loanBalParsed.value,
      loan_monthly_payment: instalmentParsed.value,
      loan_end_ym: loanEndParsed.value,
      monthly_petrol_cashcard: petrolParsed.value,
      annual_insurance: insuranceParsed.value,
      annual_road_tax: roadTaxParsed.value,
      annual_maintenance: maintenanceParsed.value,
    },
  };
}
