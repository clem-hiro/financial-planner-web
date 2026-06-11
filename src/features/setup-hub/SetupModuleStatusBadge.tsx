import type { SetupModuleStatus } from "@/domain/setup/types";

const STATUS_META: Record<
  SetupModuleStatus,
  { label: string; icon: string; className: string }
> = {
  complete: {
    label: "Complete",
    icon: "✅",
    className:
      "border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/55 dark:bg-emerald-400/15 dark:text-emerald-100",
  },
  partial: {
    label: "Partial",
    icon: "⚠️",
    className:
      "border-amber-200/75 bg-amber-50/85 text-amber-950 dark:border-amber-300/60 dark:bg-amber-300/15 dark:text-amber-100",
  },
  not_started: {
    label: "Not started",
    icon: "○",
    className:
      "border-slate-200/80 bg-slate-50/90 text-slate-600 dark:border-slate-500/80 dark:bg-slate-800 dark:text-slate-200",
  },
  pending: {
    label: "Pending",
    icon: "🕐",
    className:
      "border-sky-200/80 bg-sky-50/90 text-sky-900 dark:border-sky-400/60 dark:bg-sky-400/15 dark:text-sky-100",
  },
};

export function SetupModuleStatusBadge({
  status,
}: {
  status: SetupModuleStatus;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
