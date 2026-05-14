---
name: test-strategy-gate
description: >
  Pre-implementation gate that recommends the right test layer for a planned change. Maps the target file to the test layer per handbook §3.10 (pure domain → vitest unit; RLS/conflict-guard/middleware → integration; UI flow → manual scenario matrix). Surfaces the four currently-untested invariants from §3.10 so you know what's NOT covered.
---

# Test strategy gate

Handbook §3.10 names four cross-cutting invariants that have NO test coverage today: RLS enforcement, the budget-line conflict guard, middleware onboarding-redirect logic, and server-action error pathways. The current test suite is biased toward pure-domain math (`src/domain/finance/*.test.ts`). This skill calibrates expectations before you start coding: it surfaces what test layer applies, what's already covered, and what's documented-but-untested.

## Phase 1 — Resolve target

Parse the user-supplied argument text:
- File path → analyse the layer the file belongs to.
- Symbol (`createExpenseAction`) → resolve via function-tree to its containing file, then continue.
- Empty → ask the user.

## Phase 2 — Classify the layer

Determine the file's layer from its path:

| Layer | Path pattern | Test prescription |
|---|---|---|
| Pure domain | `src/domain/finance/*.ts` | Vitest unit. Co-locate `*.test.ts`. Cover happy path + 3 edge cases + 1 boundary value (see §3.10 invariants). |
| Composition / read aggregator | `src/data/*.ts` (not in `repositories/` or `supabase/`) | Optional unit, prefer functional/API test if it spans multiple repositories. |
| Repository | `src/data/repositories/*.ts` | Integration test with a real Supabase test DB. Currently NONE exist for this project — flag as missing infra. |
| Server action | `src/server/actions.ts` | Integration test (real DB + auth context) for the action's error paths AND a `<form action={...}>` E2E test. §3.10 invariant: error pathways untested. |
| Route handler | `src/app/api/**/route.ts` | Same as server action. Zod-validated handlers have stronger structural guarantees but still need integration. |
| Middleware | `src/middleware.ts` | Integration test with Next.js test runner. §3.10 invariant: onboarding-redirect logic untested. |
| UI component | `src/features/**/*.tsx`, `src/ui/**/*.tsx` | Manual scenario matrix per `docs/engineering-handbook.md` §3.10. Skip unit tests on render-only components. |
| Library helper | `src/lib/*.ts` | Vitest unit if logic-bearing; skip if it's a pure type or constant. |

## Phase 3 — Check existing coverage

For the target function:
1. Use the function tree to find inbound `*.test.ts` callers:
   ```bash
   jq -r --arg id "$ID" '.reverse.calls[$id] // [] | .[] | select(contains(".test.ts"))' \
     docs/function-tree/function-tree.json
   ```
2. Also search test files directly (the tree may miss imports the type-checker resolved to types-only):
   ```bash
   rg -l "$SYMBOL" src -g '*.test.ts'
   ```

If covered: name the test file(s). If not: name the matching test layer.

## Phase 4 — Cross-reference §3.10 invariants

If the target is implicated in any of the four named untested invariants, flag it explicitly:

| Invariant | Implicated by editing |
|---|---|
| RLS enforcement | Any new repository, any new table, any policy change |
| Budget-line conflict guard | `src/data/expense-budget-guard.ts`, anything calling `hasBudgetCategoryMonthlyConflict` |
| Middleware onboarding-redirect | `src/middleware.ts`, any change to onboarding flow |
| Server-action error pathways | Any new `*Action` function in `src/server/actions.ts` |

For implicated invariants: "This change touches the **{invariant}** invariant — currently untested per §3.10. Recommended: add an integration test covering the failure mode before merging."

## Phase 5 — Render the gate

```
## Pre-implementation checklist for src/server/actions.ts#createVehicleAction

Layer: server-action
Existing tests: none found via function tree or direct search.

Required by §3.10:
- [ ] Integration test for action error paths (current §3.10 invariant)
- [ ] E2E test exercising `<form action={createVehicleAction}>` from src/features/goals/VehiclesPanel.tsx

Recommended additional:
- [ ] Vitest unit test for `optionalYearMonth` helper if logic is non-trivial.

Test-philosophy reminders:
- Cover happy path + invalid input + duplicate-name conflict + auth-missing.
- Mocks confirm plumbing; live Supabase test instance confirms the contract.
```

## Phase 6 — Verdict

- All required boxes already ticked → "**Coverage in place.** Proceed."
- Some required boxes missing → "**Test gaps.** Add the listed tests before or during the implementation, not after."
- The implicated invariant has NO existing test infra (e.g. there's no integration test setup at all) → "**Missing infra.** Adding a test for `{invariant}` requires a project-wide test fixture. Surface this as a separate decision before continuing the feature."

## Phase 7 — Caveats

- The skill does not run tests. It recommends, doesn't verify.
- "Pure domain" classification assumes no I/O. If a domain file starts importing repositories or fetch, the classification is wrong — flag the I/O leak as a layering violation.
- For UI components without logic (presentational), the skill recommends "manual scenario matrix" rather than reflexive unit tests. Adopt Vitest UI tests only when behavior is non-trivial enough to warrant the maintenance cost.
