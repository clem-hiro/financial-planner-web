import { redirect } from "next/navigation";

/** Legacy hub URL — setup overview lives under `/setup/overview` now. */
export default function PlanningSetupRedirectPage() {
  redirect("/setup/overview");
}
