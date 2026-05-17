import type { SetupModuleStatus } from "@/domain/setup/types";

const STATUS_META: Record<
  SetupModuleStatus,
  { label: string; icon: string; className: string }
> = {
  complete: {
    label: "Complete",
    icon: "✅",
    className: "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
  },
  partial: {
    label: "Partial",
    icon: "⚠️",
    className: "border-amber-200/75 bg-amber-50/85 text-amber-950",
  },
  not_started: {
    label: "Not started",
    icon: "○",
    className: "border-slate-200/80 bg-slate-50/90 text-slate-600",
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
