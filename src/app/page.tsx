import { redirect } from "next/navigation";
import { RootSplash } from "@/features/landing/RootSplash";
import { getRequestAuth } from "@/data/supabase/request-context";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveRootDestination } from "@/lib/root-destination";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <RootSplash />;
  }

  const { user, profile } = await getRequestAuth();
  const destination = resolveRootDestination(user, profile);

  if (destination.kind === "redirect") {
    redirect(destination.pathname);
  }

  return <RootSplash />;
}
