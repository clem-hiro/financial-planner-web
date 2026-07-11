import { redirect } from "next/navigation";
import { SETUP_OVERVIEW_PATH } from "@/lib/setup-urls";

export default function PlanningIndexPage() {
  redirect(SETUP_OVERVIEW_PATH);
}
