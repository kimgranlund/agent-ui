---
id: T-0263
title: "FLEET_SECRET_MISSING fires on the Lexicographer's word board and has Haiku write a fleet into a word game"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The hidden-state checks fire only for the game whose board they judge: a Lexicographer word board never gets FLEET_SECRET_MISSING, and an Admiral board never gets WORD_SECRET_MISSING.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-fleet-check.test.mjs` (pins today's behavior).
2. Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``traces/2026-10-15.jsonl` lines 110 and 111 (`regress-lexicographer-invalid-then-replay-haiku-1`).

## Expected
A word board turn is judged by the word checks only.

## Actual
Round 2 of :110 shows `FLEET_SECRET_MISSING: Surface "ask-1" is a Battleship board but its data model commits no fleet of yours` twice. Haiku then writes `/secret/fleet` and `/secret/playerFleet` into the word game, and the turn ships with SEMANTIC_UNCORRECTED (:110, :111). A board surface is lost (`no-surface-loss` t1, t5).

## Context
`packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts`: both games ride the base `agent-ui` catalog (no domain, T-0240), so the check picks the game from the surface shape, and a BoardGrid with a TextField reads as Battleship. Guess: it needs a game cue, such as the preset id or the data-model keys (`/secret/word` against `/sea`). Found by T-0261.
