---
id: T-0268
title: "The Lexicographer's opening turn retrieves no word board and draws none, and give-up turns miss ResultCard"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Lexicographer game start retrieves the word board exemplar and draws BoardGrid and GameHud. (The give-up ResultCard moved to T-0274, conductor 2026-10-15.)

## Repro
1. Keyless: `retrieve` at k 3 on the `agent-ui` catalog for "Start a new word game." and "New word game, please." ranks no `domain-lexicographer-word-board` (top: backable-wizard, notification-status-stack, crud-entry-list-drawer). Every "My guess: ..." ranks it first.
2. Live: `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/regress-lexicographer-*` (expect-component t0 BoardGrid on 4 of 4 runs; ResultCard t3 and t4 on Haiku give-up and Sonnet invalid-then-replay).

## Expected
The opening turn's top 3 holds the word board, and the opening and give-up draw their composites.

## Actual
The opening draws no BoardGrid on either model. BOARD_GRID_MISSING fired 7 times and saved 2 (:214, :220-:223 uncorrected). GameHud is missing on Sonnet `invalid-then-replay`.

## Context
`packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts` pins only "My guess is CRANE". The Lexicographer has no domain (T-0240), so retrieval matches on vocabulary alone. Found by T-0261 (phase 1 keyless check, then live).

## Lane bundle
This solo lane delivers these tickets in order, one commit each:
- .sdlc/tickets/0268-lexicographer-opening-no-board/handoff.md
- .sdlc/tickets/.0273-croupier-hit-ranks-battleship/handoff.md

## Acceptance criteria
verifier: L3
- `npx vitest run packages/agent-ui/a2ui/src/corpus/retrieve-presets.test.ts` exits 0, with the T-0253 block holding `domain-lexicographer-word-board` in the top 3 for "Start a new word game." and "New word game, please." on `agent-ui`, and every other preset pin unchanged.
- `node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --dry-run` exits 0 with 0 admitted (the prompt-only edit keeps the record's canonical hash, so the seed and the shard agree).
- `npx vitest run packages/agent-ui/a2ui/src/corpus packages/agent-ui/a2ui/src/examples packages/agent-ui/a2ui/tools/corpus` exits 0.
- `npm run check` exits 0.

## Scope change (conductor, 2026-10-15)
The verifier L3 failed only the give-up ResultCard bullet, which the solo had reported as unmet and as needing a judged corpus admission. That half moved to T-0274; this ticket is the opening-turn retrieval only.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in the round 3 retrieval PR; verifier pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
