import { redirect } from "next/navigation";

export default function ClientProfileAliasPage() {
  redirect("/setup?tab=profile");
}
