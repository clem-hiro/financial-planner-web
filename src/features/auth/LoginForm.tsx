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
      className="mx-auto max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold text-zinc-900">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-zinc-600">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600">Password</span>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </button>
      <button
        type="button"
        className="w-full text-center text-sm text-zinc-600 hover:text-zinc-900"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Have an account? Sign in"}
      </button>
    </form>
  );
}
