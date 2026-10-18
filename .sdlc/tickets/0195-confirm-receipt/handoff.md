---
id: T-0195
title: "Confirm and receipt pattern: promote BookingConfirmation to the default catalog with total, actions and a settled state"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The read-back, confirm and receipt moment is hand-built in at least four presets and four corpus exemplars. A bound composite cannot misstate a value or re-ask.

## Intent
- Do: promote `BookingConfirmation` (today in `packages/agent-ui/a2ui/src/catalog/personas/concierge/catalog.json`, rows `{label, path}` with the T-0172 `options` key) to the default catalog, or a successor composite, adding: a total row, Back and Confirm actions owned by the composite, a settled receipt state (actions retire, a confirmed mark appears), and line items for orders.
- Evidence: concierge `booking-flow` (`site/pages/agent-admin-libraries.ts` about :211), restaurant `table-reservation` (about :235), shopkeeper `cart-summary` (about :169), travel `trip-plan` close; corpus `receipt-order-summary`, `confirmation-view`, `structured-container-trip-summary`, `frontier-booking-receipt`.
- Adopt in Concierge, Maitre d', Shopkeeper, Travel.
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
