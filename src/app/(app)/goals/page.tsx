import { redirect } from "next/navigation";

export default function GoalsPage() {
  redirect("/setup?tab=goals");
}
