"use client";

import { useTheme, type ThemeMode } from "@/ui/theme/ThemeProvider";

const options: Array<{
  mode: ThemeMode;
  icon: string;
  label: string;
  title: string;
}> = [
  { mode: "light", icon: "☼", label: "Light", title: "Use light theme" },
  { mode: "dark", icon: "◐", label: "Dark", title: "Use dark theme" },
];

export function ThemeModeToggle({ className = "" }: { className?: string }) {
  const { mode, resolvedTheme, setMode } = useTheme();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/60 p-1 shadow-sm shadow-slate-900/[0.03] dark:border-slate-700/80 dark:bg-slate-900/65 dark:shadow-black/20 ${className}`}
      role="group"
      aria-label="Theme"
    >
      {options.map((option) => {
        const active = mode === "system"
          ? option.mode === resolvedTheme
          : option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => setMode(option.mode)}
            className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              active
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
