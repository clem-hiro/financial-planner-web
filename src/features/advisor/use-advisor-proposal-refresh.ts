"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the client workspace after a suggestion is queued. */
export function useAdvisorProposalRefresh(
  recorded: boolean | undefined,
  error: string | null | undefined
) {
  const router = useRouter();
  useEffect(() => {
    if (recorded && !error) {
      router.refresh();
    }
  }, [recorded, error, router]);
}
