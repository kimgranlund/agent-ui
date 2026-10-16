---
id: T-0297
title: "NARRATED_MECHANICS misses a capitalized surface id ('Table-3 is dealt.')"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A surface id in chat prose is caught whatever its case.

## Context
Round 6 cluster B (`.sdlc/evals/rounds/2026-10-15-r6-matrix/report.md`): "Table-3 is dealt." (:11, Haiku) and "Table-2 is open." (:244, Sonnet) reached the chat; `narratedMechanics` in `packages/agent-ui/a2ui/src/agent/produce.ts` matches the id case-sensitively. Cause (d) check defect.

## Done when
- A produce test with reply "Table-3 is dealt." fires NARRATED_MECHANICS; red at the base.
- `scripts/e2e-admin/probe/replays/croupier-haiku-surface-id-in-reply.test.mjs` flipped to expect the check; the live-agent tests and `npm run check` exit 0.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts -t 'a capitalized surface id'`
- (red) `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-haiku-surface-id-in-reply.test.mjs`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent`
- (guard) `npm run check`

## Outcome

2026-10-16 · lane: full L1 · verdict: closed by reason (Merged in the round 6 producer lane; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
