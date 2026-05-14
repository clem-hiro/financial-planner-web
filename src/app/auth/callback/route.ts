import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/data/supabase/server";

// GET /auth/callback?code=<one-time>&next=<dest>
// Landing page for Supabase Auth email-confirmation links (and magic-link / OAuth flows).
// Exchanges the one-time `code` for a session cookie, then hands off to the middleware
// for role + onboarding routing via the `next` destination (defaults to /dashboard).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing authentication code.")}`
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
