---
name: design-system-check
description: Flag feature components that use raw Tailwind utility classes for surfaces / inputs / links / tabs / charts where `src/ui/*-classes.ts` constants already exist (`surfaceClass`, `inputClass`, `appLinkStyles`, `appTabStyles`, `chartStyles`). Use when editing files under `src/features/**/*.tsx` to catch design-token drift before it accumulates.
allowed-tools: Read, Bash, Grep, Glob
argument-hint: "<file-or-glob>  | --features"
---

# Design system check

`src/ui/` exposes design tokens as exported string constants:

| File | Export | Use for |
|---|---|---|
| `src/ui/surface-classes.ts` | `surfaceClass`, plus variants | Card / section / panel backgrounds |
| `src/ui/input-classes.ts` | `inputClass`, plus state variants | Text inputs, selects, textareas |
| `src/ui/app-link-styles.ts` | `appLinkStyles` | Internal nav links |
| `src/ui/app-tab-styles.ts` | `appTabStyles` | Tab triggers / lists |
| `src/ui/chart-styles.ts` | `chartStyles` | Recharts visual props |

Enforcement is by convention. Pretrained models will write raw Tailwind by default. This skill flags drift before a stale `bg-` / `border-` / `text-` class diverges from the design token.

## Phase 1 — Resolve targets

Parse `$ARGUMENTS`:
- File or glob → analyse those.
- `--features` → analyse all `src/features/**/*.tsx`.
- Empty → ask the user or `--features`.

## Phase 2 — Detect raw-token usage

For each file, scan for patterns that should use a primitive. Token patterns (regex against `className=`):

| Token | Raw-Tailwind signal | Should use |
|---|---|---|
| Surface | `bg-(white\|gray|slate|stone|neutral)-(50\|100\|200)` + `rounded-(md\|lg\|xl)` + `border` | `surfaceClass` |
| Input | `border-(gray\|slate|neutral)-300` + `rounded` + `px-` + `py-` on input/textarea/select elements | `inputClass` |
| App link | `<a` or `<Link` with `text-blue-` / `hover:underline` / `text-primary` | `appLinkStyles` |
| App tab | `role="tab"` or tab-shaped div without `appTabStyles` import | `appTabStyles` |
| Chart | Recharts component (`<LineChart>`, `<BarChart>`, etc.) without spreading `chartStyles` | `chartStyles` |

Run greps in parallel:

```bash
# Surface candidates
grep -nE 'className="[^"]*\b(bg-white|bg-(gray|slate|stone|neutral)-[12]00)\b[^"]*\brounded-(md|lg|xl)\b' "$FILE"

# Input candidates
grep -nE '<(input|textarea|select)[^>]*className="[^"]*\bborder-(gray|slate|neutral)' "$FILE"

# Link candidates (likely visible chrome)
grep -nE '<(a|Link)[^>]*className="[^"]*\b(text-(blue|sky|indigo)|hover:underline)\b' "$FILE"
```

## Phase 3 — Confirm the primitive isn't already imported

For each finding, check whether the file imports from `@/ui`:

```bash
grep -nE 'from "@/ui(/[^"]*)?"' "$FILE"
```

A finding only triggers a `[suggest]` if the corresponding primitive isn't already used somewhere in the file. If the primitive IS imported but a raw token also appears, that's a stronger `[drift]` finding — the file knows about the token, opted out partially.

## Phase 4 — Render

Per file:

```
## src/features/expenses/ExpenseForm.tsx
[suggest] L42  Surface-like class set found:
            className="bg-white rounded-lg border p-4"
            Consider: className={surfaceClass} from @/ui/surface-classes
            (primitive not currently imported)

[drift]   L78  Inputs are using inputClass elsewhere in this file but here raw:
            <input className="border border-gray-300 rounded px-3 py-2" ... />
            Consider: className={inputClass}
```

## Phase 5 — Verdict

- Zero findings → "**No design-token drift.**"
- `[suggest]` only → "**Advisory.** Optional cleanup."
- Any `[drift]` → "**Drift.** Same file mixes primitive and raw — converge on the primitive."

## Phase 6 — Caveats

- Tailwind class merging (twMerge / clsx) means a raw class can be a valid override of a primitive ("the primitive sets `bg-white` but I want `bg-blue-50` here"). Use `[suggest]` for these and let the human decide.
- The skill does NOT autofix. Treat findings as conversation starters.
- Recharts often needs per-instance overrides (color per series); not every chart usage needs `chartStyles`. Flag only when an entire Recharts component renders without any styling import at all.
- Adding a new design token is fine — but if a pattern recurs in 3+ files, surface it as "should be a new primitive in `src/ui/`" rather than fixing each site individually.
