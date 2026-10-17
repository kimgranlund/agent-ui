---
id: T-0328
title: "A same-turn repair that rebuilds a flagged surface under a new id must not halt (round 9 cluster A)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0328-rename-after-repair
worktree: ../agent-ui.worktrees/wave-w328
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Haiku turns stop halting when a repair round rebuilds the flagged surface under a new surface id.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: Add keyless replay `scripts/e2e-admin/probe/replays/croupier-haiku-rename-halts` from round 9 :1, red first (ProduceHalt), green after (round 2's CardTable ships). A produce test: a never-shipped flagged surface superseded in the same turn is not SURFACE_DROPPED; a shipped surface that disappears still is. `npm run check` plus the touched folders' tests exit 0.

## Context
Kim 2026-10-17 ruling: a surface rebuilt under a new id within the same turn is not a drop; only surfaces that shipped count as dropped (amends the T-0317 rule). Change the `dropped` rule in packages/agent-ui/a2ui/src/agent/produce.ts (:1724, :1843; SURFACE_DROPPED_HINT :1111). Evidence: report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster A, trace lines :1, :120, :128, :143, :147.

## Constraints
The invariant for shipped surfaces stays (Kim L1: invariant wins). grammar.md untouched.

## Acceptance criteria
verifier: L3

- `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-rename-halts.test.mjs` exits 0: the round 9 :1 replay ships round 2's CardTable on `table-1`, no halt, no `ask-1` line (red before the fix: ProduceHalt SURFACE_DROPPED).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts -t T-0328` exits 0: a flagged surface left out by a round that first builds a new id ships (single, two-round and chained renames, CONTAINMENT, the Row oscillation); one new id retires one flagged surface; a round with no new id, an unflagged `ask-1`, `ask-1` beside an unattributable genui failure, a narrated `ask-1` and a flagged `ask-1` answered in prose all halt or repair with `SURFACE_DROPPED`.
- `npx vitest run scripts/e2e-admin/probe/replays/concierge-booking-surface-loss.test.mjs` exits 0: round 2 builds no new id, so the hand-built booking on ask-1 is still SURFACE_DROPPED and never ships.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent scripts/e2e-admin/probe` exits 0 (the property test's I1 oracle amended to the new-id rule, with narration, genui and rename shapes in 2-round sequences; `lexicographer-haiku-fleet-check` re-pinned: its third round's `ask-2` now ships).
- `npm run check` exits 0.
