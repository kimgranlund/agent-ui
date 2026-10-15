---
id: T-0197
title: "BookingForm field kinds (dateRange, radio, time, stepper) and sharing it with the Maitre d'"
type: feature         # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0196]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Concierge hand-built a booking form although `BookingForm` is in its catalog, because the form cannot express the ask (trace 6: RadioGroup restaurant, Calendar single date, time TextField, party-size Slider).

## Intent
- Do: add field kinds `dateRange`, `radio`, `time` and `stepper` (stepper uses T-0196's control) to `BookingForm`; single dates stay `ui-text-field type=date` (T-0135); move BookingForm from the concierge fragment to a shared hospitality fragment or the default catalog so the Maitre d' (no fragment today, `localPatterns` unset) gets it; teach "never rebuild a booking form from primitives" in both presets and the `booking-flow` and `table-reservation` playbooks.
- Done when: the common process below is complete, and a live Concierge and Maitre d' table booking renders BookingForm on both models.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
