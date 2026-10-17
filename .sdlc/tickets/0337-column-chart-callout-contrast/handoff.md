---
id: T-0337
title: "Column-chart highlight callout ink meets 4.5:1 on its pill in dark mode (chip-opaque debt)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0337-callout-contrast
worktree: ../agent-ui.worktrees/wave-w337
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The column chart's highlight callout text reaches 4.5:1 on its primary pill in dark mode.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Remove the allowlist line; dogfood-render green in both engines. `npm run check` plus the touched folders' tests exit 0.

## Context
T-0168 chip-opaque rule; demo/column-chart-demo measures 3.25:1. Allowlisted in scripts/dogfood-render-allowlist.json.

## Constraints
Use color roles, no literals.
