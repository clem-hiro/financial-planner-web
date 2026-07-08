"use client";

import { AppRouteError } from "@/ui/AppRouteError";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppRouteError error={error} reset={reset} />;
}
