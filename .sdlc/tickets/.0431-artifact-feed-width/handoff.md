---
id: T-0431
title: "A2A Artifact Feed bubbles carrying an artifact use the column width"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
On /a2a-artifact-feed an agent bubble that carries a live A2UI artifact spans the timeline's width (up to its existing min(46rem, 92%) cap), so the surface lays out at a real width instead of shrinking to its text; prose-only bubbles keep hugging their text.

## Context
Kim 2026-10-23 screenshot ("use more of the width"): the Q2 revenue report bubble is about 360px wide on a wide page, the KPI cards squeezed into one clipped column. site/pages/a2a-artifact-feed.css: `.msg` is a flex item with `align-self: flex-start` and only `max-inline-size`, so it shrinks to content, and the fill-by-default surface inside it collapses.

## Constraints
Page-local CSS only; never restyle a ui-* control (the file's own rule). Tokens only.

## Done when
A screenshot of the real page at desktop width shows the artifact bubble at the column width with the KPI cards laid out, and at 400px still fits; the page's browser test pins the bubble width; npm run check plus site/pages a2a-artifact-feed tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b1646add4286
- Changed: A2A Artifact Feed bubbles carrying an artifact use the column width
- Commits: none
- Check: 1 Screenshot of the real page at desktop width shows the artifact bubble at the column width with t...: pass
- Check: 2 The page's browser test pins the bubble width: pass
- Check: 3 npm run check plus site/pages a2a-artifact-feed tests pass: pass
- Follow-up: note: site/pages/a2a-artifact-feed.css:57 fix is page-local... -> notes.md
