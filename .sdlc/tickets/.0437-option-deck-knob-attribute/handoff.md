---
id: T-0437
title: "Component-mode boolean knobs set the kebab attribute (OptionDeck allowRandom)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
On the docs site component previews (component mode), a camelCase boolean knob such as OptionDeck's allowRandom sets the descriptor's kebab attribute (allow-random) or the prop, so toggling it changes the control.

## Context
T-0433 solo and verifier note: site/lib/component-preview.ts may apply boolean knobs as setAttribute(knob.name), so allowRandom misses allow-random. Unverified: reproduce first.

## Constraints
Use the descriptor's attribute: field, not a hand map.

## Done when
A browser test toggles allowRandom in component mode and sees the Surprise me card appear and vanish; npm run check plus the component-preview tests pass.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Outcome

2026-10-24 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: b066d868331f
- Changed: Component-mode boolean knobs set the kebab attribute, so OptionDeck allowRandom toggles
- Commits: none
- Check: 1 A browser test toggles allowRandom in component mode and sees the Surprise me card appear and vanish: pass
- Check: 2 npm run check plus the component-preview tests pass: pass
- Follow-up: note: site/lib/component-preview.ts COMPONENT_SAMPLE_INIT comment still... -> notes.md
