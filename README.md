# Finance Planner — business requirements

This document states **what the product must do** for users. It is the place to add or update requirements when scope changes. It intentionally avoids implementation (stack, APIs, database).

---

## Purpose

Give a **single private workspace** where an individual can see **financial position**, **monthly cash behaviour**, and **simple forward-looking illustrations** (including retirement-style checks), so they can plan with **clarity**—not as a substitute for professional advice.

---

## Principles

- **Private**: Each user’s data belongs to them; no multi-tenant “advisor view” is required unless specified later.
- **Transparent**: Users can understand **how numbers are derived** via in-product explanations (“How it works”).
- **Illustrative**: Projections and checks are **educational simplifications**, not tax, legal, or investment recommendations.

---

## Functional requirements

### Identity and session

- Users can **sign in** to access their workspace and **sign out** when finished.
- New sign-up remains lightweight (email, password, optional display name).
- New users are guided through a **post-login onboarding wizard** with optional/skip steps and resumable progress.
- Unauthenticated visitors are guided to sign in where personal data is required.

### Profile and income

- Users can record **income and related planning inputs** (e.g. take-home, currency, retirement age, growth/dividend/withdrawal assumptions) in a single **Financial Profile** source of truth.
- Shared assumptions are edited centrally in **Financial Profile** instead of being duplicated across multiple modules.
- Where supported, users can record **Singapore CPF-related inputs** used by planning views.

### Dashboard

- Users see an **overview** of position for a **selected period**, including **net worth** and **savings rate** where data allows.
- Users see **illustrative projections** (e.g. **net worth by age**, optional **CPF** and **combined asset** views) based on saved balances, contributions, and stated assumptions.
- Users can compare **optional retirement spend goals** to simplified checks (e.g. **dividend income lens**, **withdrawal-rate style lens**).
- Users can move between **months** where the dashboard depends on period context.
- When profile data is incomplete, dashboard should show non-blocking prompts/empty states instead of failing.

### Expenses

- Users can **add, edit, and review** expenses with **amount, category, date, and notes**.
- Users can see **spending by category** for a period.
- Expense behaviour aligns with **budget categories** where the product defines shared rules (e.g. quick entry from a budget category).

### Budget

- Users can define **budget lines** (category, planned amounts, applicability / schedule).
- Users can set **per-month overrides** for planned amounts.
- Users can see **planned versus actual** style views using expenses and budget rules.
- Users receive **spend guidance** tied to the same month and planning context.

### Balances

- Users maintain **investment** positions (balance, ongoing contributions, stated expected return).
- Users maintain **cash** and **liabilities**.
- Users can record **CPF balances** for planning.
- Users can record **housing loans** relevant to projections.
- Users can record **vehicles** with **Singapore-specific** lifecycle assumptions where the product supports them (e.g. COE, loans, recovery).

### Goals

- Users define **financial goals** with **target amount**, optional **target date**, **monthly contribution**, and **expected return**.
- Users see **progress** and **estimated time to target**; where a deadline exists, the product can surface **deadline gap** insight.
- A goal may **reference an investment** for context when useful.

### Help

- Users can open **methodology** content that explains, in plain language, how major numbers are calculated and what is **not** modeled.

---

## Out of scope (unless added later)

- Automated bank or broker **feeds**.
- **Multi-user** households with shared editing and permissions.
- **Tax filing**, **optimization**, or **regulated advisory** outputs.

---

## Compliance posture (product)

All numeric outputs are **illustrations** for personal organization and learning. The product must **not** present itself as professional financial, tax, or legal advice; in-product copy should reinforce limitations.

---

## Maintaining this document

When you approve a **new requirement** or **change in behaviour**, update the relevant subsection under **Functional requirements** (or **Out of scope**) so this file remains the agreed business spec.
