---
id: T-0078
title: "Raise concierge, croupier and a2ui-basic selection sidecars to the use-for plus not-for bar"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Raise the concierge, croupier, fixture-demo and a2ui-basic selection.json sidecars to the current bar: a use-for (intents) plus not-for clause per type.

## Intent
- Do: review each persona and a2ui-basic selection.json against the default catalog's entries; add missing intents and notFor entries with a why; keep sidecars complete (every type).
- Non-goals: default catalog rows (T-0072 owns them); new types.
- Done when: each type has at least one intent and one notFor with a why, selection-guidance tests and registry generate test pass, npm run check exit 0.

## Context
Files: packages/agent-ui/a2ui/src/catalog/{a2ui-basic,personas/*}/selection.json, src/registry/selection-projection.gen.ts via npm run generate:registry (drift-gated). Concierge BookingForm/BookingConfirmation, Croupier PlayingCard, fixture FixtureBanner.

## Constraints
selection-projection.gen.ts is generated; do not hand-edit. No em dashes.

## Closed

2026-10-12: Merged in #1893; verifier pass
