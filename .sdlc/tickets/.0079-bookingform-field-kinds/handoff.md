---
id: T-0079
title: "BookingForm field kinds dateRange, number, text plus a second Concierge seed (verify claim first)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
BookingForm accepts field kinds dateRange, number and text in addition to dateSingle, select, checkbox, and Concierge gets a second seed using them. First verify the claimed gap by reading factories.ts.

## Intent
- Do: read packages/agent-ui/a2ui/src/catalog/personas/concierge/factories.ts (the header notes range was narrowed because ui-calendar range commits a two-entry FormData); confirm whether number and text kinds are missing; add number and text kinds, keep date range as two dateSingle fields; add a second Concierge seed in src/examples/persona-exemplars.ts; update the wire catalog.json docs.
- Non-goals: a native range Calendar field; other personas.
- Done when: new kinds validate and render (tests), the T-0064 coverage gate stays green, check and npm test exit 0. If the gap does not exist, close with a reason and change nothing.

## Context
Source: preset review 2026-10-12 (claim marked unverified there). Merged T-0064 added persona-exemplars.ts and every-catalog-coverage.test.ts.

## Constraints
Do not widen into ui-calendar. No em dashes.

## Closed

2026-10-12: Merged in #1894; verifier pass after one em dash fix
