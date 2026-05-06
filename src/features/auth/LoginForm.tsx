"use client";

import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "signup";

const tabBase =
  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2";

export function LoginForm({ initialAuthError }: { initialAuthError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (err) {
          setError(err.message);
          return;
        }
        if (!data.session) {
          setSignupInfo(
            "Check your email and confirm your address to finish creating your account. After confirming, you can sign in."
          );
          setPassword("");
          return;
        }
        router.push("/dashboard");
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
      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-slate-200/90 border-t-emerald-600 border-t-4 bg-white p-6 text-left shadow-[0_16px_48px_-24px_rgba(12,25,47,0.12)] sm:p-8"
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
      <label className="block text-sm font-medium text-slate-700">
        <span className="mb-1.5 block">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        <span className="mb-1.5 block">Password</span>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
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
