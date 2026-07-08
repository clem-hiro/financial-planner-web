import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appAmberBannerClass } from "@/ui/surface-classes";

/** Shared copy: projections use stated balances and returns only. */
export function InvestmentAssumptionBanner({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`${appAmberBannerClass} ${className}`.trim()} role="note">
      <p className="font-semibold text-amber-950 dark:text-amber-50">
        Assumption-based illustrations
      </p>
      <p className="mt-1">
        Balances and expected returns you enter drive net worth and retirement charts—they
        are not live portfolio data, performance tracking, or financial advice. Update
        figures when your situation changes.
      </p>
      <p className="mt-2">
        <MethodologyOpenLink
          topicId="investment-projection-36m"
          className={appInlineLinkClass}
        >
          How investment projections work
        </MethodologyOpenLink>
      </p>
    </div>
  );
}
