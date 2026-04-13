import { LoginForm } from "@/features/auth/LoginForm";
import { isSupabaseConfigured } from "@/lib/env";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      {!isSupabaseConfigured() ? (
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Add Supabase keys to <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
          to enable auth.
        </div>
      ) : (
        <LoginForm />
      )}
      <Link
        href="/dashboard"
        className="mt-6 text-sm text-zinc-600 hover:text-zinc-900"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
