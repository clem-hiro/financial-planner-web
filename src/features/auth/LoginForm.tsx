"use client";

import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import {
  clientAccessKeyInputSchema,
  e164PhoneSchema,
  signupFinancialRoleSchema,
} from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneInputField } from "@/features/auth/PhoneInputField";

type Mode = "signin" | "signup";

type SignupRole = "advisor" | "client";

const tabBase =
  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2";

const authInputClass =
  "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";

const authLabelClass = "block text-sm font-medium text-slate-700";

function formatSignupError(message: string): string {
  if (message.includes("Invalid, already used")) return message;
  if (message.includes("expired access key")) return message;
  if (message.includes("Client signup requires")) return message;
  if (/database error/i.test(message)) {
    return "Could not complete signup. If you are a client, confirm your access key with your advisor and try again.";
  }
  return message;
}

export function LoginForm({ initialAuthError }: { initialAuthError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole>("advisor");
  const [advisorPhone, setAdvisorPhone] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
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
      setAdvisorPhone("");
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
        } else {
          const phoneParsed = e164PhoneSchema.safeParse(advisorPhone);
          if (!phoneParsed.success) {
            setError("Enter a valid phone number with country code.");
            return;
          }
          userMeta.phone_e164 = phoneParsed.data;
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
              phone_e164?: string;
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
          setAdvisorPhone("");
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
      className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-slate-200/90 border-t-emerald-600 border-t-4 bg-white p-6 text-left shadow-[0_16px_48px_-24px_rgba(12,25,47,0.12)] sm:max-w-md sm:p-8"
    >
      <div
        className="flex rounded-xl bg-slate-100/90 p-1"
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          id="tab-signin"
          className={`${tabBase} ${
            mode === "signin"
              ? "bg-white text-[#0c192f] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => switchMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          id="tab-signup"
          className={`${tabBase} ${
            mode === "signup"
              ? "bg-white text-[#0c192f] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => switchMode("signup")}
        >
          Sign up
        </button>
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-[#0c192f]">
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
        <fieldset className="space-y-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            I am signing up as
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="signup_role"
                className="h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500/30"
                checked={signupRole === "advisor"}
                onChange={() => setSignupRole("advisor")}
              />
              Financial advisor
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name="signup_role"
                className="h-4 w-4 border-slate-300 text-emerald-700 focus:ring-emerald-500/30"
                checked={signupRole === "client"}
                onChange={() => setSignupRole("client")}
              />
              Client (invited)
            </label>
          </div>
          {signupRole === "client" ? (
            <p className="text-xs text-slate-600">
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
      {mode === "signup" && signupRole === "advisor" ? (
        <label className={authLabelClass}>
          <span className="mb-1.5 block">WhatsApp phone</span>
          <PhoneInputField
            value={advisorPhone}
            onChange={setAdvisorPhone}
            required
            variant="auth"
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
        className="w-full rounded-full bg-[#0c192f] py-3 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45] disabled:opacity-60 sm:py-2.5"
      >
        {pending ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
    </form>
  );
}
