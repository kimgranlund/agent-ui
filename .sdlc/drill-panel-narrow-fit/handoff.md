---
id: T-0186
title: "ui-drill-panel fits the 400px column on the drill demo"
type: chore           # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The drill demo's ui-drill-panel fits the 400px content column, so `demo/drill-demo#column` leaves scripts/dogfood-render-allowlist.json.

## Intent
- Do: Make the panel fit (or scroll in its own frame) at 400px; delete the allowlist line.
- Non-goals: other allowlist entries.
- Done when: render lint `demo/drill-demo` green in chromium and webkit with no allowlist entry; screenshot viewed.

## Context
Filed by T-0170 (lint allowlist owners, 2026-10-14), which repointed the allowlist reason to this ticket.

## Constraints
Never add an allowlist entry without an owner (T-0170 format check). No em dashes.
