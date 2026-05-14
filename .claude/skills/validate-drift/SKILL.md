---
name: validate-drift
description: Detect drift between Zod schemas in `src/lib/validation.ts` (canonical) and inline validation in server actions or route handlers. Reports fields missing on one side, range mismatches, and enum-value disagreement. Zod is canonical (handbook §3.3); skill's verdict reads "action diverges from schema". Run when editing any server action or schema.
allowed-tools: Read, Bash, Grep, Glob
argument-hint: "<action-or-route-symbol-or-file>"
---

# Validate drift

The project mixes two validation paths: Zod schemas for route handlers (`src/lib/validation.ts`) and inline `Number.isFinite` / `String().trim()` / range checks in server actions (`src/server/actions.ts`). Handbook §3.3 flags this as a candidate ADR. The decision is: **Zod schemas are canonical** (the wire contract). This skill enforces the convention by surfacing drift.

## Phase 1 — Resolve target

Parse `$ARGUMENTS`:
- Path to `src/server/actions.ts` or a specific route handler → analyse all action/handler symbols within.
- Function ID `src/server/actions.ts#createInvestmentAction` → analyse that single symbol.
- Schema name `goalImportItemSchema` → reverse: find every action/handler that should pair with it.
- Empty → ask the user.

## Phase 2 — Extract inline validation per target action

For a target action symbol, identify:
1. The action's input source (`formData.get(...)` for actions, `req.json()` for handlers).
2. Each validated field. Grep within the function body for:
   - `Number.isFinite(...)` — numeric range/finite check
   - `String(...).trim()` / `String(...).slice(...)` — string normalization
   - `=== "value"` / inclusion lookups — enum membership
   - Range comparisons (`< 0`, `> 1`, `<= 100`)

Build a per-action field map: `{ field_name: { kind: "number"|"string"|"enum", min?: ..., max?: ..., values?: [...] } }`.

## Phase 3 — Find the canonical schema

Schemas are exported from `src/lib/validation.ts`. Naming convention: `<entity><Verb>Schema` (e.g. `expensePostSchema`, `profilePatchSchema`, `goalImportItemSchema`).

Heuristic for pairing an action to a schema:
1. Action name → entity name (e.g. `createInvestmentAction` → `investment` → look for `investment*Schema`).
2. Direct verb hint (`upsert` → `Patch`, `delete` → no schema typically).
3. If multiple schemas match, prefer the one whose declared keys overlap most with the action's field map.

If no schema exists for the action, report:
> No corresponding Zod schema in `src/lib/validation.ts`. Action lacks a canonical contract — consider extracting one before further drift accumulates.

## Phase 4 — Diff

Read the schema's `z.object({...})` body. For each field, capture:
- Field name
- Type (`z.number()`, `z.string()`, `z.enum([...])`, etc.)
- Constraints (`.min(N)`, `.max(N)`, `.regex(...)`, `.optional()`, `.nullable()`)

Diff action's field map against the schema's field set:

| Drift class | Detection | Verdict text |
|---|---|---|
| Field in action but not schema | Action validates `foo` but schema has no `foo` key | `action validates "foo" but schema does not declare it — add to schema or remove from action` |
| Field in schema but not action | Schema declares `bar` but action doesn't read or validate it | `schema declares "bar" but action does not read it — likely missing field` |
| Range mismatch on numeric | Schema `.min(0).max(1)` vs action `> -1 && < 2` | `action range diverges from schema — schema allows [0,1], action allows (-1,2)` |
| Enum value mismatch | Schema `z.enum(["a","b"])` vs action `["a","b","c"]` | `action accepts values not in schema — schema is canonical, narrow the action` |
| Nullability mismatch | Schema `z.string().nullable()` vs action no null handling | `action rejects null but schema allows it — handle null in action` |

For each drift, the recommended action follows from "Zod is canonical": update the action to match the schema. Explicitly say so in the report.

## Phase 5 — Render

Group by action/handler. For each:

```
## src/server/actions.ts#createInvestmentAction
Paired schema: src/lib/validation.ts#goalImportItemSchema  (heuristic match, please confirm)

Drift:
- [range] expected_annual_return — schema: [0,1]; action: [0,1] ✓ no drift
- [missing-in-schema] linked_goal_id — action validates UUID format, schema does not declare. Action: add `linked_goal_id: z.string().uuid().optional()` to schema.
- [missing-in-action] currency — schema declares `currency: z.enum(["SGD","USD"])`, action reads but does not validate. Action: validate against schema.

Verdict: 2 drifts — update action to match schema.
```

## Phase 6 — Caveats

- Schema-action pairing is heuristic. When the heuristic confidence is low (no clear name match, field overlap < 50%), prompt the user: "I don't see a clean schema pairing for `<action>` — is the canonical schema `<best guess>`, or should one be created?"
- Multi-field cross-validation in Zod (`.refine()`, `.superRefine()`) is hard to compare to action-side logic. Surface `.refine` clauses as "manual review needed" rather than diffing structurally.
- The skill does NOT touch the action or schema — it only reports. Apply the fix via `/coder` once direction is confirmed.
- Server actions that use `FormData` need careful field-type translation: `formData.get("foo")` returns `string | File | null` but Zod schemas typically expect strongly-typed inputs. Treat the action's `String(...)` / `Number(...)` coercions as the "input adapter" layer, not the validation layer.
