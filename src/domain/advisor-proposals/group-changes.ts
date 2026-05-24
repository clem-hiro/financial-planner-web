import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import { compareSectionOrder } from "@/domain/advisor-proposals/sections";

export type ProposalEntityGroup = {
  entityType: AdvisorProposalChangeRow["entity_type"];
  entityId: string | null;
  changes: AdvisorProposalChangeRow[];
  /** Short label for grouped rows (e.g. goal title, investment name). */
  headline: string;
};

export type ProposalSectionGroup = {
  section: string;
  changes: AdvisorProposalChangeRow[];
  entities: ProposalEntityGroup[];
};

function entityKey(c: AdvisorProposalChangeRow): string {
  return `${c.entity_type}:${c.entity_id ?? "profile"}`;
}

function headlineForEntity(changes: AdvisorProposalChangeRow[]): string {
  const nameChange = changes.find((c) => c.field_key === "name");
  if (nameChange?.new_value?.trim()) return nameChange.new_value.trim();
  const withContext = changes.find((c) => c.field_label.includes("("));
  if (withContext) {
    const m = withContext.field_label.match(/\(([^)]+)\)\s*$/);
    if (m?.[1]) return m[1];
  }
  if (changes.some((c) => c.field_key === "_deleted")) {
    const del = changes.find((c) => c.field_label.includes("("));
    if (del) {
      const m = del.field_label.match(/\(([^)]+)\)/);
      if (m?.[1]) return `Remove ${m[1]}`;
    }
    return "Remove account";
  }
  const isNew = changes.every((c) => !c.old_value);
  if (isNew && changes[0]?.entity_type === "investment") return "New investment account";
  if (isNew && changes[0]?.entity_type === "cash_account") return "New cash account";
  if (isNew && changes[0]?.entity_type === "liability") return "New liability";
  if (changes[0]?.entity_type === "profile") return "Profile fields";
  if (changes[0]?.entity_type === "budget_line") return "Budget line";
  if (changes[0]?.entity_type === "goal") return "Goal contribution";
  if (changes[0]?.entity_type === "cash_account") return "Cash account";
  if (changes[0]?.entity_type === "liability") return "Liability";
  return "Update";
}

export function groupChangesBySection(
  changes: AdvisorProposalChangeRow[]
): ProposalSectionGroup[] {
  const sectionMap = new Map<string, AdvisorProposalChangeRow[]>();
  for (const c of changes) {
    const list = sectionMap.get(c.section) ?? [];
    list.push(c);
    sectionMap.set(c.section, list);
  }

  return [...sectionMap.entries()]
    .sort(([a], [b]) => compareSectionOrder(a, b))
    .map(([section, sectionChanges]) => {
      const entityMap = new Map<string, AdvisorProposalChangeRow[]>();
      for (const c of sectionChanges) {
        const key = entityKey(c);
        const list = entityMap.get(key) ?? [];
        list.push(c);
        entityMap.set(key, list);
      }
      const entities = [...entityMap.values()].map((entityChanges) => ({
        entityType: entityChanges[0]!.entity_type,
        entityId: entityChanges[0]!.entity_id,
        changes: entityChanges,
        headline: headlineForEntity(entityChanges),
      }));
      return { section, changes: sectionChanges, entities };
    });
}
