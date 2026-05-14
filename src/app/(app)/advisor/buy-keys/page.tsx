import { getPricingByProductCode, ACCESS_KEY_PRODUCT_CODE } from "@/data/repositories/pricing";
import { listPurchasesForAdvisor } from "@/data/repositories/purchases";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AdvisorBuyKeysSection } from "@/features/advisor/AdvisorBuyKeysSection";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import {
  formatSupabaseError,
  isMissingSupabaseObjectError,
} from "@/lib/supabase-error";
import { redirect } from "next/navigation";

async function loadBuyKeysPageData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  try {
    const [pricing, recentPurchases] = await Promise.all([
      getPricingByProductCode(supabase, ACCESS_KEY_PRODUCT_CODE),
      listPurchasesForAdvisor(supabase, userId, 10),
    ]);

    return {
      ok: true as const,
      pricing,
      recentPurchases,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: isMissingSupabaseObjectError(error)
        ? "Buy-keys database setup is not applied yet."
        : "Could not load buy-key purchase data.",
      details: formatSupabaseError(error),
    };
  }
}

export default async function AdvisorBuyKeysPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to buy access keys.</p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileById(supabase, user.id);
  if (!isAdvisor(profile)) {
    redirect("/dashboard");
  }

  const data = await loadBuyKeysPageData(supabase, user.id);

  if (!data.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Buy keys</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Purchase client signup keys using the active advisor coupon workflow.
          </p>
        </div>
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 shadow-sm sm:px-5"
          role="alert"
        >
          <p className="font-semibold">{data.message}</p>
          <p className="mt-2">
            Apply{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
              supabase/migrations/20260517000000_advisor_key_purchases_coupons_contact.sql
            </code>{" "}
            to the Supabase project, then refresh this page.
          </p>
          <p className="mt-2 text-xs text-amber-900/90">
            Supabase returned: {data.details}
          </p>
        </div>
      </div>
    );
  }

  if (!data.pricing) {
    return (
      <p className="text-sm text-zinc-600">Access-key pricing is not configured.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Buy keys</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Purchase client signup keys using the active advisor coupon workflow.
        </p>
      </div>
      <AdvisorBuyKeysSection
        priceCents={data.pricing.price_cents}
        currency={data.pricing.currency}
        recentPurchases={data.recentPurchases}
      />
    </div>
  );
}
