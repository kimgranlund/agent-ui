---
id: T-0071
title: "C3: ui-game-hud control"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0067]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
C3: ui-game-hud control (child C3 of the preset-widgets campaign; design `.sdlc/preset-widgets-design/design.md`).

## Intent
- Do: design.md section 4 GameHud contract and the ADR-0243 fork sheet (note the risk in section 9: its structural gain is the smallest; build it anyway, R1 decides whether the row ships). `ui-game-hud` per ADR-0233: title, status, statusIntent, stats (array of {label,value,delta,intent}, max 6), progress {value,max,label}; empty stats renders title and status only; deltas signed. Light DOM, ARIA via internals. Site doc page. No catalog row yet (R1).
- Files (the scope): `packages/agent-ui/components/src/controls/game-hud/**`, generated registry files, the site doc page
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: control tests and its browser test (its own shard, alone) exit 0; sizing-gates, layering and descriptor drift exit 0; npm run check and npm test exit 0; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0067. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Styling review (Kim, 2026-10-12)
Mockup approved: stat strip, signed deltas without arrows. Kim: it looks great and will not compete with primary content.

## Closed

2026-10-12: Merged in #1898; verifier pass
