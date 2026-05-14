# Finance Planner — project context

Living reference for what this app does, how it is structured, and where to change things. **Update this file whenever you add or materially change a user-facing feature, route, data model, or cross-cutting behavior** (auth, onboarding, shell, middleware). For **what is built versus roadmap**, start with [Feature inventory (shipped vs planned)](#feature-inventory-shipped-vs-planned).

---

## Product vision

The product is evolving from a **feature-tab financial tracker** into a **calm, premium, modular private wealth operating system**: a workspace that helps users understand **position**, **cash flow**, **balance sheet**, **protection gaps**, and **long-horizon decisions** — without feeling like a spreadsheet, accounting package, admin console, or cluttered consumer fintech UI.

**Design direction:** premium minimal, calm information density, soft surfaces, modular cards, progressive disclosure, Apple-like hierarchy, spacious layouts, and strong typographic hierarchy. Avoid over-tabbed navigation, heavy borders, crowded dashboards, and feature explosion in the top bar.

**Important framing:** this product should evolve toward a **calm private wealth operating system** rather than a traditional expense tracker. Calculations and methodology remain explicit and user-trustable (not a black-box “score”).

---

## Client UI versioning (generations)

The **client** product surface is tracked as a **UI / information-architecture generation** (independent of `package.json` semver unless you intentionally align them).

| Generation | Summary |
|------------|---------|
| **Version 1** | Earlier shell: fuller top navigation (e.g. Profile as a primary tab), planning centered on **Financial setup** tabs and related redirects without modular **`/planning/**`** workspaces. |
| **Version 2** (current) | **Major UI / IA change:** compact top nav (**Home**, **Planning**, **Activity**, **More**), **`/planning/**`** section workspaces (Overview, Cash Flow, Wealth, Protection, Future), **`/more`** hub + account menu for secondary actions, roadmap **placeholder** cards, and Home framed as a **command center**. Business logic, APIs, and most routes were kept compatible using **adapters** and redirects. |

**Where it is defined in code:** `src/lib/client-release.ts` (`CLIENT_UI_VERSION`, `CLIENT_UI_VERSION_LABEL`). Shown on **`/more`**. Optional override: **`NEXT_PUBLIC_CLIENT_UI_VERSION`** (e.g. `2.1`) in env at build time.

---

## Information architecture & navigation philosophy

**Top navigation (client shell)** is intentionally small: **Home**, **Planning**, **Activity**, **More**. Deep or secondary destinations (profile assumptions, methodology, sign out) live in the **account menu** and the **More** hub so the header stays quiet and scalable.

**Home vs Planning vs Activity vs More**

| Surface | Role |
|--------|------|
| **Home** (`/dashboard`) | **Today’s financial command center**: safe to spend, monthly health, spending control, retirement headline, overview sections, and anchors into this month — prioritized metrics and workflows, not every module. |
| **Planning** (`/planning/...`) | **Modular planning workspaces** composed by section: Overview, Cash Flow, Wealth, Protection, Future. Uses the **same business logic and forms** as Financial setup where real data exists; adds **roadmap placeholder cards** for upcoming modules. |
| **Activity** (`/expenses`) | **Cash activity & spending**: expenses, charts, and month-scoped guidance tied to the budget model. |
| **More** (`/more`) | **Secondary destinations**: profile deep link, planning entry, activity hub, methodology launcher — keeps the top bar from becoming a junk drawer. |

**Classic routes** (`/setup` with tabs, `/goals`, `/balances`, `/budget`, `/financial-profile`) remain valid: many redirect into the new IA for continuity and bookmarks.

---

## Feature inventory (shipped vs planned)

Use this as the source of truth for **what exists today** versus **UI placeholders / roadmap**. In-app roadmap cards (`PlaceholderModuleCard`, `src/features/planning/roadmap-modules.tsx`) carry marketing copy and phase hints; **this table reflects actual wiring**.

**Legend**

| Status | Meaning |
|--------|---------|
| **Shipped** | End-to-end in the app for normal users (subject to profile data and migrations). |
| **Partial** | Real data or workflows plus explicit gaps, or a thin surface with most scope still roadmap. |
| **Planned** | Placeholder UI, copy-only cards, or routes that explain future intent — not a finished product module. |
| **Not in repo** | Referenced from code or docs but no App Router implementation yet. |

### Client — core & shell

| Capability | Status | Notes |
|------------|--------|--------|
| Sign-in / sign-up (Supabase Auth) | **Shipped** | `LoginForm`, `/login`. |
| Advisor vs client profiles + middleware gating | **Shipped** | `middleware.ts`, `(app)/layout.tsx`, `financial_profiles.profile_type`. |
| Client onboarding wizard | **Shipped** | Income → lifestyle → strategy → optional guided budget lines. |
| Invite-only **client** signup via advisor **access key** | **Shipped** | Claim flow in `handle_new_user`; `validate_client_access_key_for_signup` RPC. |
| `/account-issue` when client `advisor_user_id` missing | **Shipped** | Data-integrity / support path. |
| **Client UI v2** shell: Home, Planning, Activity, More | **Shipped** | `AppShell`, `AppShellNav`; version label `src/lib/client-release.ts`, shown on `/more`. |
| Classic URL redirects to v2 IA | **Shipped** | `/balances` → wealth, `/budget` → cash-flow, etc. |
| Email confirmation redirect `/auth/callback` | **Not in repo** | `LoginForm` sets `emailRedirectTo` to `/auth/callback`; add an App Router handler and allow the URL in Supabase if you rely on confirmed-email signup. |

### Client — Home (`/dashboard`)

| Capability | Status | Notes |
|------------|--------|--------|
| Net worth, savings, month-scoped metrics | **Shipped** | `getDashboardPayload` (`src/data/dashboard.ts`). |
| Safe to spend / discretionary after goals | **Shipped** | Requires income/profile where applicable. |
| Spending vs budget / month health | **Shipped** | Tied to budget lines + expenses. |
| **Illustrative** long-horizon projections (investments, cash surplus, CPF, vehicles, combined charts) | **Shipped** | `DashboardRetirementSection`, domain finance modules; methodology links — not advice. |
| Embedded “AI insights” as generative product | **Planned** | Roadmap card only; static `InsightCard` / copy where used. |

### Client — Planning (`/planning/...`)

| Section | Status | Notes |
|---------|--------|--------|
| **Overview** | **Partial** | Live snapshot metrics from dashboard payload; roadmap cards for advisor collaboration extensions and AI layer are **planned**. |
| **Cash flow** | **Shipped** | Budget workspace + progressive income/assumptions (`CashFlowPlanningSection`, `BudgetPlanningView`). |
| **Wealth** | **Shipped** | Same underlying data as Setup: investments, CPF, cash/debts, housing, vehicles. |
| **Protection** | **Partial** | Emergency-fund **recommendation** + link to Wealth for cash; insurance, dependents, estate, risk cards are **planned** (`ProtectionPlanningSection`). |
| **Future** | **Partial** | **Goals** CRUD is **shipped** (`FinancialGoalsPanels`); dedicated “retirement studio”, scenario compare, tax lens, exports, vault are **planned** cards (Home already shows projection **charts**). |

### Client — Activity & setup

| Capability | Status | Notes |
|------------|--------|--------|
| Expenses list / add / charts / month guidance | **Shipped** | `/expenses` (and `/activity` alias); APIs under `src/app/api/expenses/`. |
| Financial Setup tabs (profile → goals) | **Shipped** | `/setup`; mirrored in Planning where noted. |
| Budget lines, overrides, strategy insights | **Shipped** | Repositories + `src/domain/finance/budget*.ts`. |
| SG-oriented guided budget templates (onboarding + domain) | **Shipped** | `budget-guided-setup.ts`, onboarding actions. |
| Investments with contribution phase (until retirement / fixed duration) | **Shipped** | DB migration `20260516000000_*`; Setup → Investments; FV helpers. |
| Housing quick-add / guided property + BSD context; loan amortization | **Shipped** | Domain + Setup → Housing; see Database section. |
| Methodology / “How it works” | **Shipped** | `src/features/help/`, `methodology-topics.ts`. |

### Client — APIs

| Route | Status | Notes |
|-------|--------|--------|
| `/api/budget`, `/api/dashboard`, `/api/expenses`, `/api/profile`, `/api/projection` | **Shipped** | Keep aligned with RSC loaders. |

### Advisor workspace (`/advisor/**`)

| Capability | Status | Notes |
|------------|--------|--------|
| Advisor home / operations snapshot (keys, client counts) | **Shipped** | `getAdvisorDashboardData`; mismatch hints if keys claimed but roster empty. |
| Client roster (search, sort, pagination, health signals) | **Shipped** | RPC-backed list when migrated (`advisor_client_list_metrics`). |
| Per-client workspace (profile, goals, budget edits, month readouts) | **Shipped** | RLS-backed; `AdvisorClientWorkspace`. |
| Access key create/list/revoke | **Shipped** | `/advisor/access-keys`, server actions. |
| **Opportunities** hub | **Planned** | `/advisor/opportunities` — “Coming Soon” panel only. |
| Cross-client **Activity** feed | **Planned** | `/advisor/activity` — “Work in Progress” panel only. |
| Shared briefs / approvals / commentary | **Planned** | Roadmap card (`AdvisorWorkspaceRoadmapCard`, `beta` badge) — not separate from roster + workspace features above. |

### Roadmap modules (Planning cards only)

These match `roadmap-modules.tsx` — all **Planned** as standalone modules unless already covered as **Shipped** above: insurance map, scenario simulator, dependents planning, estate checklist, tax estimation lens, quarterly reports, documents vault, risk profiling, bank **account syncing**. **Retirement planning studio** and **AI insights layer** cards are marked `work_in_progress` in UI but remain **Partial / Planned** as dedicated products (projection **visualizations** on Home are **Shipped**).

---

## Modular card architecture & progressive disclosure

**Direction:** move away from “one noisy page per micro-feature” toward **section-based composition** and **reusable surface components** (`InsightCard`, `RecommendationCard`, `PlaceholderModuleCard`, dashboard sections). **Level 1** is a simple summary; **Level 2** is the planning workspace; **Level 3** is advanced assumptions (often behind disclosure, e.g. collapsible income blocks on Cash Flow).

Shared numeric flows still come from **`src/data/dashboard.ts`**, **`src/domain/finance/**`, and existing repositories — new UI is largely **routing + composition**, not duplicate calculators.

---

## AI insight philosophy

There is **no standalone “AI page”**. Intelligence is modeled as **contextual overlays** (insight and recommendation cards) that can attach to Home, Planning, or Activity surfaces over time. Placeholder roadmap cards describe an **AI insights layer** as **embedded** analysis, not a separate chat product. **Today those cards are not backed by a generative or LLM pipeline** — see [Feature inventory](#feature-inventory-shipped-vs-planned) (Home / Planning rows).

---

## Placeholder / roadmap module strategy

**`PlaceholderModuleCard`** (`src/components/placeholders/PlaceholderModuleCard.tsx`) is the standard surface for **planned** capabilities: title, description, status badge (`planned` \| `work_in_progress` \| `beta` \| `complete`), optional tags, optional phase copy, optional icon, and a **disabled, premium** visual treatment (not error/empty states).

Card badges describe product **intent**, not implementation depth — use **[Feature inventory (shipped vs planned)](#feature-inventory-shipped-vs-planned)** for engineering truth. Module titles still map to `src/features/planning/roadmap-modules.tsx`.

---

## Long-term scalability goals

- **Registry-friendly modules:** new domains should plug in as **section cards** + optional **repository** layers, not new top-level tabs by default.
- **Adapter-first migration:** prefer **URL adapters**, **shared loaders** (e.g. `loadSetupTabBundle`), and **href builders** (`setupBudgetPath` vs `planningCashFlowBudgetPath`) over destructive rewrites.
- **Revalidation:** `revalidateSetupAndPlanning()` (`src/lib/planning-revalidate.ts`) keeps `/setup` and `/planning/**` coherent after mutations.

---

## UX / design principles (engineering-facing)

1. **Key metrics** win the viewport first (safe to spend, net worth, month status).
2. **Active workflows** (budget, expenses, setup forms) stay one or two taps deep.
3. **Contextual actions** (methodology, cross-links) are visible but quieter.
4. **Secondary information** uses softer type, spacing, and surfaces — fewer hard boxes.

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

Public env (client): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Detection helper: `src/lib/env.ts` (`isSupabaseConfigured`). Advisor phone verification requires Supabase Auth Phone plus an SMS provider configured in the Supabase project.

---

## Routes (user-visible)

| Path | Role |
|------|------|
| `/` | Redirects to `/dashboard` (advisors are then sent to `/advisor` by middleware). |
| `/login` | Standalone sign-in / sign-up (`src/app/login/page.tsx`, `LoginForm`). Not wrapped in `(app)` shell. |
| `/dashboard` | **Client Home / command center**: net worth, savings, month activity, retirement/CPF (`(app)/dashboard`). Advisors hitting client routes are redirected to `/advisor`. |
| `/home` | **Client alias** → `/dashboard` (`(app)/(client)/home/page.tsx`). |
| `/planning` | Redirect → `/planning/overview` (`(app)/planning/page.tsx`). |
| `/planning/overview` | Planning workspace: snapshot-style overview + dashboard overview reuse + roadmap card(s). |
| `/planning/cash-flow` | Budget workspace + progressive “Advanced” income & assumptions (`BudgetPlanningView` + profile forms). |
| `/planning/wealth` | Balance sheet workspace: investments, CPF, cash/debts, housing, vehicles (same components as Setup). |
| `/planning/protection` | **Partial:** emergency-fund recommendation + roadmap placeholder cards; edit cash under Wealth. |
| `/planning/future` | **Partial:** goals (CRUD) **shipped**; retirement/scenario/tax/report/vault cards are placeholders (Home has projection charts). |
| `/activity` | **Client alias** → `/expenses` (`(app)/(client)/activity/page.tsx`). |
| `/profile` | **Client alias** → `/setup?tab=profile` (`(app)/(client)/profile/page.tsx`). |
| `/more` | Secondary hub: profile, planning entry, activity, methodology, and **Client UI version** strip (`(app)/more/page.tsx`, `src/lib/client-release.ts`). |
| `/advisor` | **Advisor** workspace home: client/key snapshot cards (`(app)/advisor/page.tsx`). |
| `/advisor/clients` | **Advisor** client roster: search, sort, pagination, card grid with health signals (`advisor_client_list_metrics` RPC when migrated). |
| `/advisor/opportunities` | **Advisor** placeholder hub for future product/opportunity workflows (`Coming Soon`). |
| `/advisor/activity` | **Advisor** placeholder cross-client activity feed (`Work in Progress`). |
| `/advisor/access-keys` | **Advisor** access key management (moved out of client Setup). |
| `/advisor/buy-keys` | **Advisor** coupon-backed access key purchase flow (`product_code = 0001`). |
| `/advisor/profile` | **Advisor** WhatsApp phone verification. |
| `/advisor/client/[id]` | **Advisor** client workspace: profile edits, goals/budget quick edits, dashboard-month cashflow readouts, RLS-backed data (`AdvisorClientWorkspace`). |
| `/expenses` | **Activity / spending** hub: add/list expenses, charts, spend guidance (`(app)/expenses`). |
| `/spending` | **Alias**: server redirect to `/expenses`. |
| `/setup` | **Financial setup** hub with tabs: profile, investments, CPF, cash/debts, housing, vehicles, budget, goals (`(app)/setup`). Still fully supported. |
| `/balances` | Redirect → `/planning/wealth` (wealth workspace). |
| `/budget` | Redirect → `/planning/cash-flow` with month/year query (same budget UI). |
| `/financial-profile` | Redirect → `/setup?tab=profile`. |
| `/goals` | Redirect → `/planning/future` (goals live in Future workspace). |
| `/onboarding` | Post-auth wizard when profile requires onboarding (`OnboardingWizard`). |
| `/account-issue` | Shown when a **client** profile has no `advisor_user_id` (data integrity / support path). |

**API routes** (`src/app/api/`): `budget`, `dashboard`, `expenses`, `expenses/[id]`, `profile`, `projection` — JSON for client or integrations; keep in sync with page data needs.

---

## Auth, onboarding, and gating

- **Supabase Auth** via server client (`src/data/supabase/server.ts`) and browser client (`browser.ts`).
- **`(app)/layout.tsx`**: Loads user and **`financial_profiles`** row, resolves **`workspace`**: `advisor` vs `client`, passes into **`AppShell`** for role-appropriate chrome.
- **`src/middleware.ts`**: If Supabase env is set, reads session. For logged-in users on **gated** paths — **client app** (`dashboard`, `home`, `planning`, `activity`, `profile`, `expenses`, `spending`, `budget`, `setup`, `balances`, `goals`, `financial-profile`, `more`, `onboarding`, `account-issue`) or **`/advisor/**`**:
  - **Advisors** on any **client** path above (including **`/onboarding`**) → redirect **`/advisor`** (they do not use client onboarding or personal finance surfaces).
  - **Clients** on **`/advisor/**`** → redirect to **`/account-issue`**, **`/onboarding`**, or **`/dashboard`** depending on profile flags (same rules as post-login routing).
  - If the profile is a **client** but **`advisor_user_id` is null** → **`/account-issue`** (except when already there).
  - **Onboarding** is enforced only for **clients** with `onboarding_required` and no `onboarding_completed_at`.
  - If onboarding not required and user hits **`/onboarding`** → redirect **`/dashboard`**.

**LoginForm** (`src/features/auth/LoginForm.tsx`): **Sign-in** loads `financial_profiles` and sends **advisors** to **`/advisor`**, **clients** to **`/onboarding`** or **`/dashboard`** (or **`/account-issue`** if `advisor_user_id` is missing). **Sign up**: **Financial advisor** collects a WhatsApp phone and goes to **`/advisor`** when a session exists immediately; **Client** → **`/onboarding`**. Supabase **signUp** sets `emailRedirectTo` to **`/auth/callback`** on the current origin (add that App Router route and allow the URL in Supabase if you rely on email confirmation). **Sign out**: server action `signOutAction` → `/login` (also available from the account menu).

---

## App shell UX

**`src/features/app-shell/AppShell.tsx`**

- Header: brand link ( **`/dashboard`** for clients, **`/advisor`** for advisors ), subtitle (“Private wealth clarity” vs “Advisor workspace”), optional **main nav**, client **Contact advisor**, advisor phone prompt, **How it works** button, **account menu** (signed-in) or **Sign in**.
- **`AppShellNav`** (**client** only): **Home** → `/dashboard`; **Planning** → `/planning/overview` (active on `/planning/**`, `/setup/**`, `/balances`, `/budget`, `/financial-profile`, `/goals`); **Activity** → `/expenses` (active on `/expenses`, `/spending`); **More** → `/more` (active on `/more`, `/account-issue`).
- **`AppShellUserMenu`**: avatar + email, links to profile (`/setup?tab=profile`), **More**, **How it works** (methodology sheet), **Sign out**.
- Advisor navigation is rendered in a dedicated sidebar under `src/app/(app)/advisor/layout.tsx` using `AdvisorWorkspaceSidebar`, including Workspace, Clients, Opportunities, Activity, Access keys, and Buy keys.
- **Main app nav is shown only when** the user is signed in **and** the path does **not** start with `/onboarding`.

**`AppShellNav.tsx`**: Prefetches `/dashboard`, `/expenses`, `/planning/overview`, and `/more`.

---

## Code map (where features live)

| Area | Location |
|------|-----------|
| Pages (RSC-heavy) | `src/app/(app)/`, `src/app/(app)/(client)/` (IA alias redirects), `src/app/login/`, `src/app/page.tsx` |
| App chrome | `src/features/app-shell/` (`AppShell`, `AppShellNav`, `AppShellUserMenu`) |
| Planning workspace | `src/app/(app)/planning/**`, `src/features/planning/` (`load-setup-tab-bundle`, `PlanningSectionNav`, `sections/*`, `roadmap-modules`) |
| Shared planning constants | `src/lib/planning-sections.ts`, `src/lib/planning-revalidate.ts` |
| Client UI generation label | `src/lib/client-release.ts` (shown on `/more`; optional `NEXT_PUBLIC_CLIENT_UI_VERSION`) |
| Placeholder & insight surfaces | `src/components/placeholders/`, `src/components/insights/` |
| Onboarding | `src/features/onboarding/`, `(app)/onboarding/page.tsx` — guided income → lifestyle → strategy → optional **recommended budget lines** (server `applyGuidedBudgetLinesAction`); profile stores `lifestyle_profile`, `budgeting_strategy`, `onboarding_confidence_level`, `food_spend_band`, `estimated_budget_mode`, `budget_generation_source` |
| Budget lens (Setup) | `src/features/setup/BudgetLensProfileForm.tsx` — edit lifestyle/strategy after onboarding (PATCH `/api/profile`) |
| Budget strategy & guided templates | `src/domain/finance/budget-guided-setup.ts` — lifestyle presets, 50/30/20-style splits, SG-oriented line generator, category→needs/wants/savings heuristics for visuals |
| Auth UI | `src/features/auth/` |
| Advisor workspace | `src/app/(app)/advisor/**`, `src/features/advisor/` (sidebar, `AdvisorClientWorkspace`, `AdvisorClientsBoard`, purchase/profile/contact components, forms), `src/data/repositories/advisor-access-keys.ts`, `advisor-clients.ts` (incl. `listAdvisorClientsWorkspace` + RPC), `advisor-dashboard.ts`, `pricing.ts`, `purchases.ts`, `coupons.ts`, `src/server/advisor-access-key-actions.ts`, `src/server/advisor-client-actions.ts` (linked-client mutations + revalidation), `src/server/advisor-key-purchase-actions.ts`, `src/domain/finance/advisor-client-health.ts`, `src/lib/profile-role.ts`, `src/lib/advisor-access-key-token.ts` |
| Dashboard | `src/features/dashboard/`, `src/data/dashboard.ts` |
| Expenses / spending UI | `src/features/expenses/`, `src/features/spend/`, `src/data/repositories/expenses.ts`, spend recommendations data |
| Budget | `src/features/budget/` (`BudgetPlanningView`, `BudgetStrategyInsightPanel` for target vs line mix + placeholders), `src/data/repositories/budget-lines.ts`, overrides, `src/domain/finance/budget.ts` |
| Setup tabs | `src/features/setup/SetupTabsNav.tsx`, `src/lib/setup-urls.ts` (`setupBudgetPath` for classic `/setup` budget tab; `planningCashFlowBudgetPath` for `/planning/cash-flow`) |
| Goals / balances / loans / vehicles / CPF | `src/features/goals/`, related `src/data/repositories/*` |
| Help / methodology | `src/features/help/`, `src/content/methodology-topics.ts`, `OpenMethodologyButton.tsx` |
| Pure finance logic | `src/domain/finance/` (projections, net worth, SG CPF/vehicle/housing helpers, tests alongside) |
| DB access patterns | `src/data/repositories/*.ts`, `src/data/mappers.ts`, `src/data/supabase/types.ts` |
| Server mutations | `src/server/actions.ts` (large file: forms call these; uses `revalidatePath` + `revalidateSetupAndPlanning` where setup/planning overlap) |

---

## Database

- **Migrations:** `supabase/migrations/` (evolved from early `profiles` / `expenses` / `investments` / `financial_goals` toward **`financial_*`** tables and richer profile/onboarding/budget/vehicle/housing/CPF fields).
- **Investment contribution phases (`20260516000000_investment_contribution_phases.sql`):** nullable `contribution_type` (`until_retirement` \| `fixed_duration`), `contribution_duration_years`, and reserved `contribution_end_age` / `contribution_end_date` on **`financial_investments`**. Nulls keep legacy behavior (monthly deposits through the retirement horizon when birth + target age exist; otherwise the full chart horizon). Domain: `projectFutureValue` optional `contributionMonthsLimit`, portfolio sum helpers in `src/domain/finance/investment-portfolio-fv.ts`, UI on Setup → Investments.
- **Housing loan property planning (`20260516100000_housing_loan_property_planning.sql`):** nullable **`financial_housing_loans`** columns: `property_purchase_price`, `property_kind` (`hdb` \| `condo` \| `ec` \| `landed`), `downpayment_guidance_preset` (`pct_20` \| `pct_25` \| `custom`), optional `downpayment_guidance_custom_percent` / `downpayment_guidance_custom_amount`, snapshot `buyers_stamp_duty`, and `financing_includes_bsd` (default `false` for legacy rows). **CPF amortization still uses `principal` + rate + term**; new fields are affordability context. Domain: `singapore-residential-bsd.ts` (IRAS-style residential BSD tiers), `property-financing-plan.ts` (guided deposit + financing toggle), extended `deriveQuickHousingLoanRow` in `housing-loan-quick.ts`. UI: Setup → Housing **`HousingLoanQuickAddForm`** guided planner + list hints in **`HousingLoansPanel`**. **`createHousingLoanQuickAction`** accepts `guided_dp_preset` (omit + `deposit_total` for legacy quick-add); zod: `housingPropertyKindSchema`, `housingDownpaymentGuidancePresetSchema` in `src/lib/validation.ts`.
- **Housing BSD paid from CPF OA (`20260517000000_housing_loan_bsd_paid_from_cpf_oa.sql`):** boolean **`financial_housing_loans.buyers_stamp_duty_paid_from_cpf_oa`** (default `false`). When true, estimated BSD is treated as paid from CPF OA (feeds OA fee / projection paths); when false, BSD is cash. Ensures **`financing_includes_bsd`** exists if an older DB skipped the prior migration. **`financing_includes_bsd`** remains a legacy “BSD rolled into financed principal” flag; new saves prefer the OA-vs-cash BSD flag.
- **Types:** `src/data/supabase/types.ts` should reflect the schema your app expects; regenerate or edit when migrations add columns.
- **Advisor / client (POC):** `financial_profiles.profile_type` (`advisor` \| `client`), optional `advisor_user_id` → `auth.users` for clients, plus advisor `phone_e164` / `phone_verified_at`. **`handle_new_user`** inserts **advisors** with `onboarding_required = false` and **`onboarding_step` null** (no client wizard); **clients** get `onboarding_required = true`, `onboarding_step = 1`, and `advisor_user_id` from the claimed key. Migration **`20260512000001_advisor_skip_onboarding.sql`** also sets `onboarding_required = false` and clears `onboarding_step` for **existing** advisor rows. Table **`advisor_access_keys`**: unique `access_key`, optional `purchase_id`, `status` (`available` \| `claimed` \| `expired`), `claimed_by_user_id`, optional `expires_at`, timestamps. **`handle_new_user`** reads `raw_user_meta_data.profile_type` and `access_key` for clients, claims the key in the same transaction, and sets the profile row. **`validate_client_access_key_for_signup`** (RPC, `SECURITY DEFINER`) is executable by `anon` for pre-checks only. RLS: on **`advisor_access_keys`**, advisors **select/insert/update** only rows where `advisor_user_id = auth.uid()`. On **`financial_profiles`**, **`financial_profiles_select_advisor_clients`** lets advisors **read** linked client rows (`profile_type = client` and `advisor_user_id = auth.uid()`). Migration **`20260513000000_advisor_linked_client_rls.sql`**: index on `(advisor_user_id)` for client rows; **`financial_profiles_update_advisor_linked_clients`** so advisors can **update** linked client profile rows while **`WITH CHECK`** keeps `profile_type` and `advisor_user_id` stable; parallel **`_select/_insert/_update/_delete_advisor_clients`** policies on financial tables via the same link rule. RPCs **`advisor_client_list_metrics`** and **`advisor_client_list_count`** power scalable client lists. Advisors still cannot read other advisors’ clients.
- **Advisor purchases and verified contact:** advisor key purchase uses **`pricing`** (`product_code = 0001`, SGD), **`coupons`** (POC seed `POCUNLIMITED`), **`purchases`**, and **`coupon_redemptions`** through security-definer RPCs. Clients contact advisors only through **`get_my_advisor_contact()`**, which returns a derived WhatsApp URL after advisor phone verification.
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

1. After shipping a feature, update the **[Feature inventory](#feature-inventory-shipped-vs-planned)** row (status + notes), then add or adjust a **row in Routes** or a **paragraph under Code map / Database** (one or two lines is enough).
2. If behavior changes globally (middleware, shell, login redirect), update **Auth, onboarding, and gating** or **App shell UX**.
3. If you introduce a new top-level domain concept (e.g. “tax estimates”), add a **Code map** row and point to the main module.
4. Keep claims aligned with **code**; avoid marketing copy that does not match the UI. Roadmap **`PlaceholderModuleCard`** badges can stay aspirational; the inventory table should stay factual.

_Last reviewed (2026-05-14): added **Feature inventory (shipped vs planned)**; housing **`buyers_stamp_duty_paid_from_cpf_oa`** migration note; clarified roadmap cards vs implementation; `/auth/callback` called out as not in repo; cherry-picked advisor key purchase / coupon workflow, verified WhatsApp contact RPC, and advisor phone verification from `main`._
