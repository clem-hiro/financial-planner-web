import { defaultLoanTypeForCategory } from "@/domain/finance/debt-repayment";
import type { DebtCategory, LoanType } from "@/domain/finance/debt-repayment";
import { liabilityWriteSchema } from "@/lib/validation";
import type { LiabilityWriteInput } from "@/data/repositories/liabilities";

function optionalNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseLiabilityFormData(formData: FormData):
  | { ok: true; data: LiabilityWriteInput }
  | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance"));
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const category =
    categoryRaw === "" ? null : (categoryRaw as DebtCategory);
  const loanTypeRaw = String(formData.get("loan_type") ?? "").trim();
  let loan_type: LoanType | null =
    loanTypeRaw === "" ? null : (loanTypeRaw as LoanType);
  if (!loan_type && category) {
    loan_type = defaultLoanTypeForCategory(category);
  }

  const ratePercent = optionalNumber(formData.get("interest_rate_percent"));
  const interest_rate_annual =
    ratePercent != null ? ratePercent / 100 : null;

  const tenureYears = optionalNumber(formData.get("remaining_tenure_years"));
  const tenureMonthsDirect = optionalNumber(
    formData.get("remaining_tenure_months")
  );
  const hasTenureYears = tenureYears != null;
  const hasTenureMonths =
    tenureMonthsDirect != null && (hasTenureYears || tenureMonthsDirect > 0);
  const remaining_tenure_months =
    hasTenureYears || hasTenureMonths
      ? Math.round((tenureYears ?? 0) * 12) +
        Math.round(tenureMonthsDirect ?? 0)
      : null;

  const monthly_repayment = optionalNumber(formData.get("monthly_repayment"));
  const repayment_override =
    String(formData.get("repayment_override") ?? "") === "true" ||
    String(formData.get("repayment_override") ?? "") === "on";

  const startRaw = String(formData.get("start_date") ?? "").trim();
  const start_date = startRaw === "" ? null : startRaw;

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw === "" ? null : notesRaw;

  const parsed = liabilityWriteSchema.safeParse({
    name,
    balance,
    category,
    loan_type,
    interest_rate_annual,
    remaining_tenure_months,
    monthly_repayment,
    repayment_override,
    start_date,
    notes,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid debt details";
    return { ok: false, error: msg };
  }

  return { ok: true, data: parsed.data };
}

export { parseLiabilityFormData };
