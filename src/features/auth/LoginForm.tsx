"use client";

import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import {
  clientAccessKeyInputSchema,
  signupFinancialRoleSchema,
} from "@/lib/validation";
import {
  appActiveGradientStyle,
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";
import { fpInputFullClass, fpPrimaryButtonClass } from "@/ui/input-classes";
import {
  appCardClass,
  appCardPadding,
  appEmeraldPanelClass,
} from "@/ui/surface-classes";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatSignupError } from "@/features/auth/signup-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

type SignupRole = "advisor" | "client";

const authInputClass = `${fpInputFullClass} min-h-11`;

const authLabelClass =
  "block text-sm font-medium text-slate-700 dark:text-slate-300";

export function LoginForm({
  initialAuthError,
  initialAccessKey,
  initialQrToken,
  initialAdvisorName,
}: {
  initialAuthError?: string;
  initialAccessKey?: string;
  initialQrToken?: string;
  initialAdvisorName?: string;
}) {
  const router = useRouter();
  const prefilledKey = initialAccessKey?.trim() ?? "";
  const [qrToken] = useState(initialQrToken ?? null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole>(
    prefilledKey ? "client" : "advisor"
  );
  const [accessKey, setAccessKey] = useState(prefilledKey);
  const [mode, setMode] = useState<Mode>(prefilledKey ? "signup" : "signin");
  const [error, setError] = useState<string | null>(() =>
    initialAuthError?.trim() ? initialAuthError : null
  );
  const [signupInfo, setSignupInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSignupInfo(null);
    if (next === "signin") {
      setSignupRole("advisor");
      setAccessKey("");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignupInfo(null);
    setPending(true);
    try {
      let supabase;
      try {
        supabase = createSupabaseBrowserClient();
      } catch {
        setError("Supabase is not configured.");
        return;
      }

      if (mode === "signup") {
        const roleParsed = signupFinancialRoleSchema.safeParse(signupRole);
        if (!roleParsed.success) {
          setError("Choose Financial advisor or Client.");
          return;
        }
        const role = roleParsed.data;

        const userMeta: Record<string, unknown> = {
          display_name: displayName.trim() || undefined,
          profile_type: role,
        };

        if (role === "client") {
          if (qrToken) {
            // QR flow: the auth-insert trigger redeems the token atomically
            // with the key-claim + advisor bind (single-use, fail-closed). No
            // pre-validate, no access_key in metadata — the token is the only
            // binding source of truth.
            userMeta.qr_token = qrToken;
          } else {
            const keyParsed = clientAccessKeyInputSchema.safeParse(accessKey);
            if (!keyParsed.success) {
              const msg = keyParsed.error.flatten().formErrors[0] ?? "Invalid access key";
              setError(msg);
              return;
            }
            const normalizedKey = keyParsed.data;
            const { data: keyOk, error: rpcErr } = await supabase.rpc(
              "validate_client_access_key_for_signup",
              { p_key: normalizedKey }
            );
            if (rpcErr) {
              setError(rpcErr.message || "Could not validate access key.");
              return;
            }
            if (!keyOk) {
              setError("Invalid, already used, or expired access key. Ask your advisor for a new key.");
              return;
            }
            userMeta.access_key = normalizedKey;
          }
        }

        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: userMeta as {
              display_name?: string;
              profile_type: string;
              access_key?: string;
              qr_token?: string;
            },
          },
        });
        if (err) {
          setError(formatSignupError(err.message));
          return;
        }
        if (!data.session) {
          setSignupInfo(
            "Check your email and confirm your address to finish creating your account. After confirming, you can sign in."
          );
          setPassword("");
          setAccessKey("");
          return;
        }
        router.push(role === "advisor" ? "/advisor" : "/onboarding");
        router.refresh();
        return;
      }

      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }

      const {
        data: { user: signedInUser },
      } = await supabase.auth.getUser();
      if (!signedInUser) {
        setError("Signed in but could not load session.");
        return;
      }

      const { data: finProfile, error: profileErr } = await supabase
        .from("financial_profiles")
        .select(
          "profile_type, advisor_user_id, onboarding_required, onboarding_completed_at"
        )
        .eq("id", signedInUser.id)
        .maybeSingle();

      if (profileErr) {
        setError(profileErr.message);
        return;
      }

      const role = finProfile?.profile_type === "client" ? "client" : "advisor";
      if (role === "advisor") {
        router.push("/advisor");
        router.refresh();
        return;
      }

      const missingAdvisor =
        finProfile?.advisor_user_id == null ||
        String(finProfile.advisor_user_id).trim() === "";
      if (missingAdvisor) {
        router.push("/account-issue");
        router.refresh();
        return;
      }

      const needsOnboarding =
        !!finProfile?.onboarding_required && !finProfile?.onboarding_completed_at;
      router.push(needsOnboarding ? "/onboarding" : "/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto w-full max-w-sm space-y-5 border-t-4 border-t-emerald-600 text-left sm:max-w-md ${appCardClass} ${appCardPadding}`}
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay
        active={pending}
        message={mode === "signin" ? "Signing in…" : "Creating account…"}
      />
      {mode === "signup" && initialAdvisorName ? (
        <div
          className={`${appEmeraldPanelClass} px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100`}
          role="note"
        >
          You&rsquo;re connecting with{" "}
          <span className="font-semibold">{initialAdvisorName}</span>
        </div>
      ) : null}

      <div
        className={`${appTabRailClass} w-full`}
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          id="tab-signin"
          className={`${appTabPillClass} flex-1 ${
            mode === "signin" ? appTabPillActiveClass : appTabPillInactiveClass
          }`}
          style={mode === "signin" ? appActiveGradientStyle : undefined}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          id="tab-signup"
          className={`${appTabPillClass} flex-1 ${
            mode === "signup" ? appTabPillActiveClass : appTabPillInactiveClass
          }`}
          style={mode === "signup" ? appActiveGradientStyle : undefined}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-[#0c192f] dark:text-slate-100">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h2>

      {signupInfo && (
        <p
          className="rounded-lg border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-950"
          role="status"
        >
          {signupInfo}
        </p>
      )}
      {error && (
        <p
          className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      {mode === "signup" ? (
        <fieldset className="space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 dark:border-slate-700/90 dark:bg-slate-900/45">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            I am signing up as
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="signup_role"
                className="h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400"
                checked={signupRole === "advisor"}
                onChange={() => setSignupRole("advisor")}
              />
              Financial advisor
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="signup_role"
                className="h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-400"
                checked={signupRole === "client"}
                onChange={() => setSignupRole("client")}
              />
              Client (invited)
            </label>
          </div>
          {signupRole === "client" ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Clients need a one-time access key from their financial advisor. Free-form public signup
              is not available for clients.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <label className={authLabelClass}>
        <span className="mb-1.5 block">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          className={authInputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className={authLabelClass}>
        <span className="mb-1.5 block">Password</span>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          className={authInputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {mode === "signup" && signupRole === "client" ? (
        <label className={authLabelClass}>
          <span className="mb-1.5 block">Advisor access key</span>
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            required
            placeholder="Paste the key from your advisor"
            className={`${authInputClass} font-mono`}
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
          />
        </label>
      ) : null}
      {mode === "signup" && (
        <label className={authLabelClass}>
          <span className="mb-1.5 block">Display name (optional)</span>
          <input
            type="text"
            autoComplete="name"
            className={authInputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`w-full py-3 disabled:opacity-60 sm:py-2.5 ${fpPrimaryButtonClass}`}
      >
        {pending ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
    </form>
  );
}
