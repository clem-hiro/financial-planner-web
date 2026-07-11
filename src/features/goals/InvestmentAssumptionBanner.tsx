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
        figures when your situation changes. Short forward curves use only stated monthly
        contributions and blended expected returns—no automatic invest of leftover take-home.
      </p>
    </div>
  );
}
