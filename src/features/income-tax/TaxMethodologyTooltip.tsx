import { InfoTooltip } from "@/ui/InfoTooltip";

/** Single-purpose wrapper so the topic id lives next to the feature it documents. */
export function TaxMethodologyTooltip() {
  return (
    <InfoTooltip
      ariaLabel="How Singapore income tax is calculated"
      methodologyTopicId="sg-income-tax-ya2026"
    >
      Singapore income tax — methodology
    </InfoTooltip>
  );
}
