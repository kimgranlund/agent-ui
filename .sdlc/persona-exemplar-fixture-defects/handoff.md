---
id: T-0246
title: "Docs-page persona exemplar fixtures carry the same game and booking defects as the seeds"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0245]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The docs-page persona exemplar fixtures in `packages/agent-ui/a2ui/src/examples/persona-exemplars.ts` show correct game and booking state, matching the fixed T-0245 seeds.

## Context
T-0240's review found the seed defects (unbound `/phase`, wrong bankroll after a bet, booking confirmed before submit, wrong miss glyph, answer not in `/secret`) also sit in these page fixtures, so readers of the docs site see wrong state today.

## Done when
- The fixtures carry none of the T-0245 defects; their tests and the site catalog page render green.
- `npm run check` exit 0.
