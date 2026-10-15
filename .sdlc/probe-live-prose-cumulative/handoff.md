---
id: T-0235
title: "chat:probe live prose checks read the whole chat, so one leak fails every later turn"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
branch: fix/lane-g-probe
worktree: .claude/worktrees/wave-lg
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`chat:probe`'s prose checks judge each turn's own prose, live as offline, so one leak fails one turn.

## Repro
1. Read `.sdlc/evals/rounds/2026-10-15-r2-presets/runs/croupier-five-card-draw-haiku-1/report.json`: `no-json-as-prose` and `no-internal-leak` fail on turns 2 to 10 (18 fails) for one leak in turn 2's reply (`2026-10-15.jsonl:42`).

## Expected
The live report fails `no-json-as-prose` on turn 2 only, as the offline replay of the same trace does (`croupier-draw-haiku-meta-tail`, `no-json-as-prose:1`).

## Actual
Live `proseText` is the whole chat log (`scripts/e2e-admin/probe/run.ts` `proseText(page)`), so every later turn re-reads the leak; offline `proseText` is the turn's own prose (`trace.ts`). In live round 2 the 27 `no-json-as-prose` and 33 `no-internal-leak` fails come from 13 replies: the 12 T-0229 leaks and Opus 5.5's narrated surface id (:260, T-0234).

## Context
The page re-renders earlier bubbles on a page-fired turn (the note is replaced by design, tkt-0079), so the live delta is not always a prefix. Options: record each turn's own bubble text in `run.ts`, or judge only a leak absent from the previous turn's prose. Found by T-0225 (`.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`); the `--from-trace` agent default is T-0236.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `node scripts/chat-probe.mjs selftest` exits 0: a live record whose earlier turn leaked fails the prose checks only on that turn; a later new leak still fails.
- `npm run check` exits 0.

## Lane bundle
This solo lane delivers these tickets in order, one commit each, then one batched verifier checks all of them:
- .sdlc/probe-live-prose-cumulative/handoff.md
- .sdlc/probe-from-trace-agent-default/handoff.md

## Lane verify scope
One batched verifier checks both tickets in ## Lane bundle against their own handoff criteria, from the lane base: .sdlc/probe-live-prose-cumulative and .sdlc/probe-from-trace-agent-default. One verdict per ticket, then one overall verdict.
