import { NextResponse } from "next/server";
import { getDashboardPayload } from "@/data/dashboard";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { formatYearMonth, parseYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";

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
  const month =
    monthParam && parseYearMonth(monthParam)
      ? monthParam
      : formatYearMonth(new Date());

  try {
    const payload = await getDashboardPayload(supabase, user.id, month);
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
