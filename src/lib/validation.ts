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
    annual_bonus_months: z
      .number()
      .nonnegative()
      .max(24)
      .nullable()
      .optional(),
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
    /** Nominal expense growth per calendar year (e.g. 0.02); null clears. */
    expense_growth_nominal: z
      .number()
      .min(0)
      .max(0.25)
      .nullable()
      .optional(),
    onboarding_required: z.boolean().optional(),
    onboarding_step: z.number().int().min(1).max(4).nullable().optional(),
    onboarding_completed_at: z.string().datetime().nullable().optional(),
    lifestyle_profile: z
      .enum([
        "student",
        "fresh_graduate",
        "young_professional",
        "married_couple",
        "young_family",
        "high_saver",
        "flexible_lifestyle",
        "freelancer",
        "business_owner",
      ])
      .nullable()
      .optional(),
    budgeting_strategy: z
      .enum(["balanced", "aggressive_saver", "flexible_lifestyle", "custom"])
      .nullable()
      .optional(),
    onboarding_confidence_level: z
      .enum(["rough", "moderate", "detailed"])
      .nullable()
      .optional(),
    budget_generation_source: z
      .enum([
        "user_manual",
        "guided_setup",
        "advisor_recommended",
        "ai_suggested",
      ])
      .nullable()
      .optional(),
    estimated_budget_mode: z.boolean().optional(),
    food_spend_band: z
      .enum([
        "under_300",
        "range_300_600",
        "range_600_1000",
        "above_1000",
        "unknown",
      ])
      .nullable()
      .optional(),
    salary_increment_month: z
      .number()
      .int()
      .min(1)
      .max(12)
      .nullable()
      .optional(),
    last_salary_review_at: z.string().datetime().nullable().optional(),
    last_investment_review_at: z.string().datetime().nullable().optional(),
    last_cpf_rules_review_at: z.string().datetime().nullable().optional(),
    last_cpf_rules_review_version: z.string().min(1).nullable().optional(),
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

export const housingPropertyKindSchema = z.enum([
  "hdb",
  "condo",
  "ec",
  "landed",
]);

/** Full property type list (asset-first housing). */
export const housingPropertyTypeSchema = z.enum([
  "hdb",
  "condo",
  "ec",
  "landed",
  "overseas",
  "other",
  "unknown",
]);

export const housingPropertyStatusSchema = z.enum([
  "living_in",
  "renting_out",
  "under_construction",
  "fully_paid",
]);

export const housingPlanningScopeSchema = z.enum([
  "current",
  "future_simulation",
]);

export const housingDownpaymentGuidancePresetSchema = z.enum([
  "pct_20",
  "pct_25",
  "custom",
]);

export const housingPaymentSourceSchema = z.enum(["cash", "cpf_oa", "split"]);

/** Sign-up role selection on the login page. */
export const signupFinancialRoleSchema = z.enum(["advisor", "client"]);

/** Client access key from advisor (stored uppercase hex in DB). */
export const clientAccessKeyInputSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(
    z
      .string()
      .min(8, "Access key is too short")
      .max(64, "Access key is too long")
      .regex(/^[A-F0-9]+$/, "Invalid access key format")
  );

/**
 * Shape gate for `/login?qr_token=...`. `randomBytes(16)` (128-bit) as unpadded
 * `base64url` is always exactly 22 chars. The URL carries the raw 22-char token;
 * hashing to `token_hash` happens server-side.
 */
export const qrShareTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{22}$/, "Invalid token");

export const advisorAccessKeyPurchaseQuantitySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(1000);

export const markInboxItemReadSchema = z.object({ id: z.string().uuid() });

export const incomeTaxPaymentMethodSchema = z.enum(["monthly_giro", "one_time"]);

/**
 * IRAS-bounded per-field maxima for relief inputs. Bounds match published category
 * caps for YA 2026; users may still over-claim — domain math applies the $80K total cap.
 */
// DB columns are NOT NULL DEFAULT 0; the form sends null for blank reliefs.
// Coerce null→0 here (canonical chokepoint) so the upsert never violates the
// not-null constraint. `.optional()` is preserved so an omitted key stays
// undefined → column left untouched on update / DB default on insert.
const reliefAmount = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === null ? 0 : v));

export const incomeTaxConfigPatchSchema = z
  .object({
    year_of_assessment: z.number().int().min(2024).max(2030).optional(),
    spouse_relief_sgd: reliefAmount(2_000),
    qualifying_child_relief_sgd: reliefAmount(40_000),
    handicapped_child_relief_sgd: reliefAmount(60_000),
    working_mother_child_relief_sgd: reliefAmount(50_000),
    parent_relief_sgd: reliefAmount(36_000),
    grandparent_caregiver_relief_sgd: reliefAmount(3_000),
    handicapped_sibling_relief_sgd: reliefAmount(20_000),
    cpf_cash_topup_self_sgd: reliefAmount(8_000),
    cpf_cash_topup_family_sgd: reliefAmount(8_000),
    srs_contribution_sgd: reliefAmount(35_700),
    cpf_medisave_voluntary_sgd: reliefAmount(37_740),
    nsman_self_relief_sgd: reliefAmount(5_000),
    nsman_wife_relief_sgd: reliefAmount(750),
    nsman_parent_relief_sgd: reliefAmount(750),
    course_fees_relief_sgd: reliefAmount(5_500),
    life_insurance_relief_sgd: reliefAmount(5_000),
    other_reliefs_amount_sgd: reliefAmount(80_000),
    other_reliefs_notes: z.string().max(500).nullable().optional(),
    tax_rebate_percent: z.number().min(0).max(100).nullable().optional(),
    tax_rebate_cap_sgd: z.number().min(0).max(1_000_000).nullable().optional(),
    payment_method: incomeTaxPaymentMethodSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Mirror DB CHECK: rebate percent and cap are both null or both set.
    const percentTouched = data.tax_rebate_percent !== undefined;
    const capTouched = data.tax_rebate_cap_sgd !== undefined;
    if (!percentTouched && !capTouched) return;
    const nextPercent = percentTouched ? data.tax_rebate_percent : undefined;
    const nextCap = capTouched ? data.tax_rebate_cap_sgd : undefined;
    if (percentTouched && capTouched) {
      const percentNull = nextPercent === null;
      const capNull = nextCap === null;
      if (percentNull !== capNull) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "tax_rebate_percent and tax_rebate_cap_sgd must be set together or both cleared.",
          path: ["tax_rebate_percent"],
        });
      }
    } else {
      // Only one side touched: refuse partial update to keep the pair consistent.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Update tax_rebate_percent and tax_rebate_cap_sgd together (or pass both as null to clear).",
        path: [percentTouched ? "tax_rebate_cap_sgd" : "tax_rebate_percent"],
      });
    }
  });

export const debtCategorySchema = z.enum([
  "property",
  "vehicle",
  "personal",
  "credit_card",
  "renovation",
  "education",
  "other",
]);

export const loanTypeSchema = z.enum(["amortized", "flat_rate", "revolving"]);

export const liabilityWriteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  balance: z.number().nonnegative().max(100_000_000),
  category: debtCategorySchema.nullable().optional(),
  loan_type: loanTypeSchema.nullable().optional(),
  interest_rate_annual: z.number().min(0).max(1).nullable().optional(),
  remaining_tenure_months: z
    .number()
    .int()
    .min(0)
    .max(12 * 50)
    .nullable()
    .optional(),
  monthly_repayment: z
    .number()
    .nonnegative()
    .max(1_000_000)
    .nullable()
    .optional(),
  repayment_override: z.boolean().optional(),
  start_date: isoDateOnly.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const couponCodeInputSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(64)
  .regex(/^[A-Z0-9_-]*$/, "Coupon codes can only use letters, numbers, underscores, or hyphens")
  .optional()
  .default("");
