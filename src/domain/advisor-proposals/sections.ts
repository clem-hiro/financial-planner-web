/** Stable section slugs stored on proposal changes — do not rename without migration. */
export const PROPOSAL_SECTION_IDS = [
  "profile_assumptions",
  "retirement_planning",
  "cash_flow",
  "goals",
  "investments",
  "insurance",
  "cpf_planning",
  "dependents",
] as const;

export type ProposalSectionId = (typeof PROPOSAL_SECTION_IDS)[number];

export const PROPOSAL_SECTION_LABELS: Record<ProposalSectionId, string> = {
  profile_assumptions: "Profile & assumptions",
  retirement_planning: "Retirement planning",
  cash_flow: "Cash flow",
  goals: "Goals & priorities",
  investments: "Investments",
  insurance: "Insurance",
  cpf_planning: "CPF planning",
  dependents: "Dependents",
};

export const PROPOSAL_SECTION_ORDER: ProposalSectionId[] = [
  "profile_assumptions",
  "retirement_planning",
  "cpf_planning",
  "cash_flow",
  "investments",
  "goals",
  "insurance",
  "dependents",
];

export type ProposalEntityType =
  | "profile"
  | "budget_line"
  | "goal"
  | "investment"
  | "cash_account"
  | "liability"
  | "property"
  | "housing_loan"
  | "vehicle";

export function sectionLabel(section: string): string {
  if (section in PROPOSAL_SECTION_LABELS) {
    return PROPOSAL_SECTION_LABELS[section as ProposalSectionId];
  }
  return section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function compareSectionOrder(a: string, b: string): number {
  const ia = PROPOSAL_SECTION_ORDER.indexOf(a as ProposalSectionId);
  const ib = PROPOSAL_SECTION_ORDER.indexOf(b as ProposalSectionId);
  const ao = ia === -1 ? 999 : ia;
  const bo = ib === -1 ? 999 : ib;
  return ao - bo;
}
