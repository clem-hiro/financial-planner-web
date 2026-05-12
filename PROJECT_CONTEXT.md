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
| `/` | Redirects to `/dashboard` (advisors are then sent to `/advisor` by middleware). |
| `/login` | Standalone sign-in / sign-up (`src/app/login/page.tsx`, `LoginForm`). Not wrapped in `(app)` shell. |
| `/dashboard` | **Client** overview: net worth, savings, month activity, retirement/CPF (`(app)/dashboard`). Advisors hitting client routes are redirected to `/advisor`. |
| `/home` | **Client alias** redirect to `/dashboard` (new grouped IA label). |
| `/planning` | **Client alias** redirect to `/goals` (new grouped IA label). |
| `/activity` | **Client alias** redirect to `/expenses` (new grouped IA label). |
| `/profile` | **Client alias** redirect to `/setup?tab=profile` (new grouped IA label). |
| `/advisor` | **Advisor** workspace home: client/key snapshot cards (`(app)/advisor/page.tsx`). |
| `/advisor/clients` | **Advisor** client roster (non-financial summary columns only for now). |
| `/advisor/access-keys` | **Advisor** access key management (moved out of client Setup). |
| `/advisor/client/[id]` | **Advisor** placeholder detail route for future CRM-style workflows. |
| `/expenses` | **Spending** hub: add/list expenses, charts, spend guidance (`(app)/expenses`). Nav label “Spending”. |
| `/spending` | **Alias**: server redirect to `/expenses`. |
| `/setup` | **Financial setup** hub with tabs: profile, balances, budget, goals shortcuts (`(app)/setup`). Nav “Setup”; sub-routes like `/balances`, `/budget`, `/financial-profile` count as Setup for nav highlighting (`AppShellNav`). |
| `/balances` | Cash, liabilities, investments, CPF balances, vehicles, housing loans (under goals/balances flows). |
| `/budget` | Budget planning for a month (`BudgetPlanningView`). |
| `/financial-profile` | Income, retirement assumptions, profile fields. |
| `/goals` | Financial goals, linked investments, housing/vehicle panels. |
| `/onboarding` | Post-auth wizard when profile requires onboarding (`OnboardingWizard`). |
| `/account-issue` | Shown when a **client** profile has no `advisor_user_id` (data integrity / support path). |

**API routes** (`src/app/api/`): `budget`, `dashboard`, `expenses`, `expenses/[id]`, `profile`, `projection` — JSON for client or integrations; keep in sync with page data needs.

---

## Auth, onboarding, and gating

- **Supabase Auth** via server client (`src/data/supabase/server.ts`) and browser client (`browser.ts`).
- **`(app)/layout.tsx`**: Loads user and **`financial_profiles`** row, resolves **`workspace`**: `advisor` vs `client`, passes into **`AppShell`** for role-appropriate chrome.
- **`src/middleware.ts`**: If Supabase env is set, reads session. For logged-in users on **gated** paths — **client app** (`dashboard`, `home`, `planning`, `activity`, `profile`, `expenses`, `spending`, `budget`, `setup`, `balances`, `goals`, `financial-profile`, `onboarding`, `account-issue`) or **`/advisor/**`**:
  - **Advisors** on any **client** path above (including **`/onboarding`**) → redirect **`/advisor`** (they do not use client onboarding or personal finance surfaces).
  - **Clients** on **`/advisor/**`** → redirect to **`/account-issue`**, **`/onboarding`**, or **`/dashboard`** depending on profile flags (same rules as post-login routing).
  - If the profile is a **client** but **`advisor_user_id` is null** → **`/account-issue`** (except when already there).
  - **Onboarding** is enforced only for **clients** with `onboarding_required` and no `onboarding_completed_at`.
  - If onboarding not required and user hits **`/onboarding`** → redirect **`/dashboard`**.

**LoginForm** (`src/features/auth/LoginForm.tsx`): **Sign-in** loads `financial_profiles` and sends **advisors** to **`/advisor`**, **clients** to **`/onboarding`** or **`/dashboard`** (or **`/account-issue`** if `advisor_user_id` is missing). **Sign up**: **Financial advisor** → **`/advisor`** when a session exists immediately; **Client** → **`/onboarding`**. **Sign out**: server action `signOutAction` → `/login`.

---

## App shell UX

**`src/features/app-shell/AppShell.tsx`**

- Header: brand link ( **`/dashboard`** for clients, **`/advisor`** for advisors ), subtitle (“Private wealth clarity” vs “Advisor workspace”), optional **main nav**, **How it works**, **Sign in** / **Sign out**.
- **`AppShellNav`** receives **`workspace`**: **client** nav only with grouped labels (**Home**, **Planning**, **Activity**, **Profile**) mapped to existing routes.
- Advisor navigation is now rendered in a dedicated sidebar under `src/app/(app)/advisor/layout.tsx` using `AdvisorWorkspaceSidebar`, giving `/advisor/**` pages a workspace-style layout.
- **Main app nav is shown only when** the user is signed in **and** the path does **not** start with `/onboarding`.

**`AppShellNav.tsx`**: Prefetches routes for the active workspace.

---

## Code map (where features live)

| Area | Location |
|------|-----------|
| Pages (RSC-heavy) | `src/app/(app)/`, `src/app/login/`, `src/app/page.tsx` |
| App chrome | `src/features/app-shell/` |
| Onboarding | `src/features/onboarding/`, `(app)/onboarding/page.tsx` |
| Auth UI | `src/features/auth/` |
| Advisor workspace (POC) | `src/app/(app)/advisor/**`, `src/features/advisor/`, `src/data/repositories/advisor-access-keys.ts`, `advisor-clients.ts`, `advisor-dashboard.ts`, `src/server/advisor-access-key-actions.ts`, `src/lib/profile-role.ts`, `src/lib/advisor-access-key-token.ts` |
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
- **Advisor / client (POC):** `financial_profiles.profile_type` (`advisor` \| `client`), optional `advisor_user_id` → `auth.users` for clients. **Advisors** are created with `onboarding_required = false` (no wizard). **Clients** keep `onboarding_required = true` until they finish onboarding. Table **`advisor_access_keys`**: unique `access_key`, `status` (`available` \| `claimed` \| `expired`), `claimed_by_user_id`, timestamps. **`handle_new_user`** reads `raw_user_meta_data.profile_type` and `access_key` for clients, claims the key in the same transaction, and sets the profile row. **`validate_client_access_key_for_signup`** (RPC, `SECURITY DEFINER`) is executable by `anon` for pre-checks only. RLS: on **`advisor_access_keys`**, advisors **select/insert/update** only rows where `advisor_user_id = auth.uid()`. On **`financial_profiles`**, an additional **`financial_profiles_select_advisor_clients`** policy lets advisors **read** linked client rows (`profile_type = client` and `advisor_user_id = auth.uid()`) for workspace lists — still no access to other advisors’ clients.
- **Role helpers:** `src/lib/profile-role.ts` — `getCurrentUserRole`, `isAdvisor`, `isClient`, `normalizeFinancialProfileType`, `clientAdvisorRelationshipOk` (keep role checks centralized).

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

_Last reviewed: grouped client IA aliases (`/home`, `/planning`, `/activity`, `/profile`), advisor sidebar layout, dashboard/setup visual refresh, advisor workspace placeholders (Work in Progress / Coming Soon), role redirects preserved._
