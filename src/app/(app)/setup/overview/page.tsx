import Link from "next/link";
import { getSetupHubSnapshot } from "@/data/setup-status";
import { getRequestAuth } from "@/data/supabase/request-context";
import { FinancialSetupHub } from "@/features/setup-hub/FinancialSetupHub";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export default async function SetupOverviewPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase to view your financial setup progress.
      </p>
    );
  }

  const { supabase, user, profile } = await getRequestAuth();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Financial Setup</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>
          Sign in
        </Link>
      </div>
    );
  }

  const snapshot = await getSetupHubSnapshot(supabase, user.id, profile);

  return <FinancialSetupHub snapshot={snapshot} />;
}
