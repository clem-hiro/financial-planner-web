"use client";

import Link from "next/link";
import { useEffect } from "react";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { fpPrimaryButtonClass, fpSecondaryButtonClass } from "@/ui/input-classes";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";

type AppRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
};

/**
 * Branded recovery UI for Next.js route `error.tsx` boundaries inside the app shell.
 */
export function AppRouteError({
  error,
  reset,
  title = "Something went wrong",
  homeHref = "/dashboard",
}: AppRouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className={`mx-auto max-w-lg ${appCardClass} ${appCardPadding}`}
      role="alert"
    >
      <h1 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        We couldn&apos;t load this page. Your data is safe — try again, or return
        to Home while we recover.
      </p>
      {process.env.NODE_ENV === "development" && error.message ? (
        <p className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {error.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={fpPrimaryButtonClass}>
          Try again
        </button>
        <Link href={homeHref} className={fpSecondaryButtonClass}>
          Back to Home
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        If this keeps happening,{" "}
        <Link href="/more" className={appInlineLinkClass}>
          contact support
        </Link>
        .
      </p>
    </div>
  );
}
