import { z } from "zod";

export const spendPeriodSchema = z.enum(["monthly", "annual"]);

export const expensePostSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1).max(120),
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
  spend_period: spendPeriodSchema.optional(),
});

export const expensePatchSchema = z
  .object({
    amount: z.number().positive().optional(),
    category: z.string().min(1).max(120).optional(),
    spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    note: z.string().max(500).optional().nullable(),
    spend_period: spendPeriodSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field required",
  });

export const budgetQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const projectionQuerySchema = z.object({
  targetAmount: z.coerce.number().positive(),
  investmentId: z.string().uuid().optional().nullable(),
  horizonMonths: z.coerce.number().int().min(1).max(600).optional(),
});

export const cpfAgeBandSchema = z.enum([
  "below_55",
  "above_55_to_60",
  "above_60_to_65",
  "above_65_to_70",
  "above_70",
]);

const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** Local calendar date; must exist and be 1900-01-01 .. end of today. */
export function birthDateIsValidPast(iso: string): boolean {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3) return false;
  const [y, m, d] = parts;
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return false;
  const birth = new Date(y, m - 1, d);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d
  ) {
    return false;
  }
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  return birth <= endToday;
}

export const profilePatchSchema = z
  .object({
    monthly_income: z.number().nonnegative().nullable().optional(),
    salary_frequency: z
      .enum(["monthly", "biweekly", "weekly", "annual"])
      .nullable()
      .optional(),
    annual_bonus: z.number().nonnegative().max(10_000_000).nullable().optional(),
    savings_target_monthly: z
      .number()
      .nonnegative()
      .max(10_000_000)
      .nullable()
      .optional(),
    fixed_expenses_monthly: z
      .number()
      .nonnegative()
      .max(10_000_000)
      .nullable()
      .optional(),
    debt_obligations_monthly: z
      .number()
      .nonnegative()
      .max(10_000_000)
      .nullable()
      .optional(),
    display_name: z.string().max(200).nullable().optional(),
    base_currency: z.string().trim().length(3).toUpperCase().optional(),
    monthly_gross_salary: z.number().nonnegative().nullable().optional(),
    cpf_age_band: cpfAgeBandSchema.nullable().optional(),
    birth_date: isoDateOnly.nullable().optional(),
    target_retirement_age: z
      .number()
      .int()
      .min(50)
      .max(80)
      .nullable()
      .optional(),
    retirement_monthly_spend_goal: z
      .number()
      .nonnegative()
      .max(1_000_000)
      .nullable()
      .optional(),
    retirement_dividend_yield_annual: z
      .number()
      .min(0)
      .max(0.25)
      .nullable()
      .optional(),
    retirement_withdrawal_rate_annual: z
      .number()
      .min(0)
      .max(0.2)
      .nullable()
      .optional(),
    /** Nominal per calendar year (e.g. 0.02); null clears. */
    annual_salary_growth_nominal: z
      .number()
      .min(0)
      .max(0.25)
      .nullable()
      .optional(),
    onboarding_required: z.boolean().optional(),
    onboarding_step: z.number().int().min(1).max(4).nullable().optional(),
    onboarding_completed_at: z.string().datetime().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.birth_date != null &&
      data.birth_date !== undefined &&
      !birthDateIsValidPast(data.birth_date)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Birth date must be a real calendar day on or before today (from 1900).",
        path: ["birth_date"],
      });
    }
  });

/** Single goal for bulk JSON import (max 100 per request). */
export const goalImportItemSchema = z.object({
  title: z.string().min(1).max(200),
  target_amount: z.number().positive(),
  current_amount: z.number().nonnegative().optional().default(0),
  monthly_contribution: z.number().nonnegative().optional().default(0),
  expected_annual_return: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const goalImportBodySchema = z
  .array(goalImportItemSchema)
  .min(1)
  .max(100);

export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const housingLenderTypeSchema = z.enum(["hdb", "bank", "other"]);
