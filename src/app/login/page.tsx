import { LoginForm } from "@/features/auth/LoginForm";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { qrShareTokenSchema } from "@/lib/validation";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ error?: string; qr_token?: string }>;
};

// Read-only peek: validates the token without consuming it. Redemption happens
// inside the auth-insert trigger (atomic with the bind), so this GET only reads.
// Returns the access key plus the issuing advisor's name for the scan view.
async function peekQrTokenIfPresent(
  token: string | undefined
): Promise<{ accessKey?: string; advisorName?: string }> {
  if (!token) return {};
  const parsed = qrShareTokenSchema.safeParse(token);
  if (!parsed.success) return {};
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("peek_qr_share_token", {
      p_token: parsed.data,
    });
    if (error) return {};
    const row = (Array.isArray(data) ? data[0] : data) as
      | { access_key?: string; advisor_display_name?: string }
      | undefined;
    if (!row?.access_key) return {};
    return {
      accessKey: row.access_key,
      advisorName: row.advisor_display_name?.trim() || undefined,
    };
  } catch (e) {
    console.error("peek_qr_share_token failed", e);
    return {};
  }
}

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const authError = sp.error?.trim() ? sp.error : undefined;
  const rawQrToken = sp.qr_token?.trim();
  const peeked = isSupabaseConfigured()
    ? await peekQrTokenIfPresent(rawQrToken)
    : {};
  const initialAccessKey = peeked.accessKey;
  const initialQrToken = initialAccessKey ? rawQrToken : undefined;
  const initialAdvisorName = initialAccessKey ? peeked.advisorName : undefined;

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16 sm:py-20">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/90">
            Client access
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
            Welcome back
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Sign in to your private workspace.
          </p>
        </div>
        {!isSupabaseConfigured() ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/95 p-5 text-left text-sm leading-relaxed text-amber-950 shadow-sm sm:p-6">
            Add Supabase keys to{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
              .env.local
            </code>{" "}
            to enable auth.
          </div>
        ) : (
          <LoginForm
            initialAuthError={authError}
            initialAccessKey={initialAccessKey}
            initialQrToken={initialQrToken}
            initialAdvisorName={initialAdvisorName}
          />
        )}
        <Link
          href="/"
          className="inline-block text-sm font-medium text-slate-600 underline decoration-slate-300/80 underline-offset-4 transition hover:text-emerald-800 hover:decoration-emerald-300/70"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
