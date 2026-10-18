---
id: T-0357
title: "A poker opening that asks for the stake instead of dealing gets a deterministic check and repair"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A poker (hold'em) opening that asks for the stake in a feed ask instead of dealing the hands gets a croupier semantic finding and one repair round, the way BET_TABLE_MISSING repairs a blackjack stake ask.

## Repro
1. Round 10 `:81` (Haiku, "Let's play Texas hold'em."): the round 0 payload is a rules recap plus an `ask-1` Card with a stake Slider and a Deal Button, and it shipped with no finding.

## Expected
A finding fires on that payload (pin it as a test on the recorded `:81` round 0 payload), and a settled or dealt poker opening gives none.

## Actual
`betStepWithoutTable` skips poker (`namesOtherGame`, `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:541`), so nothing fires.

## Context
Kim's ruling 2026-10-18 (T-0345 debate): a sibling ticket, built beside the T-0345 measurement, deterministic and keyless, no model-read text change. Evidence: the T-0345 Opus proposal and Fable challenge at `.sdlc/runtime/tasks/0345-r10-poker-opens-with-cards/` (architect-L1.md, plan-reviewer-L1.md). Round 10 archive `.sdlc/evals/rounds/2026-10-17-r10-targeted/`.

## Constraints
The failing test lands before or with the fix. No repair-line or persona wording changes (debate rule). Croupier replays stay green.
