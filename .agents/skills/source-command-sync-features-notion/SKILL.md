---
name: "source-command-sync-features-notion"
description: "Sync new git activity into the BYOFA Features Notion tracker. Proposes Status/What it does/Next step updates per Feature row; applies on user confirm. Invoke via /sync-features-notion."
---

# source-command-sync-features-notion

Use this skill when the user asks to run `/sync-features-notion`.

Follow **`.claude/commands/sync-features-notion.md`** — that file is the source of truth.

Quick reference:

- State: `.claude/notion-sync.json`
- Notion: Feature Roadmap Table `collection://363a6941-47bf-81d1-9580-000baf6b7dd3`
- Properties: **`Status`** (`Done` | `Partial` | `Planned` | `Missing`), **`What it does`**, **`Next step`** — not BYOFA icons
- Inventory alignment: `.cursor/rules/project-context-notion-sync.mdc`
