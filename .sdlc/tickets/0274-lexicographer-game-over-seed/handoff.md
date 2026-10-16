---
id: T-0274
title: "A Lexicographer game-over exemplar so a give-up turn retrieves and draws ResultCard"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: feat/lexicographer-game-over
worktree: .claude/worktrees/wave-go
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Lexicographer give-up turn ("I give up", "Show me the word") retrieves a game-over exemplar and draws ResultCard with the revealed word.

## Context
Split out of T-0268 (2026-10-15): the only ResultCard exemplar on the `agent-ui` shard is `frontier-result-card-win` (a blackjack win), and a give-up shares no vocabulary with any game record. Live round 3 missed ResultCard on the Haiku give-up and Sonnet invalid-then-replay runs (`.sdlc/evals/rounds/2026-10-15-r3-routing/runs/regress-lexicographer-*`, t3 and t4).

## Scope
Author a `domain-lexicographer-game-over` seed in `packages/agent-ui/a2ui/src/examples/domain-seeds.ts` (word board settled, ResultCard revealing the word, a New game action) and admit it through the judged import (skill `a2ui-corpus-curation`).

## Done when
- `retrieve-presets.test.ts` pins the new exemplar in the top 3 for "I give up." and "Show me the word." on `agent-ui`, every other pin unchanged.
- The admission is judged and `import-seeds.ts --dry-run` then reports 0 admitted.
- The corpus, examples and corpus-tools suites and `npm run check` exit 0.

## Acceptance criteria
verifier: L3
- `retrieve-presets.test.ts` pins `domain-lexicographer-game-over` first for "I give up." and "Show me the word." on `agent-ui`; the 15 earlier pins are unchanged.
- `node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --dry-run` reports 0 admitted, and the shard line ships with its verdicts archive.
- The corpus, examples and corpus-tools suites and `npm run check` exit 0.
