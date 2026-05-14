---
name: nextjs16-guard
description: >
  Lint changed files for Next.js 16 breaking changes that coding agents may write by default (sync `params`/`searchParams`/`cookies()`/`headers()`/`draftMode()`, single-arg `revalidateTag`, removed `unstable_cache`, deprecated `middleware.ts`). Mode is advisory for `middleware.ts` (project hasn't migrated to `proxy.ts` yet), hard-fail for everything else. Run after any edit under `src/app/`, `src/server/actions.ts`, `src/middleware.ts`, route handlers, or `next.config.ts`.
---

# Next.js 16 guard

`AGENTS.md` warns: "This is NOT the Next.js you know." Coding agents default to Next.js 14/15 patterns; Next.js 16 (Oct 2025) made several of those a hard removal. This skill catches the seven highest-yield drift patterns without you having to remember each one.

## Phase 1 — Resolve targets

Parse the user-supplied argument text:
- `--staged` → `git diff --name-only --cached` filtered to `*.ts` / `*.tsx` under `src/`, `next.config.ts`.
- Bare file or glob → expand via `git ls-files <pattern>` (project files only; never node_modules).
- Empty → ask the user which file or `--staged`.

## Phase 2 — Pattern matrix

Run each `rg` search against the resolved file list. Each row is one breaking-change class.

| # | Pattern | Severity | Detection | Why |
|---|---|---|---|---|
| 1 | Sync `params.<key>` | **block** | `rg -n '(\bparams\.[a-zA-Z_]+|\bparams\[)' <files>` then filter OUT lines after `await params` resolution | In 16, `params` is a Promise. Sync access throws at runtime. |
| 2 | Sync `searchParams.<key>` | **block** | same as above with `searchParams` | Same. |
| 3 | `cookies()` not awaited | **block** | `rg -n -P '(?<!await )cookies\(\)' <files>` (or equivalent multi-line check) | `cookies()` returns a Promise in 16. |
| 4 | `headers()` not awaited | **block** | as above with `headers()` | Same. |
| 5 | `draftMode()` not awaited | **block** | as above with `draftMode()` | Same. |
| 6 | Single-arg `revalidateTag(tag)` | **block** | `rg -n 'revalidateTag\(([^,)]+)\)' <files>` | 16 requires `revalidateTag(tag, profile)` with a `cacheLife` profile. Single-arg form deprecated/removed. |
| 7 | `import { unstable_cache } from 'next/cache'` | **block** | `rg -n "unstable_cache|from ['\"]next/cache['\"]" <files>` then inspect matching import lines | Removed in 16. Migrate to `cacheLife` + `cacheTag`. |
| 8 | `src/middleware.ts` references | **advisory** | `git ls-files src/middleware.ts` | Deprecated in 16 in favor of `proxy.ts`. Project hasn't migrated yet — warn only. |
| 9 | `<Image>` with local `src` and only `remotePatterns` in `next.config.ts` | **block** | check `next.config.ts` images config + `rg -n 'src="/'` for local image usage | 16 requires `images.localPatterns` for local-src usage in optimization-strict mode. |

Phase 2 must run greps in parallel (one Bash invocation per pattern, batched if cheap) and collect findings as a flat list keyed by `file:line`.

## Phase 3 — Per-finding analysis

For each finding, output:

```
[block]   src/app/(app)/budget/page.tsx:14
  Pattern: sync params.month — `params` is a Promise in Next.js 16
  Fix: const { month } = await params;
  Ref: https://nextjs.org/blog/next-16#async-runtime-apis
```

Advisory findings (`[advise]`) use the same format but with `[advise]` prefix and softer language. Group findings by file in the final report.

## Phase 4 — Verdict

End with one of:

- Zero findings → "**Clean.** No Next.js 16 drift detected."
- Only `[advise]` findings → "**Advisory.** Pre-existing patterns flagged; no blocker on this change." Followed by a one-line cumulative note: "`src/middleware.ts` still uses the deprecated filename — migration to `src/proxy.ts` is tracked separately."
- Any `[block]` finding → "**Next.js 16 regression.** Do not merge until fixed."

## Phase 5 — Caveats

- Search-based detection can miss patterns that span multiple lines (e.g. destructuring across line breaks). When a file has any finding, also search the file for the related raw token (`params`, `cookies`, etc.) and surface the line counts so the user can manually confirm scope.
- The skill does not run `tsc` — TypeScript can't catch most of these (the Promise change is at runtime). Static greps are the right tool here.
- Project today has zero `revalidateTag` / `unstable_cache` usage and one `middleware.ts`. The first time a feature adds a tag-based cache is when this skill earns its keep.
- `next.config.ts` changes are infrequent — only re-scan when that file is in the change set.

## Phase 6 — Sources

Authoritative: https://nextjs.org/blog/next-16 (release notes), https://nextjs.org/docs/app/api-reference/functions/revalidateTag (cacheLife profile), https://nextjs.org/docs/messages/sync-dynamic-apis (async migration).
