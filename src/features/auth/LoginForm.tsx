"use client";

import { createSupabaseBrowserClient } from "@/data/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          setError(err.message);
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) {
          setError(err.message);
          return;
        }
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
      <h2 className="text-lg font-semibold tracking-tight text-[#0c192f]">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h2>
      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-red-800" role="alert">
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
      <button
        type="button"
        className="w-full text-center text-sm font-medium text-slate-600 transition hover:text-emerald-800"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Have an account? Sign in"}
      </button>
    </form>
  );
}
