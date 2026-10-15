---
id: T-0267
title: "The Concierge has no spa treatment list, so a spa services question gets prose and no ServiceCard on every model"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Concierge's knowledge holds the spa's treatment list (and other bookable services), so "What spa services can I book during my stay?" has data to draw ServiceCards from.

## Repro
Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``traces/2026-10-15.jsonl` lines 96 (Haiku) and 283 (Opus): "I don't have the spa's full treatment menu with me, so I won't guess".

## Expected
A spa services question ships ServiceCard (one per treatment) from house facts or `property-knowledge-base`.

## Actual
All three models refuse to list treatments, and the services turn draws no ServiceCard (`routing-decoy-words` t3, `long-concierge-booking` t0, and `routing-two-surfaces` t0, on every model). ServiceCard was drawn once in 83 Concierge turns.

## Context
`site/pages/agent-admin-presets.ts:352` (`property-knowledge-base`) and the T-0231 House facts hold hours and policies but no treatment list. The models are right not to invent one. Found by T-0261.
