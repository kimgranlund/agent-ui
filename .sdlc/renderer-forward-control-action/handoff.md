---
id: T-0081
title: "A2UI renderer forwards a control's own action event so BoardGrid cells can fire on the wire"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The A2UI renderer forwards a control's own DOM `action` event (with its detail context) as an A2UI action, so BoardGrid can ship an `actionName` and report which cell was clicked.

## Intent
- Do: design and build renderer support for controls that emit their own `action` event with detail (BoardGrid `{row, col}`); then add `actionName` to the BoardGrid default row and teach it.
- Non-goals: changing ProductCard (its click-anywhere host wiring stays).
- Done when: a BoardGrid cell click on the wire sends one A2UI action with row and col; renderer tests prove it; check and npm test exit 0.

## Context
Source: T-0072 R1 verifier 2026-10-12. renderer.ts #actionPropsOf picks only mapsTo:'action' props and #wireAction adds a host click listener emitting static context; nothing listens for a control's own action event. BoardGrid therefore ships read-only on the wire; the pack teaches a Grid of cell Buttons for clickable boards. Likely needs an ADR amendment (renderer contract).

## Constraints
The default catalog stays valid for existing surfaces. No em dashes.

## Acceptance criteria
- A BoardGrid with `actionName` sends exactly one A2UI action per cell click, carrying `{row, col}`: `npx vitest run --project packages packages/agent-ui/a2ui/src/renderer/renderer.test.ts -t "own action event"` exit 0.
- The catalog mark, row and corpus grounding hold: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/corpus` exit 0.
- Prompt baseline, budgets and registry are regenerated and green: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent` exit 0.
- `npm run check` exit 0.
