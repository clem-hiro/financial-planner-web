import { NextResponse } from "next/server";
import {
  buildProjectionSeries,
  resolveProjectionSnapshot,
  timeToGoalForTarget,
} from "@/data/projection";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { projectionQuerySchema } from "@/lib/validation";

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
  const raw = {
    targetAmount: searchParams.get("targetAmount"),
    investmentId: searchParams.get("investmentId"),
    horizonMonths: searchParams.get("horizonMonths") ?? undefined,
  };

  const parsed = projectionQuerySchema.safeParse({
    targetAmount: raw.targetAmount ?? undefined,
    investmentId: raw.investmentId || null,
    horizonMonths: raw.horizonMonths,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { targetAmount, investmentId, horizonMonths } = parsed.data;

  try {
    const snap = await resolveProjectionSnapshot(
      supabase,
      user.id,
      investmentId ?? null
    );
    if (!snap) {
      return NextResponse.json(
        { error: "No investments to project" },
        { status: 404 }
      );
    }

    const horizon = horizonMonths ?? 120;
    const series = buildProjectionSeries(snap, horizon);
    const timeToGoal = timeToGoalForTarget(snap, targetAmount);

    return NextResponse.json({
      snapshot: snap,
      targetAmount,
      series,
      timeToGoal,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to compute projection" },
      { status: 500 }
    );
  }
}
