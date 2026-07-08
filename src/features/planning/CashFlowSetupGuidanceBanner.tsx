import Link from "next/link";
import type { CashFlowSetupGap } from "@/domain/finance/cash-flow-setup-guidance";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appAmberGuidanceBannerClass } from "@/ui/surface-classes";

type Props = {
  gaps: CashFlowSetupGap[];
};

export function CashFlowSetupGuidanceBanner({ gaps }: Props) {
  if (gaps.length === 0) return null;

  return (
    <div
      className={appAmberGuidanceBannerClass}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-amber-950">
        Cash-flow views are still approximate
      </p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        Finish the steps below so safe-to-spend, monthly review, and surplus
        projections reflect your plan — not placeholders.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-amber-950">
        {gaps.map((gap) => (
          <li key={gap.id}>
            <span className="font-medium">{gap.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-amber-900/85">
              {gap.detail}
            </span>
            <Link href={gap.ctaHref} className={`mt-1 inline-block text-xs ${appInlineLinkClass}`}>
              {gap.ctaLabel} →
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
