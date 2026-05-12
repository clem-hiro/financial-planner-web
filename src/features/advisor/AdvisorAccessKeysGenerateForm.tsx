"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  generateAdvisorAccessKeysPocFormAction,
  type GenerateAdvisorKeysFormState,
} from "@/server/advisor-access-key-actions";
import { ADVISOR_ACCESS_KEY_BATCH_POC } from "@/lib/advisor-access-key-token";

const initial: GenerateAdvisorKeysFormState = {
  error: null,
  info: null,
};

export function AdvisorAccessKeysGenerateForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    generateAdvisorAccessKeysPocFormAction,
    initial
  );

  useEffect(() => {
    if (state.info) router.refresh();
  }, [state.info, router]);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.info ? (
        <p className="text-sm text-emerald-800" role="status">
          {state.info}
        </p>
      ) : null}
      <button
        type="submit"
        className="rounded-full bg-[#0c192f] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-[#152a45]"
      >
        Generate {ADVISOR_ACCESS_KEY_BATCH_POC} free keys (POC)
      </button>
    </form>
  );
}
