---
id: T-0073
title: "P1: CardTable in the croupier fragment"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0068, T-0072]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
P1: CardTable in the croupier fragment (child P1 of the preset-widgets campaign; design `.sdlc/tickets/.0065-preset-widgets-design/design.md`).

## Intent
- Do: design.md section 4 CardTable. Composite factory over ui-card, ui-playing-card, ui-badge, ui-text in `personas/croupier`; data paths `/dealerHand`, `/playerHand`, `/dealerTotal`, `/playerTotal`, `/bankroll` unchanged; the ADR-0238 hand check gains a CardTable arm (`dealerHand`/`playerHand` must be `{path}` bindings to those lists, totals computed from them); teaching text in `card-layout` and `game-table-chrome`; croupier preset skills and `seedVersion` 8; croupier seeds for the coverage gate. Replay the recorded Croupier fixtures and compare component counts per deal (27 before).
- Files (the scope): `packages/agent-ui/a2ui/src/catalog/personas/croupier/{catalog.json,factories.ts,selection.json,checks.ts}`, `croupier.manifest.json` (writer test), `prompts/mini-skills/{card-layout,game-table-chrome}.md`, `site/pages/agent-admin-presets.ts` croupier entry
- Non-goals: anything outside the scope list; the other children; the live leg and any key.
- Done when: croupier checks, factories and recorded-replay green; a CardTable deal measured against the 27-component baseline; coverage gate green; npm run check and npm test exit 0; no em dash in any added line (generated single-line files that embed unchanged text excepted, say so); records repaired in the same change.

## Context
Campaign order (design.md section 8): A0 (ADR-0243 draft) first, then Kim comments `ratify ADR-0243` on its PR and the conductor runs `scripts/adr_ratify.py`; then W0, C1, C2, C3 (C1 to C3 in parallel); R1 after C1 to C3; P1 and P2 after W0 and R1; S1 last. Dependencies recorded in front matter: T-0068, T-0072. Related: T-0064 (catalog previews, in flight: its coverage gate and seed format apply), T-0066 (prompt contradictions, in flight). If a dependency's work has merged, rebase onto main first. Close-first: one verifier per ticket and a pass is final; docs-only tickets skip the verifier.

## Constraints
Imports point inward only. Light DOM, ARIA via ElementInternals. Never hand-edit generated files. No push without approval; the conductor opens PRs after the verifier passes. Stop and report blocked if the scope list blocks a file you must touch.

## Styling review (Kim, 2026-10-12)
Mockup approved: green felt zones, 52px cards, as shown.

## Closed

2026-10-12: Merged in #1900; verifier pass
