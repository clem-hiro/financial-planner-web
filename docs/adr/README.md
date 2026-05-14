# Architecture Decision Records

This folder captures the **why** behind structural choices. The engineering handbook (`docs/engineering-handbook.md`) describes the system as it is today; ADRs explain how it got that way and what was rejected.

## Format

We follow [MADR](https://adr.github.io/madr/) — Markdown Architecture Decision Records. One file per decision. Append-only: once a decision is recorded, it is never edited destructively. If a decision is reversed, add a new ADR that supersedes the old one and update the old one's `Status` to `Superseded by 00XX-...`.

## Naming

`00NN-short-kebab-title.md`, four-digit zero-padded. Numbers are issued in order of authoring. Never reused after deletion.

Example: `0001-route-handlers-vs-server-actions.md`.

## Authoring a new ADR

1. Copy `template.md` to a new file with the next number and a short kebab-case title.
2. Fill in every section. Keep it to ~1 page; expand only where consequences are non-obvious.
3. Add an entry to the **Index** table below.
4. Commit alongside the change it documents. ADRs are written *with* the decision, not after the fact.

## When to write an ADR

Write one whenever you make a choice that the team will need to defend or revisit later:

- Introducing a new dependency or removing an existing one.
- Picking between two equally-valid patterns (e.g. server action vs route handler).
- Departing from an existing pattern in the codebase.
- Resolving a recurring debate ("should we cache X?", "is service-role-key acceptable here?").

Do **not** write ADRs for cosmetic refactors, typo fixes, or routine bug fixes.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| _none yet_ | | | |

## Candidate topics (write when relevant)

The following decisions exist in the codebase but have no ADR yet. Add one whenever a future change forces a re-litigation of these choices:

- Route handlers for `/api/expenses` and `/api/profile` vs. server actions for everything else
- Manually maintained `src/data/supabase/types.ts` instead of `supabase gen types`
- Anonymous-key client only (no service role key in the app)
- `revalidatePath` × N + `router.refresh()` as the cache-consistency model
- Recharts as the charting library
- Singapore-specific domain logic (CPF, COE, PARF, ARF) embedded in `src/domain/finance/` rather than abstracted behind a regional adapter

This list is informational; it is not the index. Promote a topic to the index only when you actually write its ADR.
