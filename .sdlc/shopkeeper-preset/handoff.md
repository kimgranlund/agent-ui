---
id: T-0075
title: "S1: Shopkeeper preset, commerce pack, gallery and itinerary text repair"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0072, T-0073, T-0074]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
S1: Shopkeeper preset, commerce pack, gallery and itinerary text repair (child S1 of the preset-widgets campaign; design `.sdlc/preset-widgets-design/design.md`).

## Intent
- Do: design.md section 3 (Shopkeeper) and section 8 row S1. A new `shopkeeper` entry in `AGENT_PRESETS` that exercises ProductCard (config only, no catalog change), a commerce pack, `shopkeeper.manifest.json`, the `gallery-swiper` and `itinerary-timeline` text repairs the review found, and the e2e persona-picker fixture if it pins the preset count (re-record keylessly or widen).
- Files (the scope): `site/pages/agent-admin-presets.ts`, `site/pages/agent-admin-libraries.ts`, `site/lib/agent-manifest/shopkeeper.manifest.json`, the e2e-admin persona-picker fixture
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: preset tests and the persona-picker e2e green; npm run check and npm test exit 0; npm run e2e:admin exit 0; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0072, T-0073, T-0074. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Closed

2026-10-12: Merged in #1901; verifier fail on two comments, fixed by conductor
