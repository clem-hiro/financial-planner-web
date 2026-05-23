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
- **Implement** missing scope in the same session when the task or sub-task is **Not in repo** or **Partial** — including **Open sub-tasks under a Shipped parent**. Do not stop at documentation because the parent is done.
- **Implement** missing gaps (minimal diff; existing conventions; consult `AGENTS.md` skills when touching migrations, actions, `src/app/`, etc.).
- Ask the user before building only when scope is ambiguous, needs a product call (taxonomy, compliance), or is clearly out of MVP (e.g. bank feed syncing).
- Run **relevant unit tests**; report pass/fail briefly.
- State deliberate limitations (illustrative models, not advice, partial scope).

## 3. Sub-tasks

For **every** sub-task on the parent (fetch full detail if the parent payload is thin), regardless of ClickUp status:

- Verify or implement; infer intent from title + parent if description is empty.
- Assign an engineering verdict: **Shipped** / **Partial** / **Not in repo** (same labels as the parent).
- Produce **separate** engineering verdict + business UAT summary in chat (§4 C) — **never skip** a sub-task because it is unimplemented.
- If **Not in repo** or **Partial**: **implement** first (§2), then **always** call `clickup_update_task` on the sub-task with the post-implementation verdict. Only leave **Not in repo** without code when the user asked to skip implementation or scope needs a product decision.
- **Always** call `clickup_update_task` on each sub-task description (§4 D) after verification or implementation.

**Parent vs sub-task scope:** A parent may be **Shipped** while sub-tasks remain **Not in repo**. Do not mark the parent as incomplete solely because a sub-task is backlog; roll sub-task status up in the parent Implementation log (see §4 D).

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

Repeat **A + B** per sub-task (clear headings with task name + link). Lead with the verdict line, e.g. `**Status: Not in repo**` when applicable, so skimmers see implementation state immediately.

### D. ClickUp sync (default **on**; skip only if user says “skip ClickUp”)

Update **description** on parent + **every** sub-task via `clickup_update_task` (mandatory when ClickUp sync is on — including **Not in repo** sub-tasks). Preserve or refine original “What it does” / examples, then add:

```
---
Implementation log

Engineering verdict (review DD MMM YYYY): Shipped | Partial | Not in repo

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

**Sub-tasks (Not in repo):** set `Engineering verdict` to **Not in repo**; `Initial ship` may be `n/a`; `Gap closure` documents the code review; `How to test (UAT)` is `N/A until shipped` with a pointer to parent UAT; `Next step for QA` is product/backlog (not tester execution).

**Parent rollup:** when sub-tasks exist, add a **Sub-tasks** subsection under `Gaps from roadmap — status` listing each sub-task by name + link + verdict (✅ Shipped / ⏳ Not in repo / ⏳ Partial).

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
