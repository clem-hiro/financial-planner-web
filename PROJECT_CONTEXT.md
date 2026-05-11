# Finance Planner — project context

Living reference for what this app does, how it is structured, and where to change things. **Update this file whenever you add or materially change a user-facing feature, route, data model, or cross-cutting behavior** (auth, onboarding, shell, middleware).

---

## Product intent

Private **wealth and cash-flow clarity**: net worth, monthly spending vs budget, savings rate, goals, Singapore-specific angles (CPF, housing, vehicles where modeled), and projections/methodology surfaced in the UI—not a bank link aggregator.

---

## Stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js** (App Router), React |
| Auth & DB | **Supabase** (Auth + Postgres, RLS on user data) |
| Validation | **Zod** (`src/lib/validation.ts` and inline use) |
| Charts | **Recharts** |
| Tests | **Vitest** (`src/domain/**/*.test.ts`, etc.) |

Public env (client): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Detection helper: `src/lib/env.ts` (`isSupabaseConfigured`).

---

## Routes (user-visible)

| Path | Role |
|------|------|
| `/` | Redirects to `/dashboard`. |
| `/login` | Standalone sign-in / sign-up (`src/app/login/page.tsx`, `LoginForm`). Not wrapped in `(app)` shell. |
| `/dashboard` | Primary overview: net worth, savings, month activity, retirement/CPF sections (`(app)/dashboard`). Unsigned: CTA to sign in. |
| `/expenses` | **Spending** hub: add/list expenses, charts, spend guidance (`(app)/expenses`). Nav label “Spending”. |
| `/spending` | **Alias**: server redirect to `/expenses`. |
| `/setup` | **Financial setup** hub with tabs: profile, balances, budget, goals shortcuts (`(app)/setup`). Nav “Setup”; sub-routes like `/balances`, `/budget`, `/financial-profile` count as Setup for nav highlighting (`AppShellNav`). |
| `/balances` | Cash, liabilities, investments, CPF balances, vehicles, housing loans (under goals/balances flows). |
| `/budget` | Budget planning for a month (`BudgetPlanningView`). |
| `/financial-profile` | Income, retirement assumptions, profile fields. |
| `/goals` | Financial goals, linked investments, housing/vehicle panels. |
| `/onboarding` | Post-auth wizard when profile requires onboarding (`OnboardingWizard`). |

**API routes** (`src/app/api/`): `budget`, `dashboard`, `expenses`, `expenses/[id]`, `profile`, `projection` — JSON for client or integrations; keep in sync with page data needs.

---

## Auth, onboarding, and gating

- **Supabase Auth** via server client (`src/data/supabase/server.ts`) and browser client (`browser.ts`).
- **`(app)/layout.tsx`**: Loads user, wraps children in **`AppShell`** (global header + main + scroll affordances).
- **`src/middleware.ts`**: If Supabase env is set, reads session. For logged-in users on “app” paths (`dashboard`, `expenses`, `budget`, `setup`, `balances`, `goals`, `financial-profile`, `onboarding`):
  - If `financial_profiles` indicates onboarding required and not completed → force **`/onboarding`** (except when already on onboarding).
  - If onboarding not required and user hits **`/onboarding`** → redirect **`/dashboard`**.
- **Note:** `/spending` is not in the middleware regex; it only redirects to `/expenses`. If onboarding enforcement must cover every entry point, consider aligning middleware with `/spending` (or keep redirect-only behavior).

**LoginForm** (`src/features/auth/LoginForm.tsx`): sign-in pushes `/dashboard`; sign-up with immediate session pushes `/onboarding`. **Sign out**: server action `signOutAction` → `/login`.

---

## App shell UX

**`src/features/app-shell/AppShell.tsx`**

- Header: brand link, optional **main nav** (`AppShellNav`: Dashboard, Spending, Setup), **How it works** (methodology sheet), **Sign in** or **Sign out**.
- **Main app nav is shown only when** the user is signed in **and** the path does **not** start with `/onboarding`. Unsigned users and onboarding users get a minimal header (no Dashboard / Spending / Setup tabs or mobile menu for those routes).

**`AppShellNav.tsx`**: Prefetches `/dashboard`, `/expenses`, `/setup` when mounted.

---

## Code map (where features live)

| Area | Location |
|------|-----------|
| Pages (RSC-heavy) | `src/app/(app)/`, `src/app/login/`, `src/app/page.tsx` |
| App chrome | `src/features/app-shell/` |
| Onboarding | `src/features/onboarding/`, `(app)/onboarding/page.tsx` |
| Auth UI | `src/features/auth/` |
| Dashboard | `src/features/dashboard/`, `src/data/dashboard.ts` |
| Expenses / spending UI | `src/features/expenses/`, `src/features/spend/`, `src/data/repositories/expenses.ts`, spend recommendations data |
| Budget | `src/features/budget/`, `src/data/repositories/budget-lines.ts`, overrides, `src/domain/finance/budget.ts` |
| Setup tabs | `src/features/setup/SetupTabsNav.tsx`, `src/lib/setup-urls.ts` |
| Goals / balances / loans / vehicles / CPF | `src/features/goals/`, related `src/data/repositories/*` |
| Help / methodology | `src/features/help/`, `src/content/methodology-topics.ts` |
| Pure finance logic | `src/domain/finance/` (projections, net worth, SG CPF/vehicle/housing helpers, tests alongside) |
| DB access patterns | `src/data/repositories/*.ts`, `src/data/mappers.ts`, `src/data/supabase/types.ts` |
| Server mutations | `src/server/actions.ts` (large file: forms call these; uses `revalidatePath`) |

---

## Database

- **Migrations:** `supabase/migrations/` (evolved from early `profiles` / `expenses` / `investments` / `financial_goals` toward **`financial_*`** tables and richer profile/onboarding/budget/vehicle/housing/CPF fields).
- **Types:** `src/data/supabase/types.ts` should reflect the schema your app expects; regenerate or edit when migrations add columns.

When you add a table, policy, or column: **update this doc’s “Routes” or “Database” bullets** and any **middleware** or **RLS** implications.

---

## Conventions worth preserving

- Prefer **server components** for data fetch where possible; use **client** for interactivity, charts that need client hooks, and shell (`AppShell` is `"use client"`).
- **User-scoped data**: always filter by authenticated user id; RLS is the backstop.
- **Currency / dates**: shared helpers in `src/lib/currency.ts`, `src/lib/dates.ts`.
- **Onboarding/profile flags**: `src/data/financial-profile.ts` (`needsOnboarding`, `isFinancialProfileIncomplete`, etc.).

---

## How to maintain this file

1. After shipping a feature, add or adjust a **row in Routes** or a **paragraph under Code map / Database** (one or two lines is enough).
2. If behavior changes globally (middleware, shell, login redirect), update **Auth, onboarding, and gating** or **App shell UX**.
3. If you introduce a new top-level domain concept (e.g. “tax estimates”), add a **Code map** row and point to the main module.
4. Keep claims aligned with **code**; avoid marketing copy that does not match the UI.

_Last reviewed: aligned with AppShell conditional main nav (signed-in, non-onboarding only)._
