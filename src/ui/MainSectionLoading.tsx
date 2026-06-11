export function MainSectionLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-none">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-slate-600 dark:border-t-slate-100"
          aria-hidden
        />
        {label}
      </div>
    </div>
  );
}
