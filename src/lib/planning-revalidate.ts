import { revalidatePath } from "next/cache";
import { PLANNING_SECTIONS } from "@/lib/planning-sections";

/** Revalidates all planning workspace section routes after shared data changes. */
export function revalidatePlanningWorkspace() {
  for (const id of PLANNING_SECTIONS) {
    revalidatePath(`/planning/${id}`);
  }
}

/** Keep `/setup` and modular `/planning/**` views coherent after profile or ledger edits. */
export function revalidateSetupAndPlanning() {
  revalidatePath("/setup");
  revalidatePlanningWorkspace();
}
