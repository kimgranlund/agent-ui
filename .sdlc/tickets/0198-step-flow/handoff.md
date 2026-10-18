---
id: T-0198
title: "Step flow pattern: step n of m, Back and Next, shared /draft data"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0197]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The concierge `booking-flow` playbook spends about 2,000 characters of prose describing one wizard pattern (five scenes, Back on every scene, draft under `/draft/*`); the model re-derives it each time.

## Intent
- Do: a composite that holds scene children with a step indicator (n of m, labels), Back and Next owned by the composite, a shared draft data prefix, validation gating Next, and a final step that hands off to the Confirm and receipt pattern (T-0195). BookingForm may embed it.
- Evidence: concierge `booking-flow` (`agent-admin-libraries.ts` about :211), corpus `backable-wizard`, `pattern-wizard` (Tabs misused as steps), `plan-and-execute-plan`.
- Done when: the common process below is complete.

## Context
- Pattern sweep 2026-10-14 (all 15 presets, `.agent-traces/2026-10-14.jsonl`, corpus, fixtures); Kim ticketed it the same day. Process like T-0193 (OptionDeck): design intake with skill `component-design` (precedent sweep, fork sheet, decisions recorded in this ticket, ADRs retired), then a mockup at widget / md on the A2UI canvas, light and dark and the 400px column, approved by Kim before any build; then control or composite, descriptor, default catalog row with `selection.json` intents and notFor, mini-skill, factory and browser tests in both engines, visual golden, render lint clean; adopt in the presets and bump their seedVersion and manifests; live `npm run chat:probe` on Haiku 5.5 and Sonnet 5.5 (conductor runs live).
- Commit off origin/main, never push. Zero dependencies; light DOM, ARIA via ElementInternals; no buttons inside card containers (Kim 2026-10-14).

## Constraints
- No em dashes.
