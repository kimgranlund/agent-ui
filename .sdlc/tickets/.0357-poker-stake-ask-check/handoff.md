---
id: T-0357
title: "A poker opening that asks for the stake instead of dealing gets a deterministic check and repair"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

verifier: L3

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier` exits 0: the recorded round 10 `:81` round 0 payload gets exactly `POKER_DEAL_MISSING` at `ask-1:stake` with a Card-frame repair naming no CardTable; a dealt hold'em hand (on the surface or on another surface the turn touches), a settled hold'em Card with a next-stake Slider and a Deal again forward, a game picker, stud or Omaha prose that mentions hold'em, an off-screen Slider and a rules card get none; every hold'em spelling and the "Texas Hold'em: your buy-in" step fire; stud, Omaha, draw and roulette bet steps keep their Card with no finding.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0: the new repair text names only croupier catalog types.
- `npx vitest run scripts/e2e-admin/probe/replays` exits 0: every croupier replay stays green.
- `npm run check` exits 0.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 45dcca581087
- Changed: POKER_DEAL_MISSING for a hold'em stake ask (#2132)
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier` exits 0 (the :81 pin and it...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0 (the repai...: pass
- Check: 3 `npx vitest run scripts/e2e-admin/probe/replays` exits 0 (every croupier replay stays green): pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:541... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:578-... -> notes.md
