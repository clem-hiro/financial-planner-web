---
description: Ship-readiness and UAT handover review for one BYOFA ClickUp feature task. Verifies implementation, closes gaps, summarizes for testers, updates ClickUp descriptions. Invoke via /review-clickup-task with a task URL.
---

# Review ClickUp feature task (UAT handover)

The user provides a **ClickUp task URL or task ID** in the same message. If missing, ask for it before proceeding.

**MCP server:** `user-clickup` (`clickup_get_task`, `clickup_update_task`, sub-tasks on parent payload).

**BYOFA field IDs and list mapping:** read `.cursor/rules/project-context-clickup-sync.mdc` only when updating ClickUp (do not duplicate IDs here).

**Repo truth for shipped vs planned:** `PROJECT_CONTEXT.md` feature inventory.

---

## 1. Read ClickUp

- Fetch the **parent task** (description, status, custom fields, sub-tasks).
- Fetch each **sub-task** if not fully detailed on the parent.
- Map task name → `PROJECT_CONTEXT.md` row and code paths (`rg`, function tree under `docs/function-tree/` if needed).

## 2. Engineering verification

- Confirm end-to-end implementation (UI → server/data → domain; tests if present).
- Compare task **gaps / next steps** to the codebase.
- **Implement** missing gaps (minimal diff; existing conventions; consult `AGENTS.md` skills when touching migrations, actions, `src/app/`, etc.).
- Run **relevant unit tests**; report pass/fail briefly.
- State deliberate limitations (illustrative models, not advice, partial scope).

## 3. Sub-tasks

For **each sub-task** (especially `Open` / `in progress`):

- Verify or implement; infer intent from title + parent if description is empty.
- Produce **separate** engineering verdict + business UAT summary (see §4).

## 4. Chat deliverables

### A. Parent — engineering verdict

- Status: Shipped / Partial / Not in repo
- Verified vs changed in this session
- Test results (one line)

### B. Parent — business summary (for testers)

Plain language:

- What we built; who it’s for
- How to use it (numbered steps)
- What it is **not**
- Known limitations; Setup prerequisites

### C. Sub-tasks

Repeat **A + B** per sub-task (clear headings with task name + link).

### D. ClickUp sync (default **on**; skip only if user says “skip ClickUp”)

Update **description** on parent + every sub-task via `clickup_update_task`. Preserve or refine original “What it does” / examples, then add:

```
---
Implementation log

Initial ship — DD MMM YYYY
• …

Gap closure / enhancement — DD MMM YYYY  (use today for work in this session)
• …

Gaps from roadmap — status
✅ … (date)  /  ⏳ …

Current app behaviour
…

How to test (UAT)
1. …

Key files
• `src/…`

Next step for QA
…
```

**Dates:** prefer task `date_created` for initial ship; git log on key files if unclear; session date for new work.

**Custom fields** (optional, when materially changed): **What it does**, **Next step** — see `.cursor/rules/project-context-clickup-sync.mdc`.

**Never auto-set** ClickUp statuses: `READY TO TEST`, `TO BE DISCUSSED`, `TESTED BY DARREN`. Do not set `DONE` unless user asks and inventory is Shipped.

### E. PROJECT_CONTEXT

Update `PROJECT_CONTEXT.md` only if user-facing shipped scope changed (per `.cursor/rules/update-project-context-on-ship.mdc`). Skip for refactors/tests-only.

---

## 5. Constraints

- No git commit/push unless asked.
- Ask before changing ClickUp **status**.
- Code citations and paths over vague claims; call out uncertainty.

## 6. Do not

- Run `/sync-features-clickup` unless the user asks for git→roadmap sync.
- Replace the whole description with only a test string when probing MCP.
