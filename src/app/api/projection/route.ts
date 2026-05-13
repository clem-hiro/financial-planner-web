import { NextResponse } from "next/server";
import {
  buildInvestmentProjectionSeries,
  projectionSnapshotFromInvestmentRows,
  timeToGoalForTarget,
} from "@/data/projection";
import { getInvestmentById, listInvestments } from "@/data/repositories/investments";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ageCompletedOnDate } from "@/domain/finance";
import { isSupabaseConfigured } from "@/lib/env";
import { birthDateIsValidPast, projectionQuerySchema } from "@/lib/validation";

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
    const asOf = new Date();
    const [rows, profile] = await Promise.all([
      investmentId
        ? getInvestmentById(supabase, user.id, investmentId).then((r) =>
            r ? [r] : []
          )
        : listInvestments(supabase, user.id),
      getProfileById(supabase, user.id),
    ]);

    const snap = projectionSnapshotFromInvestmentRows(rows);
    if (!snap) {
      return NextResponse.json(
        { error: "No investments to project" },
        { status: 404 }
      );
    }

    const birthRaw = profile?.birth_date;
    const rawTarget =
      profile?.target_retirement_age != null
        ? Math.round(Number(profile.target_retirement_age))
        : 65;
    const targetRetirementAgeResolved = Math.min(80, Math.max(50, rawTarget));
    const monthsToRetirementFromNow =
      birthRaw &&
      typeof birthRaw === "string" &&
      birthDateIsValidPast(birthRaw)
        ? Math.max(
            0,
            (targetRetirementAgeResolved - ageCompletedOnDate(birthRaw, asOf)) *
              12
          )
        : null;

    const horizon = horizonMonths ?? 120;
    const series = buildInvestmentProjectionSeries(rows, horizon, {
      monthsToRetirementFromNow,
    });
    const timeToGoal = timeToGoalForTarget(snap, targetAmount, {
      investmentRows: rows,
      monthsToRetirementFromNow,
    });

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
