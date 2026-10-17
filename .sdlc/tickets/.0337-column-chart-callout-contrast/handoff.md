---
id: T-0337
title: "Column-chart highlight callout ink meets 4.5:1 on its pill in dark mode (chip-opaque debt)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
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

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 6a049c6a2f34
- Changed: Dark-mode callout pill dims the highlight ink one step; ink 6.36:1 (#2090); system pair filed as T-0340
- Commits: none
- Check: 1 Remove the allowlist line: pass
- Check: 2 dogfood-render green in both engines: pass
- Check: 3 `npm run check` plus touched folders' tests exit 0: pass
- Check: 4 Goal (dark ink reaches 4.5:1, light unchanged, follows re-themed highlight ink): pass
- Follow-up: decide: packages/agent-ui/components/src/controls/column-chart/column-chart... -> notes.md
- Follow-up: note: packages/agent-ui/components/src/controls/column-chart/column-chart... -> notes.md
