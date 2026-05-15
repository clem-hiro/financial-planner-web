import "server-only";

import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getProfileById } from "@/data/repositories/profiles";
import type { ProfileRow } from "@/data/supabase/types";
import { createSupabaseServerClient } from "@/data/supabase/server";

/** One Supabase client per RSC request (dedupes layout + page). */
export const getSupabaseServerClient = cache(createSupabaseServerClient);

/** One profile fetch per user id per RSC request. */
export const getCachedProfileById = cache(async (userId: string) => {
  const supabase = await getSupabaseServerClient();
  return getProfileById(supabase, userId);
});

export type RequestAuth = {
  supabase: SupabaseClient;
  user: User | null;
  profile: ProfileRow | null;
};

/** Auth + profile for the current request; shared by layout and pages. */
export const getRequestAuth = cache(async (): Promise<RequestAuth> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null };
  }
  const profile = await getCachedProfileById(user.id);
  return { supabase, user, profile };
});
