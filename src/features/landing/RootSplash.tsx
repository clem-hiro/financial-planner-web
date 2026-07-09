import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import {
  appBrandHeaderStyle,
  appBrandNavyTextStyle,
} from "@/ui/app-tab-styles";

const highlights = [
  {
    title: "Command center",
    body: "Net worth, cash flow, and month health in one calm view.",
  },
  {
    title: "Singapore-aware",
    body: "CPF, housing, and guided setup tuned for local planning.",
  },
  {
    title: "Advisor-linked",
    body: "Private workspace access through your financial advisor.",
  },
] as const;

export function RootSplash() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-14 sm:py-20">
      <div className="w-full max-w-lg space-y-8">
        <div
          className="rounded-3xl border border-slate-200/80 p-6 text-white shadow-lg sm:p-8"
          style={appBrandHeaderStyle}
        >
          <p className="text-xs font-semibold tracking-wide text-emerald-200/90">
            Wealth planner
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            BYOFA
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-100/90">
            Net worth, cash flow, goals, and thoughtful projections — built for
            clients working with their advisor.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3 sm:gap-2">
          {highlights.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm"
            >
              <p
                className="text-sm font-semibold tracking-tight"
                style={appBrandNavyTextStyle}
              >
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {item.body}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-center gap-4 text-center">
          {!isSupabaseConfigured() ? (
            <div className="w-full rounded-2xl border border-amber-200/80 bg-amber-50/95 p-5 text-left text-sm leading-relaxed text-amber-950 shadow-sm">
              Add Supabase keys to{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                .env.local
              </code>{" "}
              to enable sign-in.
            </div>
          ) : (
            <Link
              href="/login"
              className="exec-navy-btn inline-flex rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition"
            >
              Sign in to your workspace
            </Link>
          )}
          <p className="text-xs text-slate-500">
            New client? Use the access key or invite link from your advisor.
          </p>
        </div>
      </div>
    </div>
  );
}
