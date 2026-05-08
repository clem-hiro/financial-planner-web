import { redirect } from "next/navigation";
import { num } from "@/data/mappers";
import { needsOnboarding } from "@/data/financial-profile";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { isSupabaseConfigured } from "@/lib/env";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfileById(supabase, user.id);
  if (!needsOnboarding(profile)) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Let&apos;s set up your plan</h1>
      <p className="text-sm text-slate-600">
        Start simple now. You can edit everything later in Financial Settings.
      </p>
      <OnboardingWizard
        initialDisplayName={profile?.display_name ?? ""}
        initialMonthlyIncome={
          profile?.monthly_income != null ? num(profile.monthly_income) : null
        }
        initialBaseCurrency={profile?.base_currency ?? DEFAULT_BASE_CURRENCY}
        initialAnnualBonus={profile?.annual_bonus != null ? num(profile.annual_bonus) : null}
        initialSavingsTarget={
          profile?.savings_target_monthly != null
            ? num(profile.savings_target_monthly)
            : null
        }
        initialDebtObligations={
          profile?.debt_obligations_monthly != null
            ? num(profile.debt_obligations_monthly)
            : null
        }
        initialStep={profile?.onboarding_step ?? 1}
      />
    </div>
  );
}
