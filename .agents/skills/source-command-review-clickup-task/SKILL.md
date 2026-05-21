---
name: "source-command-review-clickup-task"
description: "Ship-readiness and UAT handover for one BYOFA ClickUp task: verify code, implement gaps, tester summary, update ClickUp descriptions. Invoke via /review-clickup-task with a task URL."
---

# source-command-review-clickup-task

Use when the user runs **`/review-clickup-task`** or shares a **ClickUp task URL** for feature review, UAT handover, or “check if this is implemented.”

**Source of truth:** `.claude/commands/review-clickup-task.md`

Quick reference:

- MCP: `user-clickup`
- List: Feature Roadmap `901818233981` — https://app.clickup.com/90182722727/v/l/6-901818233981-1
- ClickUp IDs / field mapping: `.cursor/rules/project-context-clickup-sync.mdc`
- Inventory: `PROJECT_CONTEXT.md`
- Manual-only statuses: `READY TO TEST`, `TO BE DISCUSSED`, `TESTED BY DARREN`
- **Every sub-task:** chat verdict (§4 C) + `clickup_update_task` description (§4 D), including **Not in repo** — never skip because unimplemented. Parent may stay **Shipped**; roll sub-task verdicts up in parent description.
