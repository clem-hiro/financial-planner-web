import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const appRouteRegex =
  /^\/(dashboard|expenses|budget|setup|balances|goals|financial-profile|onboarding|account-issue)/;

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isAccountIssueRoute = pathname.startsWith("/account-issue");
  const isAppRoute = appRouteRegex.test(pathname);
  if (user && isAppRoute) {
    const { data: profile } = await supabase
      .from("financial_profiles")
      .select(
        "onboarding_required,onboarding_completed_at,profile_type,advisor_user_id"
      )
      .eq("id", user.id)
      .maybeSingle();

    const profileType =
      profile?.profile_type === "client" ? "client" : "advisor";
    const clientMissingAdvisor =
      profileType === "client" &&
      (profile?.advisor_user_id == null ||
        String(profile.advisor_user_id).trim() === "");

    if (clientMissingAdvisor && !isAccountIssueRoute) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = "/account-issue";
      return NextResponse.redirect(nextUrl);
    }

    const needsOnboarding =
      profileType === "client" &&
      !!profile?.onboarding_required &&
      !profile?.onboarding_completed_at;
    if (needsOnboarding && !isOnboardingRoute && !clientMissingAdvisor) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = "/onboarding";
      return NextResponse.redirect(nextUrl);
    }
    if (!needsOnboarding && isOnboardingRoute) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = "/dashboard";
      return NextResponse.redirect(nextUrl);
    }
  }
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
