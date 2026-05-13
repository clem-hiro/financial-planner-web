import { revalidatePath } from "next/cache";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { NextResponse } from "next/server";
import { hasBudgetCategoryMonthlyConflict } from "@/data/expense-budget-guard";
import { insertExpense } from "@/data/repositories/expenses";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { expensePostSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = expensePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const spend_period = parsed.data.spend_period ?? "monthly";
  const conflict = await hasBudgetCategoryMonthlyConflict(
    supabase,
    user.id,
    {
      spent_at: parsed.data.spent_at,
      category: parsed.data.category,
      spend_period,
    }
  );
  if (conflict) {
    return NextResponse.json(
      {
        error:
          "This budget category already has a monthly expense for that month. Edit or delete it first.",
      },
      { status: 409 }
    );
  }

  try {
    const row = await insertExpense(supabase, user.id, {
      ...parsed.data,
      spend_period,
    });
    revalidatePath("/expenses");
    revalidatePath("/budget");
    revalidateSetupAndPlanning();
    revalidatePath("/dashboard");
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
