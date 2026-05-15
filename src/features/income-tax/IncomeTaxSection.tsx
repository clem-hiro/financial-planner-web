import { num } from "@/data/mappers";
import type { IncomeTaxConfigRow, ProfileRow } from "@/data/supabase/types";
import { ageCompletedOnDate } from "@/domain/finance/age-projection";
import {
  annualEmployeeCpfTakeHomeWithBonusSg,
  isSgCpfAgeBand,
} from "@/domain/finance/sg-cpf";
import { earnedIncomeReliefForAge } from "@/domain/finance/sg-income-tax";
import { IncomeTaxForm } from "@/features/income-tax/IncomeTaxForm";
import { TaxComputedSummary } from "@/features/income-tax/TaxComputedSummary";
import { TaxMethodologyTooltip } from "@/features/income-tax/TaxMethodologyTooltip";
import { PageSection } from "@/ui/PageSection";

type Props = {
  profile: ProfileRow | null;
  config: IncomeTaxConfigRow | null;
  referenceYearMonth: string;
};

export type AutoAppliedReliefs = {
  mandatoryCpfSgd: number;
  earnedIncomeSgd: number;
  age: number;
};

function deriveAutoAppliedReliefs(
  profile: ProfileRow | null,
  referenceYearMonth: string,
): AutoAppliedReliefs | null {
  if (!profile?.birth_date || !profile.monthly_gross_salary) return null;
  if (!/^\d{4}-\d{2}$/.test(referenceYearMonth)) return null;
  const ageBandRaw = profile.cpf_age_band;
  if (!ageBandRaw || !isSgCpfAgeBand(ageBandRaw)) return null;
  const grossMonthly = num(profile.monthly_gross_salary);
  if (!(grossMonthly > 0)) return null;
  const age = ageCompletedOnDate(profile.birth_date, new Date());
  if (!Number.isFinite(age) || age < 0) return null;
  const annualBonus = profile.annual_bonus ? num(profile.annual_bonus) : 0;
  const mandatoryCpfSgd = annualEmployeeCpfTakeHomeWithBonusSg(
    grossMonthly,
    annualBonus,
    referenceYearMonth,
    ageBandRaw,
  ).employeeCpfContributionAnnual;
  const earnedIncomeSgd = earnedIncomeReliefForAge(age);
  return { mandatoryCpfSgd, earnedIncomeSgd, age };
}

export function IncomeTaxSection({ profile, config, referenceYearMonth }: Props) {
  const autoApplied = deriveAutoAppliedReliefs(profile, referenceYearMonth);
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
        <IncomeTaxForm config={config} autoApplied={autoApplied} />
        <TaxComputedSummary
          profile={profile}
          config={config}
          referenceYearMonth={referenceYearMonth}
        />
      </div>
    </PageSection>
  );
}
