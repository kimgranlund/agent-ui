---
id: T-0196
title: "Amount picker pattern (the missing Stepper): one bound number with chips, +/- or slider, bounds, step and one commit"
type: feature         # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`mini-skills/quantity.md` calls a number picker "a fleet gap"; one idiom has four spellings today (Slider, number TextField, Slider plus Button, chips).

## Intent
- Do: a default-catalog control or composite for picking a bounded number and committing it: preset chips (optional), minus and plus, optional slider, min, max, step, bound value, one commit action, read-only formatted value (units, currency through the codec). Compare with the CardTable bet strip (T-0172), which stays a fixed strip for blackjack.
- Evidence: negotiator `deal-sheet` (`agent-admin-libraries.ts` about :305, Slider plus Offer Button), shopkeeper quantity (corpus `product-options-quantity`), concierge party size (trace 6 Slider, `booking-flow` number TextField), Croupier's old bet Card+Slider+Button (traces 1, 11).
- Adopt in Negotiator, Shopkeeper, Concierge and BookingForm's stepper kind (T-0197).
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
