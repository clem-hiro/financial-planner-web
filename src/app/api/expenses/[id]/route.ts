import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { hasBudgetCategoryMonthlyConflict } from "@/data/expense-budget-guard";
import {
  deleteExpense,
  getExpenseById,
  updateExpense,
} from "@/data/repositories/expenses";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { expensePatchSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = expensePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await getExpenseById(supabase, user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const merged = {
    spent_at: parsed.data.spent_at ?? existing.spent_at,
    category: parsed.data.category ?? existing.category,
    spend_period:
      parsed.data.spend_period ??
      (existing.spend_period === "annual" ? "annual" : "monthly"),
  };

  const conflict = await hasBudgetCategoryMonthlyConflict(
    supabase,
    user.id,
    merged,
    id
  );
  if (conflict) {
    return NextResponse.json(
      {
        error:
          "Another monthly expense already exists for this budget category in that month.",
      },
      { status: 409 }
    );
  }

  try {
    const row = await updateExpense(supabase, user.id, id, parsed.data);
    revalidatePath("/expenses");
    revalidatePath("/budget");
    revalidatePath("/setup");
    revalidatePath("/dashboard");
    return NextResponse.json(row);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await getExpenseById(supabase, user.id, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteExpense(supabase, user.id, id);
    revalidatePath("/expenses");
    revalidatePath("/budget");
    revalidatePath("/setup");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
