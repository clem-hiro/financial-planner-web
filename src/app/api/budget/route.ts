import { NextResponse } from "next/server";
import { getBudgetPageModel } from "@/data/budget-summary";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { formatYearMonth, parseYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { budgetQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const month =
    monthParam && parseYearMonth(monthParam)
      ? monthParam
      : formatYearMonth(new Date());
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  const parsed = budgetQuerySchema.safeParse({ month, year });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const model = await getBudgetPageModel(
      supabase,
      user.id,
      parsed.data.month,
      parsed.data.year
    );
    return NextResponse.json(model);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load budget" },
      { status: 500 }
    );
  }
}
