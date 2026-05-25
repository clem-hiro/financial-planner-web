import Link from "next/link";
import {
  listAdvisorClientsWorkspace,
  type AdvisorClientListSort,
} from "@/data/repositories/advisor-clients";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AdvisorClientsBoard } from "@/features/advisor/AdvisorClientsBoard";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { isSupabaseConfigured } from "@/lib/env";
import { parseAdvisorClientListFilterPreset } from "@/lib/advisor-client-list-filters";
import { isAdvisor } from "@/lib/profile-role";
import { redirect } from "next/navigation";

const SORTS: AdvisorClientListSort[] = ["created_desc", "name_asc", "last_active_desc"];

type PageProps = {
  searchParams: Promise<{ q?: string; sort?: string; page?: string; filter?: string }>;
};

export default async function AdvisorClientsPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to load clients.</p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileById(supabase, user.id);
  if (!isAdvisor(profile)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sortRaw = sp.sort ?? "created_desc";
  const sort: AdvisorClientListSort = SORTS.includes(sortRaw as AdvisorClientListSort)
    ? (sortRaw as AdvisorClientListSort)
    : "created_desc";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const filter = parseAdvisorClientListFilterPreset(sp.filter);
  const pageSize = 24;
  const offset = (page - 1) * pageSize;

  const { rows, totalCount } = await listAdvisorClientsWorkspace(supabase, user.id, {
    limit: pageSize,
    offset,
    search: q || null,
    sort,
    filter,
  });

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clients</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Operational roster with search, quick filters, sort, and server-side pagination.
          Financial detail opens in each client workspace.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/advisor/access-keys" className={appInlineLinkClass}>
            Access keys
          </Link>
        </p>
      </div>

      <AdvisorClientsBoard
        rows={rows}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        q={q}
        sort={sort}
        filter={filter}
      />
    </div>
  );
}
