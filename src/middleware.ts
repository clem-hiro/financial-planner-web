import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const clientAppRouteRegex =
  /^\/(dashboard|expenses|spending|budget|setup|balances|goals|financial-profile|onboarding|account-issue)/;

const advisorAppRouteRegex = /^\/advisor(\/|$)/;

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
  const isClientAppRoute = clientAppRouteRegex.test(pathname);
  const isAdvisorRoute = advisorAppRouteRegex.test(pathname);
  const isGatedAppRoute = isClientAppRoute || isAdvisorRoute;

  if (user && isGatedAppRoute) {
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

    if (profileType === "advisor") {
      if (isOnboardingRoute || isClientAppRoute) {
        const nextUrl = request.nextUrl.clone();
        nextUrl.pathname = "/advisor";
        return NextResponse.redirect(nextUrl);
      }
      return supabaseResponse;
    }

    if (isAdvisorRoute) {
      const nextUrl = request.nextUrl.clone();
      if (clientMissingAdvisor) {
        nextUrl.pathname = "/account-issue";
      } else if (
        !!profile?.onboarding_required &&
        !profile?.onboarding_completed_at
      ) {
        nextUrl.pathname = "/onboarding";
      } else {
        nextUrl.pathname = "/dashboard";
      }
      return NextResponse.redirect(nextUrl);
    }

    if (clientMissingAdvisor && !isAccountIssueRoute) {
      const nextUrl = request.nextUrl.clone();
      nextUrl.pathname = "/account-issue";
      return NextResponse.redirect(nextUrl);
    }

    const needsOnboarding =
      !!profile?.onboarding_required && !profile?.onboarding_completed_at;
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
