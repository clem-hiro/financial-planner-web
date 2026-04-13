"use client";

import { InfoTooltip } from "@/ui/InfoTooltip";

/** Compact header hints for the Income & retirement dashboard section. */
export function IncomeRetirementSectionActions() {
  return (
    <span className="flex items-center gap-0.5">
      <InfoTooltip
        methodologyTopicId="net-worth"
        ariaLabel="Salary and net worth (no double counting)"
      >
        <span className="sr-only">Net worth methodology</span>
      </InfoTooltip>
      <InfoTooltip
        methodologyTopicId="cpf-projection"
        ariaLabel="CPF projection and salary fields"
      >
        <span className="sr-only">CPF projection methodology</span>
      </InfoTooltip>
    </span>
  );
}
