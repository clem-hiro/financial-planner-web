---
name: "source-command-sync-features-clickup"
description: "Sync new git activity into the BYOFA ClickUp Feature Roadmap list. Proposes status/description/custom-field updates per feature task; applies on user confirm. Invoke via /sync-features-clickup."
---

# source-command-sync-features-clickup

Use this skill when the user asks to run `/sync-features-clickup`.

Follow **`.claude/commands/sync-features-clickup.md`** — that file is the source of truth.

Quick reference:

- State: `.claude/clickup-sync.json`
- List: `901818233981` (Feature Roadmap) — https://app.clickup.com/90182722727/v/l/6-901818233981-1
- MCP: `user-clickup`
- Status: `done` | `in progress` | `not started`
- Custom fields: **What it does**, **Area**, **User Type**, **Priority**, **Next step**
- Inventory alignment: `.cursor/rules/project-context-clickup-sync.mdc`
- Manual-only ClickUp statuses (never auto-set): `READY TO TEST`, `TO BE DISCUSSED`, `TESTED BY DARREN`. Automation may set `DONE` when inventory is Shipped.
