import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getIncomeTaxConfig,
  upsertIncomeTaxConfig,
  type IncomeTaxConfigPatch,
} from "@/data/repositories/income-tax-configs";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { incomeTaxConfigPatchSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
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

  const parsed = incomeTaxConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Schema is `.partial()`; an empty body is a no-op so we just return current state.
  const patch = parsed.data as IncomeTaxConfigPatch;
  if (Object.keys(patch).length === 0) {
    const current = await getIncomeTaxConfig(supabase, user.id);
    return NextResponse.json(current);
  }

  try {
    const row = await upsertIncomeTaxConfig(supabase, user.id, patch);
    revalidateSetupAndPlanning();
    revalidatePath("/budget");
    revalidatePath("/dashboard");
    return NextResponse.json(row);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update income tax config" },
      { status: 500 }
    );
  }
}
