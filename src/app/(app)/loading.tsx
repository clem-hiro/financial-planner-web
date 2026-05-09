"use client";

export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
          aria-hidden="true"
        />
        Loading latest data...
      </div>
    </div>
  );
}
