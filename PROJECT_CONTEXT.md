# Finance Planner — project context

Living reference for what this app does, how it is structured, and where to change things. **Update this file whenever you add or materially change a user-facing feature, route, data model, or cross-cutting behavior** (auth, onboarding, shell, middleware).

---

## Product intent

Private **wealth and cash-flow clarity**: net worth, monthly spending vs budget, savings rate, goals, Singapore-specific angles (CPF, housing, vehicles where modeled), and projections/methodology surfaced in the UI—not a bank link aggregator.

---

## Stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 16** (App Router), **React 19** |
| Auth & DB | **Supabase** (`@supabase/ssr`, `@supabase/supabase-js` — Auth + Postgres, RLS on user data) |
| Styling | **Tailwind CSS** v4 (`@tailwindcss/postcss`) |
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
| `/home` | **Client alias** → `/dashboard` (`(app)/(client)/home/page.tsx`). |
| `/planning` | **Client alias** → `/goals` (`(app)/(client)/planning/page.tsx`). |
| `/activity` | **Client alias** → `/expenses` (`(app)/(client)/activity/page.tsx`). |
| `/profile` | **Client alias** → `/setup?tab=profile` (`(app)/(client)/profile/page.tsx`). |
| `/advisor` | **Advisor** workspace home: client/key snapshot cards (`(app)/advisor/page.tsx`). |
| `/advisor/clients` | **Advisor** client roster: search, sort, pagination, card grid with health signals (`advisor_client_list_metrics` RPC when migrated). |
| `/advisor/opportunities` | **Advisor** placeholder hub for future product/opportunity workflows (`Coming Soon`). |
| `/advisor/activity` | **Advisor** placeholder cross-client activity feed (`Work in Progress`). |
| `/advisor/access-keys` | **Advisor** access key management (moved out of client Setup). |
| `/advisor/client/[id]` | **Advisor** client workspace: profile edits, goals/budget quick edits, dashboard-month cashflow readouts, RLS-backed data (`AdvisorClientWorkspace`). |
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

**LoginForm** (`src/features/auth/LoginForm.tsx`): **Sign-in** loads `financial_profiles` and sends **advisors** to **`/advisor`**, **clients** to **`/onboarding`** or **`/dashboard`** (or **`/account-issue`** if `advisor_user_id` is missing). **Sign up**: **Financial advisor** → **`/advisor`** when a session exists immediately; **Client** → **`/onboarding`**. Supabase **signUp** sets `emailRedirectTo` to **`/auth/callback`** on the current origin (add that App Router route and allow the URL in Supabase if you rely on email confirmation). **Sign out**: server action `signOutAction` → `/login`.

---

## App shell UX

**`src/features/app-shell/AppShell.tsx`**

- Header: brand link ( **`/dashboard`** for clients, **`/advisor`** for advisors ), subtitle (“Private wealth clarity” vs “Advisor workspace”), optional **main nav**, **How it works**, **Sign in** / **Sign out**.
- **`AppShellNav`** receives **`workspace`**: **client** nav uses labels **Home**, **Planning**, **Activity**, **Profile** with primary links **`/dashboard`**, **`/goals`**, **`/expenses`**, **`/setup?tab=profile`**; **Planning** / **Activity** / **Profile** tabs stay highlighted on related paths (e.g. setup sub-routes, `/balances`, `/budget`, `/financial-profile`, `/spending`, `/account-issue`) via `activeMatch` in `AppShellNav.tsx`.
- Advisor navigation is now rendered in a dedicated sidebar under `src/app/(app)/advisor/layout.tsx` using `AdvisorWorkspaceSidebar`, giving `/advisor/**` pages a workspace-style layout.
- **Main app nav is shown only when** the user is signed in **and** the path does **not** start with `/onboarding`.

**`AppShellNav.tsx`**: Renders **only** for **`workspace === "client"`** (advisors use the sidebar). On mount it prefetches `/dashboard`, `/expenses`, `/setup`, and `/goals`.

---

## Code map (where features live)

| Area | Location |
|------|-----------|
| Pages (RSC-heavy) | `src/app/(app)/`, `src/app/(app)/(client)/` (IA alias redirects), `src/app/login/`, `src/app/page.tsx` |
| App chrome | `src/features/app-shell/` |
| Onboarding | `src/features/onboarding/`, `(app)/onboarding/page.tsx` — guided income → lifestyle → strategy → optional **recommended budget lines** (server `applyGuidedBudgetLinesAction`); profile stores `lifestyle_profile`, `budgeting_strategy`, `onboarding_confidence_level`, `food_spend_band`, `estimated_budget_mode`, `budget_generation_source` |
| Budget lens (Setup) | `src/features/setup/BudgetLensProfileForm.tsx` — edit lifestyle/strategy after onboarding (PATCH `/api/profile`) |
| Budget strategy & guided templates | `src/domain/finance/budget-guided-setup.ts` — lifestyle presets, 50/30/20-style splits, SG-oriented line generator, category→needs/wants/savings heuristics for visuals |
| Auth UI | `src/features/auth/` |
| Advisor workspace | `src/app/(app)/advisor/**`, `src/features/advisor/` (sidebar, `AdvisorClientWorkspace`, `AdvisorClientsBoard`, forms), `src/data/repositories/advisor-access-keys.ts`, `advisor-clients.ts` (incl. `listAdvisorClientsWorkspace` + RPC), `advisor-dashboard.ts`, `src/server/advisor-access-key-actions.ts`, `src/server/advisor-client-actions.ts` (linked-client mutations + revalidation), `src/domain/finance/advisor-client-health.ts`, `src/lib/profile-role.ts`, `src/lib/advisor-access-key-token.ts` |
| Dashboard | `src/features/dashboard/`, `src/data/dashboard.ts` |
| Expenses / spending UI | `src/features/expenses/`, `src/features/spend/`, `src/data/repositories/expenses.ts`, spend recommendations data |
| Budget | `src/features/budget/` (`BudgetPlanningView`, `BudgetStrategyInsightPanel` for target vs line mix + placeholders), `src/data/repositories/budget-lines.ts`, overrides, `src/domain/finance/budget.ts` |
| Setup tabs | `src/features/setup/SetupTabsNav.tsx`, `src/lib/setup-urls.ts` |
| Goals / balances / loans / vehicles / CPF | `src/features/goals/`, related `src/data/repositories/*` |
| Help / methodology | `src/features/help/`, `src/content/methodology-topics.ts` |
| Pure finance logic | `src/domain/finance/` (projections, net worth, SG CPF/vehicle/housing helpers, tests alongside) |
| DB access patterns | `src/data/repositories/*.ts`, `src/data/mappers.ts`, `src/data/supabase/types.ts` |
| Server mutations | `src/server/actions.ts` (large file: forms call these; uses `revalidatePath`) |

---

## Database

- **Migrations:** `supabase/migrations/` (evolved from early `profiles` / `expenses` / `investments` / `financial_goals` toward **`financial_*`** tables and richer profile/onboarding/budget/vehicle/housing/CPF fields).
- **Budget onboarding extensions (`20260512000002_budget_onboarding_profile_extensions.sql`):** nullable `lifestyle_profile`, `budgeting_strategy`, `onboarding_confidence_level`, `budget_generation_source`, `food_spend_band` on `financial_profiles`; `estimated_budget_mode` boolean default false — all constrained to allowed enum-like values; no change to existing onboarding step range (1–4).
- **Types:** `src/data/supabase/types.ts` should reflect the schema your app expects; regenerate or edit when migrations add columns.
- **Advisor / client (POC):** `financial_profiles.profile_type` (`advisor` \| `client`), optional `advisor_user_id` → `auth.users` for clients. **`handle_new_user`** inserts **advisors** with `onboarding_required = false` and **`onboarding_step` null** (no client wizard); **clients** get `onboarding_required = true`, `onboarding_step = 1`, and `advisor_user_id` from the claimed key. Migration **`20260512000001_advisor_skip_onboarding.sql`** also sets `onboarding_required = false` and clears `onboarding_step` for **existing** advisor rows (fixes advisors stuck on onboarding from earlier defaults). Table **`advisor_access_keys`**: unique `access_key`, `status` (`available` \| `claimed` \| `expired`), `claimed_by_user_id`, optional `expires_at`, timestamps. **`handle_new_user`** reads `raw_user_meta_data.profile_type` and `access_key` for clients, claims the key in the same transaction, and sets the profile row. **`validate_client_access_key_for_signup`** (RPC, `SECURITY DEFINER`) is executable by `anon` for pre-checks only. RLS: on **`advisor_access_keys`**, advisors **select/insert/update** only rows where `advisor_user_id = auth.uid()`. On **`financial_profiles`**, **`financial_profiles_select_advisor_clients`** lets advisors **read** linked client rows (`profile_type = client` and `advisor_user_id = auth.uid()`). Migration **`20260513000000_advisor_linked_client_rls.sql`**: index on `(advisor_user_id)` for client rows; **`financial_profiles_update_advisor_linked_clients`** so advisors can **update** linked client profile rows while **`WITH CHECK`** keeps `profile_type` and `advisor_user_id` stable; parallel **`_select/_insert/_update/_delete_advisor_clients`** policies on **`financial_expenses`**, **`financial_investments`**, **`financial_goals`**, **`financial_budget_lines`**, **`financial_budget_line_month_overrides`**, **`financial_cash_accounts`**, **`financial_liabilities`**, **`financial_cpf_balances`**, **`financial_housing_loans`**, **`financial_vehicles`** (each uses `EXISTS` on `financial_profiles` for the same link rule). RPCs **`advisor_client_list_metrics`** (paginated roster + last expense aggregate) and **`advisor_client_list_count`** (`SECURITY INVOKER`, authenticated only) for scalable client lists. Advisors still cannot read other advisors’ clients.
- **Invited client `profile_type` repair (`20260514000000_invited_client_profile_type_repair.sql`):** updates rows that are still `financial_profiles.profile_type = 'advisor'` but have a **claimed** `advisor_access_keys` row with `claimed_by_user_id = financial_profiles.id` — sets them to **`client`** and restores client onboarding fields when onboarding is not completed. Replaces **`handle_new_user`** so any **non-empty `access_key`** in signup metadata always runs the **client** insert path (claim key + `profile_type = 'client'`), even if `profile_type` in metadata says `advisor`, preventing invitees from being stored as advisors.
- **Client `advisor_user_id` sync (`20260515000000_sync_client_advisor_user_from_claimed_key.sql`):** for `profile_type = 'client'` rows with a **claimed** access key on `claimed_by_user_id`, sets `financial_profiles.advisor_user_id` to match `advisor_access_keys.advisor_user_id` when they differ — fixes advisor dashboard / client list showing **0 clients** while **keys claimed** is positive (roster and RLS filter on `financial_profiles.advisor_user_id`, not the keys table alone).
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

_Last reviewed (2026-05-14): migration `20260514000000_invited_client_profile_type_repair.sql` (key invitees `profile_type` + `handle_new_user` access_key precedence); prior advisor workspace + `20260513000000_advisor_linked_client_rls.sql`._
