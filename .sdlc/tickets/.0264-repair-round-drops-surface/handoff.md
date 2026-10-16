---
id: T-0264
title: "A repair round can ship less than the turn needs: an ACTION_NOT_APPLIED retry ends with no surface, and surfaces made in an earlier round are lost"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A repair round never ships less than the turn needs. A retry that answers ACTION_NOT_APPLIED must still update the targeted surface. A surface created in an earlier round of the same turn is shipped or deliberately dropped, never lost.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-stand-no-update.test.mjs` (pins today's behavior).
2. Read `.sdlc/evals/rounds/2026-10-15-r3-routing/``runs/regress-croupier-blackjack-rounds-haiku-1/report.json` (action-updates-surface t2, click-target t3).

## Expected
The Stand click's turn updates table-1 to the settled hand with Deal again. If no round can, the turn is marked failed, not passed.

## Actual
At :36 (Haiku), round 1 gets ACTION_NOT_APPLIED and round 2's wire fails SCHEMA. Round 3 sends prose and no wire, and it passes: the trace's codes are `SCHEMA, SEMANTIC_UNCORRECTED`, and the shipped surface is empty. The table keeps Hit, Stand and Double, so the run stops at Deal again. `no-surface-loss` failed on 4 turns, where a surface created in an earlier round was never shipped: `regress-croupier-blackjack-moves-haiku-1` t0, `regress-croupier-five-card-draw-haiku-1` t2, and `regress-lexicographer-invalid-then-replay-haiku-1` t1 and t5.

## Context
Guess: the final round is judged only on its own findings, and a no-wire round has none. Producer retry loop: `packages/agent-ui/a2ui/src/agent/produce.ts`. Found by T-0261.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts` exits 0: a `SCHEMA` failure on `[i].<kind>.surfaceId` whose message carries `surfaceId` beside the operation key is fed back with that key named and the move inside; a SCHEMA miss with no envelope `surfaceId` keeps the bare path.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-stand-no-update.test.mjs` exits 0: with round 3 authored to that feedback (round 2's own messages, `surfaceId` moved inside), the Stand turn updates table-1 to the settled hand with Deal again and every probe check is green.
- `npm run chat:probe -- selftest` exits 0: a surface a rejected round created and the shipped round replaced passes `no-surface-loss`, and a turn that ships no surface after a round created one still fails it. The four round 3 `no-surface-loss` fails were three such replacements (a check false positive, no producer loss) and one SURFACE_DEGRADED turn that shipped nothing (`regress-lexicographer-invalid-then-replay-haiku-1` t5), which still fails.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in the round 3 repair and check fixes PR; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
