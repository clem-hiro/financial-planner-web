import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countAdvisorAccessKeyStatuses,
  listAdvisorAccessKeysForAdvisor,
} from "@/data/repositories/advisor-access-keys";
import type { AdvisorAccessKeyRow } from "@/data/supabase/types";
import { AdvisorKeyQrShareButton } from "@/features/advisor/AdvisorKeyQrShareButton";
import type { SerializableQrShareData } from "@/server/advisor-qr-share-actions";
import { PageSection } from "@/ui/PageSection";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import Link from "next/link";

function KeyStatusBadge({ status }: { status: AdvisorAccessKeyRow["status"] }) {
  const cls =
    status === "available"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-600/15"
      : status === "claimed"
        ? "bg-slate-100 text-slate-800 ring-slate-600/15"
        : "bg-amber-50 text-amber-950 ring-amber-600/20";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

export async function AdvisorAccessKeysSection({
  supabase,
  userId,
  initialShareData,
}: {
  supabase: SupabaseClient;
  userId: string;
  initialShareData: SerializableQrShareData | null;
}) {
  const [counts, keys] = await Promise.all([
    countAdvisorAccessKeyStatuses(supabase, userId),
    listAdvisorAccessKeysForAdvisor(supabase, userId),
  ]);
  const recent = keys.slice(0, 40);

  return (
    <PageSection
      id="advisor-access-keys"
      title="Client access keys"
      description={
        <span className="text-xs text-zinc-600">
          Keys are issued through the advisor purchase and coupon workflow.
        </span>
      }
      actions={<AdvisorKeyQrShareButton initialData={initialShareData} />}
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Coupon-backed key purchase</p>
          <p className="mt-1 text-xs text-emerald-900/90">
            Give each key to one client. A key can only be used once.{" "}
            <Link href="/advisor/buy-keys" className={appInlineLinkClass}>
              Buy more keys
            </Link>
            .
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Total", counts.total],
              ["Available", counts.available],
              ["Claimed", counts.claimed],
              ["Expired", counts.expired],
            ] as const
          ).map(([label, n]) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm"
            >
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                {label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{n}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Recent keys</h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            Showing up to 40 most recent. Copy a key and send it securely to your client.
          </p>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              No keys yet.{" "}
              <Link href="/advisor/buy-keys" className={appInlineLinkClass}>
                Buy your first batch
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="hidden px-3 py-2 sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recent.map((k) => (
                    <tr key={k.id} className="font-mono text-xs sm:text-sm">
                      <td className="max-w-[200px] truncate px-3 py-2 text-zinc-900 sm:max-w-none">
                        {k.access_key}
                      </td>
                      <td className="px-3 py-2">
                        <KeyStatusBadge status={k.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-zinc-600 sm:table-cell">
                        {new Date(k.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageSection>
  );
}
