# Finance Planner — project context

Living reference for what this app does, how it is structured, and where to change things. **Update this file whenever you add or materially change a user-facing feature, route, data model, or cross-cutting behavior** (auth, onboarding, shell, middleware). For **what is built versus roadmap**, start with [Feature inventory (shipped vs planned)](#feature-inventory-shipped-vs-planned).

---

## Product vision

The product is evolving from a **feature-tab financial tracker** into a **calm, premium, modular private wealth operating system**: a workspace that helps users understand **position**, **cash flow**, **balance sheet**, **protection gaps**, and **long-horizon decisions** — without feeling like a spreadsheet, accounting package, admin console, or cluttered consumer fintech UI.

**Design direction:** premium minimal, calm information density, soft surfaces, modular cards, progressive disclosure, Apple-like hierarchy, spacious layouts, and strong typographic hierarchy. Avoid over-tabbed navigation, heavy borders, crowded dashboards, and feature explosion in the top bar.

**Important framing:** this product should evolve toward a **calm private wealth operating system** rather than a traditional expense tracker. Calculations and methodology remain explicit and user-trustable (not a black-box “score”).

**Collaborative planning (advisor ↔ client):** the **client’s tracker is canonical**. Advisors work in **suggestion mode** — field-level proposed changes, grouped for review, with optional educational notes. Clients see transparent before/after comparisons on a dedicated review screen and choose **accept** or **reject**; nothing silent-overwrites client data. Feels like suggested edits / a lightweight pull request, not CRM admin editing.

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
| Sign-in / sign-up (Supabase Auth) | **Shipped** | `LoginForm`, `/login`. Root `/` shows a light branded splash when signed out; signed-in users route by role/onboarding via `resolveRootDestination` (`src/lib/root-destination.ts`). |
| Advisor vs client profiles + middleware gating | **Shipped** | `middleware.ts`, `(app)/layout.tsx`, `financial_profiles.profile_type`. |
| Client onboarding wizard | **Shipped** | Three-step flow: gross salary + CPF take-home preview → money style + illustrated budget → finish. Lifestyle lens removed from onboarding (defaults used; editable in Setup Budget lens). Seeds `financial_profiles`. See [Onboarding philosophy](#onboarding-philosophy). |
| Invite-only **client** signup via advisor **access key** | **Shipped** | Claim flow in `handle_new_user`; `validate_client_access_key_for_signup` RPC. |
| QR / link invite sharing for access keys | **Partial** | Share URL + QR for client signup; known single-use / expiry edge cases (`qr_token_invalid`). |
| Contact advisor (WhatsApp) | **Shipped** | Client shell **Contact advisor**; `get_my_advisor_contact()` after advisor phone verification. |
| `/account-issue` when client `advisor_user_id` missing | **Shipped** | Data-integrity / support path. |
| **Consent-gated advisor access** + client consent control | **Shipped** | Advisor reads of client financial data require **active client consent**, enforced in-DB via SECURITY DEFINER `advisor_read_*` RPCs (chokepoint; legacy direct-advisor `financial_*` RLS dropped). Client grants/withdraws on **`/more`** → Privacy & Advisor Access (`ClientConsentControl`); pending consent surfaces via **inbox** (`advisor_consent_request`, mark-read clears notification only), a compact persistent **shell strip** + **account-menu** row until consent is active, and a page-local callout on `/more`. Consent dialog on **Contact advisor** (`ContactAdvisorButton`). Append-only `advisor_client_consents` ledger, latest-event-wins with monotonic `seq`; per-event verbatim `consent_text`/`consent_version` (`2026-05-18.option-b`). Migration `20260529000000`; ship gate `verify_consent_gated_access()` = `OK` on prod. |
| **Client UI v2** shell: Home, Planning, Activity, More | **Shipped** | `AppShell`, `AppShellNav` (`AppShellMobileNav` / `AppShellDesktopNav`); mobile header + scrollable setup tabs; version label `src/lib/client-release.ts`, shown on `/more`. |
| Classic URL redirects to v2 IA | **Shipped** | `/balances` → wealth, `/budget` → cash-flow, etc. |
| Email confirmation redirect `/auth/callback` | **Shipped** | `src/app/auth/callback/route.ts` — exchanges the one-time `code` for a session via `supabase.auth.exchangeCodeForSession`, then redirects (default `/`; root page routes by role). Required when Supabase **Confirm Email** is ON. Doubles as the landing for magic-link / OAuth flows if those are added later. |
| Review advisor-proposed plan changes | **Shipped** | Full-page **`/review/proposal/[id]`** — before/after by section, advisor note, accept/reject. Canonical tracker updates only on accept. |
| Financial inbox notifications (bell) | **Shipped** | `financial_inbox_notifications`; salary-review + advisor-proposal producers. |
| Client-safe save error handling | **Shipped** | User-facing server actions use `toClientErrorMessage` (`src/lib/client-error.ts`) so Supabase/PostgREST schema-cache, missing-column, and constraint failures do not leak raw database details into forms. Known-safe domain validation remains specific; operational errors are logged server-side and shown as calm retry/refresh messages. |
| Light / dark / system theme | **Shipped** | Root layout bootstraps a no-flash theme that follows system preference by default, with optional saved Light / Dark overrides in the account dropdown. Global semantic tokens plus a dark-mode compatibility bridge keep existing shared surfaces, forms, nav rails, and common slate/zinc utility colors legible; Dashboard, Goals, Planning, Activity, More, Budget, Setup, and Wealth setup now also carry explicit dark variants on their main cards, prompts, charts, and form surfaces. |

### Client — Home (`/dashboard`)

| Capability | Status | Notes |
|------------|--------|--------|
| Net worth, savings, month-scoped metrics | **Shipped** | `getDashboardPayload` (`src/data/dashboard.ts`). Net worth includes investments, cash, optional CPF, vehicles, current property net equity, and liabilities. |
| Safe to spend / discretionary after goals | **Shipped** | Requires income/profile where applicable. |
| Spending vs budget / month health | **Shipped** | Tied to budget lines + expenses. |
| **Illustrative** long-horizon projections (investments, cash surplus, CPF, vehicles, property, combined charts) | **Shipped** | `DashboardRetirementSection`, domain finance modules; methodology links — not advice. Data layer exposes a time-aware retirement cash-flow ledger on each age row (cash-accessible inflows, required outflows, structured outflow components, pre-portfolio gap, component income, investment / ILP principal sold, cash-reserve drawdown, GoalsGap, funded transfers), and the Home retirement section renders the **retirement runway** chart (`RetirementRunwayLedgerChart`) — a warm-light financing-ledger view: each age-year bar totals required outflows but is stacked by how those outflows are financed (take-home, passive income, investment income, investment / ILP drawdown, cash reserve spend-down, shortfall). A top-left toggle switches the chart between cash-off and cash-reserve scenarios; hover and the default-collapsed **Breakdowns** pane expose selected-age Planned expenses, Source, net-worth components including property net equity, and CPF buckets. Breakdowns cards are collapsible and default expanded; the pane matches chart height on wide layouts, stacks on narrow containers, and scrolls internally when details overflow. Milestones render below the chart, and a dark line keeps net worth on a secondary axis. CPF salary/bonus contributions stop at modeled retirement while CPF interest, housing OA deductions, CPFIS, RA routing, and CPF LIFE continue. It replaces the removed `AgeCombinedAssetsProjectionChart`. |
| **CPF retirement projection + CPF Investments** (OA/SA investment entries, FRS/BRS/ERS estimates, age-55 RA simulation, educational scenarios) | **Shipped** | Setup/Wealth → CPF & CPF Investments supports **CPF balance as-of month** (projection starts the following month), multiple OA/SA investment entries with purchase month, single vs regular premium, amount, growth, and maturity month. Home shows a Dec year-end CPF snapshot when required inputs are complete; if no CPF balance row exists, forward projections start from virtual $0 CPF buckets while current net worth still only counts saved CPF balances. `buildCpfMonthlyProjectionSeries` uses the 2026 CPF allocation ratios, caps MA at the applicable Basic Healthcare Sum (official values through 2026; future years estimated at 4% p.a. until CPF releases figures), overflows MA excess to SA, deducts future CPF investment premiums, carries notional CPF investment value, and routes maturity proceeds: OA → OA; SA before 55 → SA; SA after SA closure → RA first, then OA. |
| Embedded “AI insights” as generative product | **Planned** | Roadmap card only; static `InsightCard` / copy where used. |

### Client — Planning (`/planning/...`)

| Section | Status | Notes |
|---------|--------|--------|
| **Overview** | **Partial** | Live snapshot metrics from dashboard payload; roadmap cards for advisor collaboration extensions and AI layer are **planned**. |
| **Cash flow** | **Shipped** | Budget workspace + progressive income/assumptions (`CashFlowPlanningSection`, `BudgetPlanningView`). Hero shows take-home, monthly planned total, and **Free Cash Flow** (unallocated cash plus Savings / future-you budget lines). The visible Investments budget row is sourced from active Setup → Investments monthly contributions; manual budget lines named “Investments” are ignored so setup stays the source of truth. Goal monthly commitments remain separate footnotes (`budget-cash-flow-allocation.ts`). Incomplete-setup checklist banner when income or monthly plan is missing (`cash-flow-setup-guidance.ts`, `CashFlowSetupGuidanceBanner`). |
| **Wealth** | **Shipped** | Same underlying data as Setup: investments, CPF, cash/debts, housing, vehicles. Debts support loan categories, repayment estimates (amortized / flat / revolving), budget sync, and payoff-aware projections (`DebtPlanningPanels`, `debt-repayment.ts`). |
| **Protection** | **Partial** | Emergency-fund **recommendation** + link to Wealth for cash; insurance, dependents, estate, risk cards are **planned** (`ProtectionPlanningSection`). |
| **Future** | **Partial** | **Goals** CRUD is **shipped** (`FinancialGoalsPanels`); per-goal **feasibility** (deadline math vs priority-funded surplus — extend date or free cash) is **shipped** (`goal-feasibility.ts`, `GoalFeasibilityNotice`). Dedicated “retirement studio”, scenario compare, tax lens, exports, vault are **planned** cards (Home already shows projection **charts**). |

### Client — Activity & setup

| Capability | Status | Notes |
|------------|--------|--------|
| Expenses list / add / charts / month guidance | **Shipped** | `/expenses` (and `/activity` alias); APIs under `src/app/api/expenses/`. |
| Spending guidance (budget vs actual) | **Shipped** | `SpendGuidancePanel` on Activity and dashboard month section. |
| Profile income / CPF assumptions | **Shipped** | Setup **profile** tab — income, bonus, birth date, CPF salary path; onboarding sync banner. No retirement fields. |
| CPF balance tracking (Setup) | **Shipped** | Setup → CPF; captures OA / SA / MA plus balance-as-of month, feeds Home year-end CPF projection and Wealth. If absent, Home can still project future CPF salary inflows from $0 without adding CPF to current net worth. |
| Cash account balances | **Shipped** | Setup cash/debts; net worth and emergency-fund context. Liquidity **buckets** (emergency fund, everyday spending, short-term savings, other) per account; **balance history** snapshots on create/save (`financial_cash_account_snapshots`, migration `20260601020000_*`). |
| Vehicle planning (SG COE/PARF, loans) | **Shipped** | Setup → vehicles; included in Wealth and long-horizon projections. |
| Financial goals (targets, contributions) | **Shipped** | Setup goals tab + Future workspace; **Retirement targets** (`RetirementTargetsForm`: age, spend, expense growth, dividend yield, withdrawal rate); savings goals CRUD; priority order and monthly trade-off panel. |
| Income tax estimation lens | **Partial** | Setup → Income tax tab + `/api/income-tax`; review assumptions and known gaps. |
| **Financial Setup Hub** (progress, section status, recommended next step) | **Shipped** | `/setup/overview` and bare `/setup` as the stable Financial setup landing experience; config in `src/domain/setup/modules.ts`, evaluators in `src/domain/setup/evaluators.ts`, loader `src/data/setup-status.ts`. Legacy `/planning/setup` redirects here. |
| Financial Setup tabs (profile → goals) | **Shipped** | `/setup?tab=…` (focused editors); `SetupTabsNav` scrollable pills on mobile and includes Overview so users can move between progress hub and editor sections without feeling they changed products. Mirrored in Planning where noted; hub links into each tab/workspace. |
| Budget lines, overrides, strategy insights, recurring budget review, irregular expense reserves | **Shipped** | Repositories + `src/domain/finance/budget*.ts`; budget workspace now includes a month-by-month review workflow for planned categories, actual spend, temporary overrides, unbudgeted spend, scheduled/inactive lines, and annual / irregular expense reserve planning with quarterly, semi-annual, annual, and monthly set-aside helpers. |
| SG-oriented guided budget templates (onboarding + domain) | **Shipped** | `budget-guided-setup.ts`, onboarding actions. |
| Investments with contribution phase, step-ups, component income, and withdrawals | **Shipped** | DB migrations `20260516000000_*` + `20260601010000_*` + `20260624000000_*` + `20260627000000_investment_income_and_yearly_withdrawal.sql`; Setup/Wealth → Investments; FV helpers support until-retirement / fixed-duration / **calendar premium end** contributions, ILP guidance (pure investment vs bundled cover, double-count reminder), annual contribution step-ups, per-component `investment_income_rate_annual` (pure-investment dividends or ILP post-maturity cash income), planned yearly withdrawals with legacy monthly fallback, ILP plan-start/maturity validation, withdrawal start age entry when profile age is known, assumption banners, and annual review reminders via `last_investment_review_at` + `investment-review.ts`. |
| **Housing (asset-first)** — HDB homes + linked mortgages | **Shipped** | **`financial_properties`** (current ownership) + **`financial_housing_loans.property_id`** (optional mortgage debt). Setup tab **Housing** (`/setup?tab=housing`; legacy `housing-loans` redirects). **Add HDB home** form is MVP-focused on **BTO** and **Resale HDB**; EC/condo/landed options are visible as planned. It captures purchase price/year, **option fee** (default S$2,000 cash for BTO), **BSD** and **legal fees** as separate editable payment events (CPF vs cash split + paid month each), first/second downpayment, remaining loan amount, **HDB loan default 2.6%** or **bank rate user entry**, and monthly instalment CPF/cash split. CPF projections deduct OA in each event’s paid month via `housingUpfrontOaEvents`. Dashboard net worth includes current property net equity. **`planning_scope`**=`future_simulation` reserved for Goals property purchase (no live cashflow). Migrations `20260519120000` + `20260623000000` + `20260628000000`. |
| **Debt planning** (categories, repayment, budget + projection integration) | **Shipped** | `financial_liabilities` extended fields; auto monthly budget lines under “Debt Repayments”; educational UX in Setup / Wealth. Loan details capture remaining tenure as **years + months** while storing total months; month overflow rolls into years. Multi-debt **avalanche vs snowball** comparison with optional extra monthly (`debt-payoff-strategies.ts`, `DebtPayoffStrategyComparison`). Amber hint when repayment assumptions are missing. |
| Methodology / “How it works” | **Shipped** | `src/features/help/`, `methodology-topics.ts`. |

### Client — APIs

| Route | Status | Notes |
|-------|--------|--------|
| `/api/budget`, `/api/dashboard`, `/api/expenses`, `/api/profile`, `/api/projection` | **Shipped** | Keep aligned with RSC loaders. |

### Advisor workspace (`/advisor/**`)

| Capability | Status | Notes |
|------------|--------|--------|
| Advisor home / operations snapshot (keys, client counts) | **Shipped** | `getAdvisorDashboardData`; mismatch hints if keys claimed but roster empty. |
| Client roster (search, sort, pagination, health signals) | **Shipped** | RPC-backed list when migrated (`advisor_client_list_metrics`). Quick filters: pending onboarding, consent not granted / withdrawn, needs attention (`filter` query on `/advisor/clients`). |
| Per-client workspace (profile, goals, budget edits, month readouts) | **Shipped** | RLS-backed; `AdvisorClientDetailShell`, `AdvisorClientOverview`, and `AdvisorClientCompose`. Compose exposes editable suggestions for default-visible profile assumptions / retirement assumptions, existing goal name + target + monthly contribution, existing monthly budget category + amount, investments, and category-gated sensitive assets/debts. |
| **Advisor proposal & change review** (suggestion mode) | **Shipped** | Advisors queue **field-level** edits on a draft proposal; client reviews on **`/review/proposal/[id]`** and accepts/rejects before canonical data updates. Inbox CTA via `financial_inbox_notifications` (`kind: advisor_proposal`). |
| Access key create/list/revoke | **Shipped** | `/advisor/access-keys`, server actions. |
| Advisor WhatsApp phone verification | **Shipped** | `/advisor/profile`; Supabase Auth Phone + SMS provider. |
| Buy invite keys (coupon-backed purchase) | **Partial** | `pricing`, `coupons`, `purchases` RPCs — confirm production payment provider. |
| Advisor notes and meeting prep | **Planned** | Not in repo. |
| **Opportunities** hub | **Planned** | `/advisor/opportunities` — “Coming Soon” panel only. |
| Cross-client **Activity** feed | **Planned** | `/advisor/activity` — “Work in Progress” panel only. |
| Per-proposal compare projections | **Shipped** | Advisor and client per-proposal detail views render actual-vs-proposed projection compare. _(DB migrations `20260601`–`20260606` applied on prod, verified 2026-05-23.)_ |
| Partial field-level approvals | **Planned** | Accept/reject is still all-or-nothing **per proposal** (no per-field accept); multi-pending lets an advisor split intent across separate proposals instead. |
| **Per-user unique entity names** (cross-cutting data integrity) | **Shipped** | DB enforces **case-insensitive, trimmed** name uniqueness per user across the 7 named-entity tables (migration `20260623000000`, 7 `*_user_name_ci_uq` functional indexes). Advisor **compose** blocks a colliding investment name / goal title; **accept** surfaces a friendly `ProposalConflict` (`reason: name_in_use`) **pre-claim** so the proposal stays `pending` (never parks); **client setup CRUD** shows a friendly message instead of a raw `23505`. Shared validator `normalizeEntityName`/`entityNameCollides`/`entityNameUniquenessError` in `src/lib/validation.ts`; scratch matrix `supabase/tests/unique_entity_names_scenarios.sql`. _(Migration **applied to prod 2026-05-23** via SQL editor; all 7 indexes verified live; zero pre-existing duplicates. App-side friendly guards are **committed but pending deploy** — until the app ships, a collision shows a raw error on the live site.)_ |
| **Advisor propose-CRUD — all 9 entity types** (Phases 2–6 complete) | **Shipped** | Advisor compose can **create / update / delete** every category — profile, budget lines, goals, investments, **cash accounts, liabilities, vehicles, properties, housing loans** — as staged proposals across all 5 seams: compose actions (`src/server/advisor-client-actions.ts`) with Zod allowlist + `entityNameUniquenessError` + the per-category gate; shared overlay branch (`apply-overlay.ts`); accept writer (`apply-changes.ts`, via the generic `applyEntityDiff`; **property + housing-loan use bespoke loops**) with per-type name-conflict guard (name field is `name` for cash/liability/property, **`label`** for vehicle/housing-loan); and a shared **locked "Private" card** (`LockedCategoryCard`) in `AdvisorClientCompose` when the client hasn't shared the category. **Vehicle** exposes the **core 7** fields (full SG valuation set stays in the client's `VehiclesPanel`); **housing-loan** exposes the core fields + an optional **property link**. **Property + housing-loan `property_id` remap (OWASP BOLA guard):** the property accept loop builds a proposal-scoped `propertyIdMap` (draft-key→real-id) + `validPropertyIds` (this client's existing ∪ this-proposal-created); the housing-loan loop (runs **after** properties) remaps `loan.property_id` through it and **throws if the resolved id ∉ `validPropertyIds`** — forbidding cross-client / cross-proposal linkage (mirrors the goal→investment `remapLink`). Backed by a **DB composite FK** `(user_id, property_id) → financial_properties(user_id, id)` as defense-in-depth (migration `20260626`). **Property** + cash/investments are **versioned** (`updated_at` ⇒ `base_version` optimistic-concurrency guard); liabilities/vehicles/housing-loans lack `updated_at` ⇒ last-write-wins on accept (delete-races safe). _(Migrations `20260624`/`20260625`/`20260626` on prod, verified 2026-05-24.)_ |
| **Per-category client privacy toggles** (default PRIVATE) | **Shipped** | Client controls which of the 5 sensitive categories (cash, liabilities, property, housing loans, vehicles) the advisor may **see + propose on** — switch UI on `/more#privacy-advisor-access` and inline on the setup **cash-liabilities / housing / vehicles** tabs (shared `CategoryVisibilityToggle`). Master consent stays separate; category visibility is **additive (AND)**, default **PRIVATE** (`advisor_can_read_category` default-deny). |
| **Advisor↔client proposal UX refinements** | **Shipped** | Compose entry on the **Proposals** sub-tab; frozen **left-column-clipped** Submit bar (ResizeObserver) with a **submit-confirmation** dialog; accept **confirm** + **"Proposal Approved"** approval dialog (Go to page / Stay on page) that survives the accept→accepted re-render; **pending-count badge** on the client Advisor-Proposals tab + setup overview card + **PENDING** status on the setup-hub card; per-proposal review list retitled **"Advisor Proposals"**, grouped by account; centered `ConfirmDialog` (`src/ui/ConfirmDialog.tsx`) for all removal confirms; frozen client **Accept** bar. |

### Product scope (not in repo)

| Capability | Status | Notes |
|------------|--------|--------|
| Admin / operations console | **Not in repo** | No App Router implementation; confirm whether internal support tooling is required. |
| Household / shared family planning | **Not in repo** | Not visible in app; confirm product scope. |
| Regulated financial advice workflow | **Not in repo** | Outputs are educational planning only; formal compliance scope TBD. |

### Roadmap modules (Planning cards only)

These match `roadmap-modules.tsx` — all **Planned** as standalone modules unless already covered as **Shipped** above: insurance map, scenario simulator, dependents planning, estate checklist, quarterly reports, documents vault, risk profiling, bank **account syncing**. **Retirement planning studio** and **AI insights layer** cards are marked `work_in_progress` in UI but remain **Partial / Planned** as dedicated products (projection **visualizations** on Home are **Shipped**). Income tax has a **Partial** Setup tab (see Activity & setup); the Future roadmap **tax lens** card remains **planned** as a fuller module.

---

## Financial Setup Hub (`/setup/overview`)

**Purpose:** Reduce onboarding fatigue by turning fragmented setup tabs into a **guided, resumable** hub — overall progress, per-section status, and a single **recommended next step** — while keeping focused `/setup?tab=…` editors for direct data entry.

**UX philosophy:** Premium, calm, spacious fintech (cards, soft surfaces, subtle status rings). Avoid dense tables and enterprise clutter. Users complete profile, cash flow, protection, and future modules **progressively**; advisors will later reuse the same snapshot shape for client completion visibility (filter incomplete sections) — not implemented in advisor UI yet.

**Status system:** Config-driven modules (`src/domain/setup/modules.ts`). Each module is evaluated by pure rules in `src/domain/setup/evaluators.ts` → `complete` \| `partial` \| `not_started`, plus `completionPercentage`, `lastUpdatedAt` (from underlying rows), and `missingFields` for follow-up. MVP rules are intentionally simple and modular (e.g. profile = name + birth date; loans = liability with balance + rate or repayment). Modules without DB tables (insurance, dependents, estate, documents) stay `not_started` until data models ship.

**Progress treatment:** Overall completion and the recommended next step share one compact summary panel, not separate hero cards; it should orient the user quickly while the module cards carry the checklist.

**Recommended next step:** Highest-priority incomplete module from `SETUP_RECOMMENDATION_PRIORITY` (configurable order in `modules.ts`). Rendered as a compact action strip so it nudges the next action without pushing module cards far down the page.

**Card destinations:** Modules that already have Financial setup editors link to `/setup?tab=…` so users stay in the same nav area. Planning workspace links are reserved for sections without a setup editor yet (for example protection modules) or for richer planning/roadmap workspaces. Financial modules should not point to **More**; More stays account/help/admin.

**Checklist hierarchy:** Module groups include short descriptions and completion counts. Four-card groups use a four-column desktop grid where space allows, reducing orphan rows and making the hub read like a grouped checklist rather than a long wall of cards. “Records & Readiness” covers risk profile and future document vault items.

**Auto-save / drafts:** Hub reads existing persisted data and timestamps; no change to form save behavior. `lastUpdatedAt` is derived from related `created_at` / `updated_at` fields — hooks ready for explicit draft columns later.

---

## Modular card architecture & progressive disclosure

**Direction:** move away from “one noisy page per micro-feature” toward **section-based composition** and **reusable surface components** (`InsightCard`, `RecommendationCard`, `PlaceholderModuleCard`, dashboard sections). **Level 1** is a simple summary; **Level 2** is the planning workspace; **Level 3** is advanced assumptions (often behind disclosure, e.g. collapsible income blocks on Cash Flow).

Shared numeric flows still come from **`src/data/dashboard.ts`**, **`src/domain/finance/**`, and existing repositories — new UI is largely **routing + composition**, not duplicate calculators.

**Debt planning philosophy:** a liability is modeled as both balance-sheet debt (net worth) and a **future cash-flow obligation**. Optional loan metadata drives repayment estimates (amortized, flat-rate, or manual/revolving), syncs **monthly budget lines** under “Debt Repayments”, and sets **end months** so long-term surplus projections reflect payoff (cash-flow relief). Educational copy in the debt UI explains structures without banking jargon.

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
| `/` | **Root splash** when signed out; **smart router** when signed in — client → `/dashboard` or `/onboarding` or `/account-issue`; advisor → `/advisor` (`src/app/page.tsx`, `resolveRootDestination`). |
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
| `/advisor/clients` | **Advisor** client roster: search, quick filters, sort, pagination, table with health signals and consent (`advisor_client_list_metrics` RPC when migrated). |
| `/advisor/opportunities` | **Advisor** placeholder hub for future product/opportunity workflows (`Coming Soon`). |
| `/advisor/activity` | **Advisor** placeholder cross-client activity feed (`Work in Progress`). |
| `/advisor/access-keys` | **Advisor** access key management (moved out of client Setup). |
| `/advisor/buy-keys` | **Advisor** coupon-backed access key purchase flow (`product_code = 0001`). |
| `/advisor/profile` | **Advisor** WhatsApp phone verification. |
| `/advisor/client/[id]` | **Advisor** client workspace: overview + **suggestion-mode** compose views for profile assumptions, retirement assumptions, goals, budget, investments, and gated sensitive categories; submit proposal; dashboard-month cashflow readouts (`AdvisorClientDetailShell`, `AdvisorClientOverview`, `AdvisorClientCompose`). |
| `/review/proposal/[id]` | **Client** full-page review of an advisor proposal: section-grouped before/after, advisor message, accept/reject (`ProposalReviewView`). |
| `/expenses` | **Activity / spending** hub: add/list expenses, charts, spend guidance (`(app)/expenses`). |
| `/spending` | **Alias**: server redirect to `/expenses`. |
| `/setup` | Redirects to the **Financial setup overview** (`/setup/overview`). Focused editors remain at `/setup?tab=profile`, `/setup?tab=housing`, etc. |
| `/balances` | Redirect → `/planning/wealth` (wealth workspace). |
| `/budget` | Redirect → `/planning/cash-flow` with month/year query (same budget UI). |
| `/financial-profile` | Redirect → `/setup?tab=profile`. |
| `/goals` | Redirect → `/planning/future` (goals live in Future workspace). |
| `/onboarding` | Post-auth wizard when profile requires onboarding (`OnboardingWizard`). |
| `/account-issue` | Shown when a **client** profile has no `advisor_user_id` (data integrity / support path). |

**API routes** (`src/app/api/`): `budget`, `dashboard`, `expenses`, `expenses/[id]`, `profile`, `projection` — JSON for client or integrations; keep in sync with page data needs.

---

## Onboarding philosophy

**Reduce friction, stay Singapore-friendly, reuse data everywhere.**

- **Gross-first income:** Step 1 asks for **gross monthly salary** (what users know from payslips), not take-home. The wizard shows a live **estimated take-home after employee CPF** using `monthlyEmployeeCpfTakeHomeSg` and a default age band (`below_55`) until birth date is captured in Setup.
- **Persistence:** PATCH `/api/profile` writes `monthly_gross_salary` + `cpf_age_band`; the API derives and stores `monthly_income` (take-home) so existing budget, dashboard, and projection code paths that read take-home keep working.
- **Legacy rows:** Users who onboarded before gross UX may only have `monthly_income` (take-home). The wizard does not prefill that value as gross; it shows a hint and preserves take-home on continue if gross is left blank. Mappers (`profileSalaryTakeHomeMonthly`) still fall back to stored take-home when gross + band are absent.
- **Bonus:** Preset **months of salary** (None → 4+) compute `annual_bonus` = gross × months; **Custom** stores a manual gross annual amount. Optional column `annual_bonus_months` records the preset multiplier (migration `20260520120000_onboarding_bonus_months.sql`).
- **Illustrated plan (not advisory):** Step 3 labels the draft **Illustrated monthly plan** with copy that everything is editable later — avoids “recommended” / advice framing while still seeding guided budget lines.
- **Onboarding → module sync:** No duplicate onboarding table. The same profile columns feed Setup Income (`monthly_gross_salary`, `annual_bonus`), Budget (`budgeting_strategy`, guided lines), Goals hints (`savings_target_monthly`), and debt commitments (`debt_obligations_monthly`). Later edits in those modules update the profile; see `src/features/onboarding/onboarding-module-sync.ts`.

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

**LoginForm** (`src/features/auth/LoginForm.tsx`): **Sign-in** loads `financial_profiles` and sends **advisors** to **`/advisor`**, **clients** to **`/onboarding`** or **`/dashboard`** (or **`/account-issue`** if `advisor_user_id` is missing). **Sign up**: email + password + display name + role; phone is **not** collected at signup (advisors verify their WhatsApp number opt-in via `/advisor/profile` later). Supabase **signUp** sets `emailRedirectTo` to **`/auth/callback`** (`src/app/auth/callback/route.ts`), which exchanges the one-time code for a session and redirects to `/dashboard` for middleware to finish routing by role. Required only when the Supabase project has **Confirm Email** enabled. **Sign out**: server action `signOutAction` → `/login` (also available from the account menu).

---

## App shell UX

**`src/features/app-shell/AppShell.tsx`**

- Header: brand link ( **`/dashboard`** for clients, **`/advisor`** for advisors ), subtitle (“Private wealth clarity” vs “Advisor workspace”), optional **main nav**, client **Contact advisor**, advisor phone prompt, **How it works** button, **account menu** (signed-in) or **Sign in**.
- **`AppShellNav`** (**client** only): **Home** → `/dashboard`; **Planning** → `/planning/overview` (active on `/planning/**`, `/setup/**`, `/balances`, `/budget`, `/financial-profile`, `/goals`); **Activity** → `/expenses` (active on `/expenses`, `/spending`); **More** → `/more` (active on `/more`, `/account-issue`). Split into **`AppShellMobileNav`** (hamburger + full-screen drawer) and **`AppShellDesktopNav`** (centered pill rail) so layout can differ by breakpoint without duplicating route logic.
- **`AppShellUserMenu`**: avatar + email, links to profile (`/setup?tab=profile`), **More**, **How it works** (methodology sheet), **Sign out**.
- Advisor navigation is rendered in a dedicated sidebar under `src/app/(app)/advisor/layout.tsx` using `AdvisorWorkspaceSidebar`, including Workspace, Clients, Opportunities, Activity, Access keys, and Buy keys.
- **Main app nav is shown only when** the user is signed in **and** the path does **not** start with `/onboarding`.

**`AppShellNav.tsx`**: Prefetches `/dashboard`, `/expenses`, `/planning/overview`, and `/more`.

### Mobile navigation & setup UX (2026-05)

**Why:** The client shell and **Financial setup** (`/setup`) were readable on desktop but felt like a compressed dashboard on phones — centered hamburger, heavy top padding, tabs that wrapped or cramped, and module cards pushing primary editors below the fold.

**Mobile header (< `sm`):** `[☰] BYOFA Planner` left-aligned with the account menu on the right; ~56px row height and reduced vertical padding. Desktop/tablet header is unchanged (brand + tagline, centered nav rail, account menu).

**Financial setup tabs:** `SetupTabsNav` uses a **horizontally scrollable pill rail** on mobile (hidden scrollbar via `.scrollbar-hide` in `globals.css`); desktop keeps the existing bordered rail. The rail now starts with **Overview**, so `/setup/overview` and `/setup?tab=…` read as one setup area rather than two unrelated pages. Sticky offset follows the shorter mobile header (`top-14`). Tab `?tab=` routing and server bundle loading are unchanged.

**Setup page hierarchy (< `sm`):** flex `order-*` — focused editor intro → **tabs** → **tab content**. The earlier roadmap/coming-soon cards were removed from the editor page to reduce setup clutter; planned modules remain represented on the overview hub.

**Scalability:** New setup tabs are config-only in `buildSetupTabs()`; the mobile rail scrolls without wrapping. Future planning modules can follow the same pill pattern in `SetupTabsNav` / `app-tab-styles.ts` without restructuring the page.

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
| Onboarding | `src/features/onboarding/` (`OnboardingWizard`, `BonusMonthSelector`, `onboarding-module-sync.ts`), `(app)/onboarding/page.tsx` — gross income + CPF preview → illustrated strategy/budget → finish; `src/domain/finance/onboarding-income.ts`; profile stores gross/derived take-home, `annual_bonus` / `annual_bonus_months`, lens fields, optional guided lines via `applyGuidedBudgetLinesAction` |
| Budget lens (Setup) | `src/features/setup/BudgetLensProfileForm.tsx` — edit lifestyle/strategy after onboarding (PATCH `/api/profile`) |
| Budget strategy & guided templates | `src/domain/finance/budget-guided-setup.ts` — lifestyle presets, 50/30/20-style splits, SG-oriented line generator, category→needs/wants/savings heuristics for visuals |
| Auth UI | `src/features/auth/` |
| Advisor workspace | `src/app/(app)/advisor/**`, `src/features/advisor/` (sidebar, `AdvisorClientDetailShell`, `AdvisorClientOverview`, `AdvisorClientCompose`, sensitive-category compose sections, suggestion banner + submit panel, `AdvisorClientsBoard`, forms), `src/features/proposals/ProposalReviewView.tsx`, `src/domain/advisor-proposals/` (sections, field registry, apply on accept), `src/data/repositories/advisor-proposals.ts`, `advisor-access-keys.ts`, `advisor-clients.ts`, `advisor-dashboard.ts`, `src/server/advisor-client-actions.ts` (records proposals, no direct client writes), `advisor-proposal-actions.ts`, `advisor-proposal-recording.ts`, `src/domain/finance/advisor-client-health.ts`, `src/lib/profile-role.ts` |
| Inbox | `src/features/inbox/`, `src/data/repositories/inbox-notifications.ts`, `src/server/inbox-actions.ts`, `src/server/inbox/ensure-salary-review-notification.ts` |
| Dashboard | `src/features/dashboard/`, `src/data/dashboard.ts` |
| Expenses / spending UI | `src/features/expenses/`, `src/features/spend/`, `src/data/repositories/expenses.ts`, spend recommendations data |
| Budget | `src/features/budget/` (`BudgetPlanningView`, `BudgetStrategyInsightPanel` for target vs line mix + placeholders), `src/data/repositories/budget-lines.ts`, overrides, `src/domain/finance/budget.ts` |
| Setup tabs | `src/features/setup/SetupTabsNav.tsx`, `src/lib/setup-urls.ts` (`setupBudgetPath` for classic `/setup` budget tab; `planningCashFlowBudgetPath` for `/planning/cash-flow`) |
| Goals / balances / loans / vehicles / CPF | `src/features/goals/`, related `src/data/repositories/*` |
| Debt planning UI + budget sync | `src/features/debts/`, `src/domain/finance/debt-repayment.ts`, `src/server/liability-form.ts` (loan tenure form parsing), `src/data/liability-budget-sync.ts` |
| Help / methodology | `src/features/help/`, `src/content/methodology-topics.ts`, `OpenMethodologyButton.tsx` |
| Pure finance logic | `src/domain/finance/` (projections, net worth, SG CPF/vehicle/housing helpers, **`cpf-retirement-projection.ts`** for RA-at-55 / FRS-BRS-ERS illustrations, tests alongside) |
| DB access patterns | `src/data/repositories/*.ts`, `src/data/mappers.ts`, `src/data/supabase/types.ts` |
| Server mutations | `src/server/actions.ts` (large file: forms call these; uses `revalidatePath` + `revalidateSetupAndPlanning` where setup/planning overlap) |

---

## Database

- **Migrations:** `supabase/migrations/` (evolved from early `profiles` / `expenses` / `investments` / `financial_goals` toward **`financial_*`** tables and richer profile/onboarding/budget/vehicle/housing/CPF fields).
- **Onboarding bonus months (`20260520120000_onboarding_bonus_months.sql`):** nullable `financial_profiles.annual_bonus_months` — months-of-salary multiplier from the wizard; `annual_bonus` remains the gross annual lump used in calculations.
- **Investment contribution phases (`20260516000000_investment_contribution_phases.sql`, `20260624000000_investment_plan_nature_and_start_date.sql`):** nullable `contribution_type` (`until_retirement` \| `fixed_duration`), `contribution_duration_years`, `contribution_start_date` / `contribution_end_date` (calendar premium window), `plan_nature` (`pure_investment` \| `includes_insurance_coverage`), and reserved `contribution_end_age` on **`financial_investments`**. Nulls keep legacy behavior (monthly deposits through the retirement horizon when birth + target age exist; otherwise the full chart horizon). Domain: `contributionMonthsLimit` + optional `contributionStartMonth`, portfolio helpers in `src/domain/finance/investment-portfolio-fv.ts`, UI on Setup → Investments with ILP placement guidance.
- **Investment variable contribution + withdrawal planning (`20260601010000_investment_variable_contribution_withdrawal.sql`):** **`financial_investments.contribution_growth_annual`** (annual step-up on monthly contribution), **`withdrawal_monthly`**, and optional **`withdrawal_start_years`**. Projection math preserves legacy closed-form behavior when these are zero, and switches to month-step cashflows when step-ups or withdrawals are set. Advisor proposals include the same fields.
- **Investment review reminders (`20260521120000_investment_review_reminder.sql`):** nullable **`financial_profiles.last_investment_review_at`**. When any investment row is stale (12+ months since `updated_at`), inbox `investment_review_due:{year}` + inline prompt on Setup/Wealth; saving or confirming assumptions clears the reminder.
- **CPF rules review reminders (`20260601000000_cpf_rules_review_reminder.sql`):** nullable **`financial_profiles.last_cpf_rules_review_at`** + **`last_cpf_rules_review_version`**. App-shell producer creates `cpf_rules_review_due:{version}:{year}` inbox rows when the profile has not acknowledged the current CPF rules baseline, plus annual Q4 review nudges; Setup/Wealth CPF panels include a confirmation CTA.
- **CPF Investments (`20260625000000_cpf_investments.sql`):** table **`financial_cpf_investments`** for multiple OA/SA entries (`account`, `purchase_month`, `premium_type`, `amount`, `projected_growth_annual`, `maturity_month`, optional `note`) with full owner RLS and advisor consent RPC. UI: Setup/Wealth → **CPF & CPF Investments**. Projection: active entries appear in CPFIS/notional line; future premiums reduce OA/SA; maturity proceeds flow back to OA/SA/RA per age-55 SA closure routing.
- **CPF balance as-of month (`20260626000000_cpf_balance_as_of_month.sql`):** nullable **`financial_cpf_balances.balance_as_of_month`** (`YYYY-MM`). New saves require it and default the form to the current month; when a row exists, Home treats entered OA/SA/MA as already updated through that month and projects from the following month. When no row exists, Home projects salary-driven CPF growth from a virtual $0 snapshot as of the selected dashboard month; current net worth still only includes saved CPF balances.
- **Cash account grouping + history (`20260601020000_cash_account_grouping_and_snapshots.sql`):** **`financial_cash_accounts.purpose`** (`emergency_fund` \| `everyday_spending` \| `short_term_savings` \| `other`), **`updated_at`**, and **`financial_cash_account_snapshots`** (balance recorded on create/save). UI: Setup / Wealth cash panels group by bucket and show per-account history.
- **Housing loan property planning (`20260516100000_housing_loan_property_planning.sql`):** nullable **`financial_housing_loans`** columns: `property_purchase_price`, `property_kind` (`hdb` \| `condo` \| `ec` \| `landed`), `downpayment_guidance_preset` (`pct_20` \| `pct_25` \| `custom`), optional `downpayment_guidance_custom_percent` / `downpayment_guidance_custom_amount`, snapshot `buyers_stamp_duty`, and `financing_includes_bsd` (default `false` for legacy rows). **CPF amortization still uses `principal` + rate + term**; new fields are affordability context. Domain: `singapore-residential-bsd.ts` (IRAS-style residential BSD tiers), `property-financing-plan.ts` (guided deposit + financing toggle), extended `deriveQuickHousingLoanRow` in `housing-loan-quick.ts`. UI: Setup → Housing **`HousingLoanQuickAddForm`** guided planner + list hints in **`HousingLoansPanel`**. **`createHousingLoanQuickAction`** accepts `guided_dp_preset` (omit + `deposit_total` for legacy quick-add); zod: `housingPropertyKindSchema`, `housingDownpaymentGuidancePresetSchema` in `src/lib/validation.ts`.
- **Housing BSD paid from CPF OA (`20260517000000_housing_loan_bsd_paid_from_cpf_oa.sql`):** boolean **`financial_housing_loans.buyers_stamp_duty_paid_from_cpf_oa`** (default `false`). When true, estimated BSD is treated as paid from CPF OA (feeds OA fee / projection paths); when false, BSD is cash. Ensures **`financing_includes_bsd`** exists if an older DB skipped the prior migration. **`financing_includes_bsd`** remains a legacy “BSD rolled into financed principal” flag; new saves prefer the OA-vs-cash BSD flag.
- **Housing instalment payment source (`20260519100000_housing_loan_payment_source.sql`):** **`payment_source`** (`cash` \| `cpf_oa` \| `split`), optional **`cpf_oa_payment`** / **`cash_payment`** (split only). **Cash flow vs CPF flow:** cash portions add a synthetic “Housing loan (cash portion)” line to monthly spend / safe-to-spend / by-age surplus (`buildSyntheticHousingCashExpense`); CPF OA portions reduce OA only in **`buildCpfMonthlyProjectionSeries`**. **`oa_share_of_payment`** is kept in sync on save for backward compatibility. **Legacy:** null `payment_source` → treat instalments as **cash** in budgeting; CPF projection still reads **`oa_share_of_payment`** (unchanged). **Singapore-specific:** models common HDB/bank patterns (full OA, full cash, 50/50 or custom split). **Future:** OA monthly caps vs law, spouse OA, step-up after keys, refinances, and tighter coupling to CPF LIFE / RA flows.
- **Asset-first housing (`20260519120000_financial_properties_asset_first.sql`):** table **`financial_properties`** (name, type, purchase/valuation, ownership %, status, rental income, **`planning_scope`** `current` \| `future_simulation`). Mortgages stay on **`financial_housing_loans`** with nullable **`property_id`** (ON DELETE CASCADE). Backfill creates **Property 1…n** from legacy loans. Domain: `src/domain/housing/` (`composeHousingPropertyViews`, linked debt types). UI: **`HousingPanel`** + **`PropertyAddForm`**; tab label **Housing** (not “Housing loans”). **Goals prep:** `future_simulation` rows do not feed dashboard cashflow until a simulator ships.
- **HDB housing payment events (`20260623000000_hdb_housing_payment_events.sql`):** adds **`financial_properties.purchase_year`** and HDB MVP property types (`bto`, `resale_hdb`, planned EC/condo/landed values). Adds explicit **`financial_housing_loans`** upfront-event columns: first downpayment, BSD/legal, and second downpayment total / paid month / CPF OA / cash. `housingLoanToProjection` passes these as dated OA outflows into `buildCpfMonthlyProjectionSeries`; legacy rows without event columns still use the old completion-month aggregate (`downpayment_from_oa + fees_from_oa`). `singapore-residential-bsd.ts` now picks pre-2018, 2018–early-2023, or current residential BSD tiers from purchase year.
- **Types:** `src/data/supabase/types.ts` should reflect the schema your app expects; regenerate or edit when migrations add columns.
- **Advisor / client (POC):** `financial_profiles.profile_type` (`advisor` \| `client`), optional `advisor_user_id` → `auth.users` for clients, plus advisor `phone_e164` / `phone_verified_at`. **`handle_new_user`** inserts **advisors** with `onboarding_required = false` and **`onboarding_step` null** (no client wizard); **clients** get `onboarding_required = true`, `onboarding_step = 1`, and `advisor_user_id` from the claimed key. Migration **`20260512000001_advisor_skip_onboarding.sql`** also sets `onboarding_required = false` and clears `onboarding_step` for **existing** advisor rows. Table **`advisor_access_keys`**: unique `access_key`, optional `purchase_id`, `status` (`available` \| `claimed` \| `expired`), `claimed_by_user_id`, optional `expires_at`, timestamps. **`handle_new_user`** reads `raw_user_meta_data.profile_type` and `access_key` for clients, claims the key in the same transaction, and sets the profile row. **`validate_client_access_key_for_signup`** (RPC, `SECURITY DEFINER`) is executable by `anon` for pre-checks only. RLS: on **`advisor_access_keys`**, advisors **select/insert/update** only rows where `advisor_user_id = auth.uid()`. On **`financial_profiles`**, **`financial_profiles_select_advisor_clients`** lets advisors **read** linked client rows (`profile_type = client` and `advisor_user_id = auth.uid()`). Migration **`20260513000000_advisor_linked_client_rls.sql`**: index on `(advisor_user_id)` for client rows; **`financial_profiles_update_advisor_linked_clients`** so advisors can **update** linked client profile rows while **`WITH CHECK`** keeps `profile_type` and `advisor_user_id` stable; parallel **`_select/_insert/_update/_delete_advisor_clients`** policies on financial tables via the same link rule. RPCs **`advisor_client_list_metrics`** and **`advisor_client_list_count`** power scalable client lists. Advisors still cannot read other advisors’ clients.
- **Advisor purchases and verified contact:** advisor key purchase uses **`pricing`** (`product_code = 0001`, SGD), **`coupons`** (POC seed `POCUNLIMITED`), **`purchases`**, and **`coupon_redemptions`** through security-definer RPCs. Clients contact advisors only through **`get_my_advisor_contact()`**, which returns a derived WhatsApp URL after advisor phone verification.
- **Invited client `profile_type` repair (`20260514000000_invited_client_profile_type_repair.sql`):** updates rows that are still `financial_profiles.profile_type = 'advisor'` but have a **claimed** `advisor_access_keys` row with `claimed_by_user_id = financial_profiles.id` — sets them to **`client`** and restores client onboarding fields when onboarding is not completed. Replaces **`handle_new_user`** so any **non-empty `access_key`** in signup metadata always runs the **client** insert path (claim key + `profile_type = 'client'`), even if `profile_type` in metadata says `advisor`, preventing invitees from being stored as advisors.
- **Client `advisor_user_id` sync (`20260515000000_sync_client_advisor_user_from_claimed_key.sql`):** for `profile_type = 'client'` rows with a **claimed** access key on `claimed_by_user_id`, sets `financial_profiles.advisor_user_id` to match `advisor_access_keys.advisor_user_id` when they differ — fixes advisor dashboard / client list showing **0 clients** while **keys claimed** is positive (roster and RLS filter on `financial_profiles.advisor_user_id`, not the keys table alone).
- **Role helpers:** `src/lib/profile-role.ts` — `getCurrentUserRole`, `isAdvisor`, `isClient`, `normalizeFinancialProfileType`, `clientAdvisorRelationshipOk` (keep role checks centralized).
- **Financial inbox (`20260519000000_financial_inbox_notifications.sql`):** dedupe-keyed rows per user (`kind`, `title`, `body`, CTA). Producers include salary-review layout gate and **`submit_advisor_proposal`** RPC (advisor proposal submitted → client notification with **`/review/proposal/{id}`**).
- **Advisor proposals (`20260524000000_advisor_proposals.sql`; extended by `20260601`–`20260606`, applied on prod verified 2026-05-23):** **`advisor_proposals`** (`draft` \| `pending` \| `accepting` \| `accepted` \| `rejected` \| `withdrawn`), **`advisor_proposal_changes`** (field-level `old_value` / `new_value`, `section`, `entity_type`, optional `entity_id`, plus `change_op` create\|update\|delete, `draft_entity_key`, `base_version`), **`advisor_proposal_section_notes`**. **`20260601`**: RLS INSERT regression fix (self-only `with check`) + SECURITY DEFINER `create_advisor_draft_proposal` (linkage asserted in-fn) + open-index relaxed to **draft-only** (≤1 draft, unlimited concurrent pending). **`20260602`**: change-ops columns + two partial unique indexes (entity-keyed / draft-key-keyed). **`20260603`**: `updated_at` + BEFORE-UPDATE triggers on `financial_profiles`/`financial_budget_lines`/`financial_goals` (optimistic-concurrency token). **`20260604`**: SECURITY DEFINER `withdraw_advisor_proposal` (row-locked, idempotent, deletes client inbox CTA) + `notify_advisor_proposal_conflict` (client-callable advisor re-baseline alert). **`20260605`**: SECURITY DEFINER `claim_advisor_proposal_for_accept` (FOR UPDATE `pending`→`accepting`, **gates the entity writes** — serialized vs `withdraw_advisor_proposal`) + `finalize_advisor_proposal_accept` (`accepting`→`accepted`, fail-loud 0-row) + `accepting` status + M3 (create-RPC `IF NOT FOUND RAISE`) + M4 (`CHECK change_op='create' ⇒ draft_entity_key NOT NULL`). RLS: advisor CRUD on drafts; client read + resolve pending. Accept path (`src/domain/advisor-proposals/apply-changes.ts`): `base_version` conflict pre-flight (read-only, pre-claim — benign conflict leaves it `pending`) → claim → TS writes via the single shared overlay mapper (`apply-overlay.ts`, C6 — never relocated to SQL) → finalize. A post-claim mid-write failure parks the proposal terminally in `accepting` (non-re-acceptable; advisor rebuilds — partial canonical mutation possible, accepted C6-constrained tradeoff).
- **Consent gate (`20260528000000` Phase 1 + `20260529000000` Phase 2):** advisor→client reads no longer use direct cross-user RLS — all legacy `*_advisor_clients` `financial_*` policies are **dropped** and replaced by SECURITY DEFINER **`advisor_read_*`** RPCs (the 11 surfaces + roster `advisor_client_list_metrics`/`_count` + consent-independent `advisor_linked_client`), each gated by **`advisor_can_read_client`**. Append-only **`advisor_client_consents`** ledger (`granted` \| `withdrawn`, `consent_version`, `purpose`, verbatim `consent_text`, `created_at`, `seq bigint generated always as identity`); latest-event-wins by `(created_at desc, seq desc)`. Client writes via `recordAdvisorConsentAction` (client-only, server-assigned linkage/`created_at`/`seq`). Ship-gate audit **`verify_consent_gated_access()`** (RLS-enabled + no-bypass + no-mis-scope) — RAISEs on regression; `OK` verified on prod. Idempotent / hand-applied (no migration ledger).

- **Per-category advisor visibility (`20260624000000_advisor_consent_category_visibility.sql`):** client-owned bridge table **`advisor_consent_category_visibility`** (unique `(client_user_id, advisor_user_id, visibility_category)`; 4 RLS policies `TO authenticated`, owner predicate `client_user_id = (select auth.uid())`, `WITH CHECK` on insert/update) + SECURITY DEFINER **`advisor_can_read_category(p_client, p_category)`** (`search_path=''`, **default-deny** `coalesce(..., false)`; master consent `advisor_can_read_client` **AND** the client's per-category opt-in). The 5 sensitive advisor-read RPCs (`advisor_read_cash_accounts`/`_liabilities`/`_properties`/`_housing_loans`/`_vehicles`) redefined to gate on the per-category predicate; the 4 always-visible categories (profile/goals/budget/investments) keep the bare master gate. Client toggles default **PRIVATE**. _(Applied to prod + read-back verified 2026-05-24. Rollback sidecar `…category_visibility.rollback.sql`.)_
- **Proposal entity-type expansion + visibility-flags read (`20260625000000_proposal_entity_types_and_visibility_read.sql`):** **`advisor_proposal_changes.entity_type`** CHECK widened from 4 → **9** (`+ cash_account, liability, property, housing_loan, vehicle`); SECURITY DEFINER **`advisor_read_category_visibility(p_client)`** returns the 5 category flags (master-consent-gated, missing ⇒ `false`) so the advisor compose UI renders a **locked "Private" card** without fetching data. The accept writer handles **all 9 entity types** (Phases 2–6 complete) and still **rejects** any unknown `entity_type` defensively (`assertHandledEntityTypes`). _(Applied to prod + read-back verified 2026-05-24. Rollback sidecar `…visibility_read.rollback.sql`.)_
- **Housing-loan ↔ property same-user composite FK (`20260626000000_housing_loan_property_composite_fk.sql`):** defense-in-depth behind the app-layer `property_id` remap guard. **Replaces** the legacy single-column FK `financial_housing_loans_property_id_fkey` (→ `financial_properties(id)` ON DELETE CASCADE) with a **composite** `financial_housing_loans (user_id, property_id) → financial_properties (user_id, id)` (same ON DELETE CASCADE), after adding the prerequisite `unique (user_id, id)` on `financial_properties`. A loan can now only link to a property owned by the **same user** — cross-client linkage is impossible at the DB even if app logic regresses. A `DO`-block guard aborts the migration if any pre-existing row links cross-user (**0 on prod**). `NULL property_id` stays valid (MATCH SIMPLE — composite FK unenforced when a referencing column is NULL ⇒ unlinked/generic loans unaffected). Additive-to-existing-tables, no column changes ⇒ types.ts unaffected. _(Applied to prod + read-back verified 2026-05-24 — composite FK + unique present, legacy single-col FK replaced. Rollback sidecar `…composite_fk.rollback.sql`.)_

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
5. Reconcile the **[BYOFA Feature Roadmap](https://app.clickup.com/90182722727/v/l/6-901818233981-1)** in ClickUp from this inventory — Cursor rule `.cursor/rules/project-context-clickup-sync.mdc`, or ask the agent to **sync BYOFA** / **sync ClickUp from PROJECT_CONTEXT**.

### Housing architecture (asset / debt / goals)

- **Current ownership (shipped):** `financial_properties` + optional linked row on `financial_housing_loans`. User flow: Setup → **Housing** → **Add HDB home** (option fee, BSD, legal fees, downpayments — each with date + CPF/cash split; HDB or bank loan). Cash & Debts still holds generic liabilities; housing mortgages are not duplicated there.
- **Linked asset/debt model:** `HousingMortgageDebt` in `src/domain/housing/types.ts` (`linkedAssetId` → property). Same pattern reserved for vehicle ↔ car loan and property ↔ renovation loan later.
- **Projections / CPF:** amortizes **`financial_housing_loans`** via `housingLoanToProjection` in `src/data/dashboard.ts`; explicit HDB upfront OA event dates are deducted in their paid months, falling back to legacy completion-month lumping for older rows.
- **Future property planning (not shipped):** Goals → property purchase simulation uses `planning_scope = future_simulation` on `financial_properties` (or a dedicated goals table later). Does **not** affect live cashflow until explicitly simulated.

### CPF retirement modelling (direction)

- **Shipped:** Home → Retirement **`CpfRetirementProjectionPanel`** — projected FRS/BRS/ERS, age-55 RA transfer flow (SA first, then OA), CPF Investments maturity routing after SA closure (RA top-up first, excess to OA), educational scenarios, collapsible assumptions (growth %, target sum, CPF LIFE payout %). Uses projected OA/SA at 55 from the existing monthly CPF path when Setup balances exist.
- **Not in scope:** live CPF APIs, actuarial CPF LIFE, exhaustive withdrawal rules.
- **Future:** persist advisor/client assumption presets; tie RA balance into retirement sustainability / spend coverage; inflation on payouts.

_Last reviewed (2026-06-15): **Housing planning form aligned to BTO upfront flow** — Add HDB home now splits option fee, BSD, and legal fees into separate editable payment events with per-event paid months for CPF OA timing; HDB loan defaults to 2.6% with optional bank rate entry; migration `20260628000000_housing_option_fee_bsd_legal_split.sql`. Prior same day: **Onboarding shortened to three UI steps** — removed lifestyle/food-band picker from the wizard (defaults apply; Budget lens in Setup still edits `lifestyle_profile` / `food_spend_band`). Stored `onboarding_step` keeps legacy numbering (1 → 3 → 4) with mapping helpers in `onboarding-profile-hints.ts`. Prior (2026-06-12): **Dashboard dark theme contrast sweep completed** — Home dashboard hero metrics, month insights, CPF projection panels, CPF retirement education cards, retirement summary cards, and chart containers now carry explicit dark surfaces and readable text states instead of relying on light-era card colors. Prior (2026-06-11): **Dark theme contrast coverage extended across primary client workflows** — Goals, Planning, Activity, More, Setup, Budget, and Wealth setup panels now carry explicit dark variants for main cards, prompts, roadmap previews, tab rails, budget quick-add rows, custom expense forms, trade-off panels, and setup forms, reducing reliance on the compatibility bridge for user-facing surfaces. Prior (2026-06-09): **Light / dark / system theme is now app-shell level with stronger dark contrast** — root theme bootstrapping, persisted mode selection, system preference sync, and shared dark tokens give the app a no-flash dark theme with a header/account-menu control; the compatibility bridge now also overrides light-era utility surfaces, status panels, borders, text colors, and gradient stops, and the budget hero/review/guidance/monthly-category panels have explicit dark surfaces so dark-mode text remains legible across the main Budget workflow. Prior same day: **Budget cash flow now treats Setup Investments as source of truth** — Cash Flow replaces manual budget rows named “Investments” with a read-only monthly Investments row from active setup investment contributions, renames the hero metric to **Free Cash Flow**, and links positive free cash flow to Setup → Investments. Prior (2026-06-08): **Client-safe save error handling is centralized** — user-facing setup and advisor compose actions now route caught operational database errors through `src/lib/client-error.ts`, hiding Supabase/PostgREST schema-cache and constraint details while preserving known-safe domain validation messages; housing mortgage insert fallback uses the same schema-error detector. Prior (2026-06-04): **Advisor compose default-visible fields are fully editable** — `view=compose` now exposes proposal controls for profile income, salary growth, retirement assumptions, existing goal name / target / monthly contribution, and existing monthly budget category / amount; investment editing remains full-scope, submitted pending proposals no longer lock a separate draft, and cash / liabilities / vehicles / property / housing loans stay client category-gated. Prior same day: **CPF projections now default missing balance rows to a virtual zero snapshot** — Home no longer blocks salary-driven CPF growth when `financial_cpf_balances` has no row; forward projections start from $0 as of the selected dashboard month, the status panel says so, and current net worth still only includes saved CPF balances. Prior (2026-06-03): **Retirement runway Breakdowns pane now separates Planned expenses from Source, uses collapsible cards, and scrolls with chart-height parity** — the pane shows planned-expense components in the first card, financing / shortfall sources in a separate Source card, net-worth component rows without the ambiguous fundable-assets line, derives CPF total from CPF buckets when needed, uses default-expanded collapsible cards, matches chart height on wide layouts, stacks on narrow containers, and scrolls internally on overflow. Prior same day: **CPF employment contributions now stop at modeled retirement in Home projections** — CPF salary and bonus inflows stop at the same modeled retirement month as employment income, while CPF interest, housing OA deductions, CPFIS, RA routing, and CPF LIFE continue. Prior same day: **Property net equity wired into Home net worth + runway chart** — dashboard net worth now includes current owned property value after ownership share, minus linked mortgage balances; retirement runway net-worth snapshots populate `propertyNet` instead of zero, so hover/Breakdowns property components match the headline. Prior (2026-06-02): **Retirement runway hover + stack semantics tightened** — Home's retirement chart now treats take-home as annualized ledger income but displays only the portion used to fund that year's required outflow, removes the separate Budget categories mode, and exposes contextual hover/Breakdowns detail for funding subcomponents, expense components, net-worth components, and CPF buckets. Cash reserve bars now represent actual cash balance spend-down between age samples, preventing recycled monthly passive income after cash depletion from appearing as annual reserve funding. Prior same day: **Retirement runway chart semantics corrected** — Home's retirement section now renders financing-component stacked bars (required outflows financed by take-home / passive income / investment income / drawdowns / cash reserves / shortfall), annualizes truncated sample years for chart-facing flows, and adds a default-off **Use cash reserves** chart scenario. Milestones now render below the chart; the side pane is renamed **Breakdowns**, defaults collapsed, and exposes selected-age financing plus optional budget-category detail without generic pre/post-retirement expense labels. The projection ledger now records structured outflow components and `cashReserveDrawdown`; pre-retirement deficits use take-home/cash before shortfall, while post-retirement deficits use investments, matured ILP, then optional cash reserves before GoalsGap. Prior same day: `RetirementRunwayLedgerChart` shipped, replacing the removed `AgeCombinedAssetsProjectionChart`; the ledger gained `employmentInflow`, phase-aware annual flow aggregation, component income rates, yearly withdrawals, ILP maturity gating, principal drawdowns, and GoalsGap source breakdowns. Prior (2026-06-01): Retirement projection data layer now exposes a time-aware cash-flow ledger on age rows without changing chart components. Prior (2026-05-26): Root `/` branded splash for signed-out visitors and smart role/onboarding router when signed in; auth callback default `next` is `/`; advisor client roster quick filters on `/advisor/clients`. Prior (2026-05-24): **Consent prompt UX + Financial setup navigation cleanup** — compact persistent shell strip (independent of inbox read) + account-menu row; inbox mark-read only dismisses the notification. Bare `/setup` now lands on the overview hub, the shared setup rail includes Overview, focused editor pages show clear section context/back-to-overview affordance, roadmap cards were removed from editor pages, progress + recommended next step are combined into one compact summary panel, setup-backed hub cards stay inside `/setup?tab=…`, Documents points to the Future planning roadmap rather than More, and setup checklist groups include descriptions/counts with denser desktop grids. Prior same day: **Advisor propose-CRUD Phases 2–6 COMPLETE — all 9 entity types** — advisor can propose create/update/delete on profile, budget lines, goals, investments, cash accounts, liabilities, vehicles, properties, and housing loans; Phase 6 ships housing-loan propose-CRUD with `property_id` remap (draft-key→real-id via `propertyIdMap`, checked against `validPropertyIds`) backed by migration `20260626000000`; `20260624000000`/`20260625000000` add per-category visibility gates and 9 proposal entity types._
