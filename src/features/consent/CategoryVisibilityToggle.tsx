"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  ADVISOR_VISIBILITY_LABELS,
  type AdvisorVisibilityCategory,
} from "@/lib/advisor-visibility";
import { updateCategoryVisibilityAction } from "@/server/client-consent-actions";
import { InfoTooltip } from "@/ui/InfoTooltip";

/**
 * One per-category advisor-visibility switch (default PRIVATE). The switch is a
 * form submit button (role="switch") that posts the NEXT desired state via the
 * server action — works without JS; the server re-resolves client + advisor
 * from the session. Shared by /more and the setup tabs so both surfaces write
 * the same `advisor_consent_category_visibility` row and stay in sync.
 */
export function CategoryVisibilityToggle({
  category,
  visible,
  showTooltip = false,
}: {
  category: AdvisorVisibilityCategory;
  visible: boolean;
  /** Show the per-item explanation tooltip beside the switch (setup tabs). */
  showTooltip?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateCategoryVisibilityAction,
    { error: null as string | null }
  );
  // revalidatePath alone is a no-op for the current force-dynamic view; pull
  // server truth after a successful write. `state.visible` is set only by a
  // completed submit, and router.refresh() leaves `state` untouched, so this
  // fires exactly once per toggle — no loop. (Idiom: use-advisor-proposal-refresh.)
  useEffect(() => {
    if (state.visible !== undefined && !state.error) router.refresh();
  }, [state, router]);
  const label = ADVISOR_VISIBILITY_LABELS[category];
  // Optimistic: show the just-submitted value immediately; router.refresh()
  // reconciles to the server-rendered prop.
  const shown = state.visible ?? visible;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="flex items-center gap-2">
          {showTooltip ? (
            <InfoTooltip ariaLabel={`About ${label} adviser visibility`}>
              Controls whether your linked adviser can see this category.
            </InfoTooltip>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="category" value={category} />
            <input
              type="hidden"
              name="is_visible"
              value={shown ? "false" : "true"}
            />
            <button
              type="submit"
              role="switch"
              aria-checked={shown}
              aria-label={`${label} visible to adviser`}
              disabled={pending}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                shown ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  shown ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </form>
        </span>
      </div>
      {state.error ? (
        <p className="text-xs text-rose-600">{state.error}</p>
      ) : null}
    </div>
  );
}
