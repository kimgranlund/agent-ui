---
id: T-0339
title: "ui-gauge in RTL keeps its rings on the left and its legend about 190px away"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0339-gauge-rtl
worktree: ../agent-ui.worktrees/wave-w339
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
ui-gauge lays out its rings and legend by logical start and end, so dir=rtl mirrors it with the legend beside the rings.

## Intent
- Do: fix the gauge layout for RTL; add an RTL gauge to the dogfood-render sweep so legend-gap measures it.
- Non-goals: other controls' RTL.
- Done when: legend-gap is green on an RTL gauge in both engines; npm run check plus the gauge folder tests exit 0.

## Context
Found by T-0168: legend-gap catches it, but no RTL gauge is in the sweep today.

## Constraints
None.

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: fad007f9dcf6
- Changed: ui-gauge anchors its rings to the start edge from the computed direction; arcs stay clockwise (#2092)
- Commits: none
- Check: 1 legend-gap is green on an RTL gauge in both engines: pass
- Check: 2 npm run check plus the gauge folder tests exit 0: pass
- Check: 3 Goal (rings on the start edge, legend beside them, arcs clockwise, dir and CSS-only direction, an...: pass
- Follow-up: note: packages/agent-ui/components/src/controls/gauge/gauge.ts: a... -> notes.md
- Follow-up: fix-now: packages/agent-ui/components/src/controls/gauge/gauge.ts:108... -> notes.md
- Follow-up: decide: site/pages/dogfood-render.browser.test.ts: with the anchor... -> notes.md
