---
id: T-0381
title: "PlayingCard size sm renders its index under the type floor (round 12 cluster N)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
ui-playing-card at size sm renders its index and pip at or above the 9px type floor at the widget tier.

## Intent
- Do: fix the sm geometry in `packages/agent-ui/components/src/controls/playing-card/` (derive from the foundations, no one-off literal), or drop sm from the croupier catalog enum if sm cannot meet the floor.
- Done when: a browser test renders PlayingCard sm at `data-tier="widget"` with the index at or above the floor; the playing-card tests, the dogfood render lint and `npm run check` exit 0; a screenshot against main is attached.

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster N: `five-card-draw-haiku-1` (:63 to :72) sizes every PlayingCard sm; the render lint reads the index at 7.875px and the pip at 8.4px. T-0189 exempted the corner index as card art at the default size only.

## Constraints
No one-off heights (ADR-0245 ramp). Kim approves a visible change by screenshot.
