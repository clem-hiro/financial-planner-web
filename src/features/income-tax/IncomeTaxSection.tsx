import type { IncomeTaxConfigRow, ProfileRow } from "@/data/supabase/types";
import { IncomeTaxForm } from "@/features/income-tax/IncomeTaxForm";
import { TaxComputedSummary } from "@/features/income-tax/TaxComputedSummary";
import { TaxMethodologyTooltip } from "@/features/income-tax/TaxMethodologyTooltip";
import { PageSection } from "@/ui/PageSection";

type Props = {
  profile: ProfileRow | null;
  config: IncomeTaxConfigRow | null;
  referenceYearMonth: string;
};

export function IncomeTaxSection({ profile, config, referenceYearMonth }: Props) {
  return (
    <PageSection
      title="Income tax (Singapore)"
      description={
        <span className="inline-flex items-center gap-2">
          Enter your reliefs and choose how you pay — we compute monthly GIRO or the
          one-time annual amount.
          <TaxMethodologyTooltip />
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <IncomeTaxForm config={config} />
        <TaxComputedSummary
          profile={profile}
          config={config}
          referenceYearMonth={referenceYearMonth}
        />
      </div>
    </PageSection>
  );
}
