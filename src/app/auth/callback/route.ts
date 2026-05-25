import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/data/supabase/server";

// GET /auth/callback?code=<one-time>&next=<dest>
// Landing page for Supabase Auth email-confirmation links (and magic-link / OAuth flows).
// Exchanges the one-time `code` for a session cookie, then hands off to the middleware
// for role + onboarding routing via the `next` destination (defaults to `/`).
function safeNext(raw: string | null): string {
  // Same-origin path only: must start with a single `/`, not `//` or `/\`,
  // and stay under a sane header length.
  if (!raw || raw.length > 512) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

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
