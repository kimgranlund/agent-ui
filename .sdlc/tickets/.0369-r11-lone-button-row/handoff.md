---
id: T-0369
title: "LONE_BUTTON_FRAME sees through a one-child Row as the probe render lint does (round 11 cluster I)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The producer's LONE_BUTTON_FRAME check sends back a Card whose lone CardFooter holds a Row with one Button, the shape the probe render lint (`lone-button-frame`) already fails.

## Repro
1. A framed-choice check test on the trace :164 shape of `.sdlc/evals/rounds/2026-10-18-r11-targeted/``traces/2026-10-18.jsonl`: `actionCard` (Card) > `actionFooter` (CardFooter) > `actionRow` (Row) > `againBtn` (Button "Deal again"), expecting LONE_BUTTON_FRAME. Today it yields none.

## Expected
The producer and the render lint agree on a one-child Row or Column wrapper.

## Actual
`regress-croupier-seven-card-stud-haiku-2` failed render-lint `lone-button-frame` on turns 5 to 9 with no producer code fired.

## Context
`packages/agent-ui/a2ui/src/catalog/framed-choice-check.ts` (T-0300) matches the Button as the Card's sole child or the sole child of a lone CardContent or CardFooter; it mirrors `scripts/dogfood-compose.mjs`. Check which side the DOM lint reads and align both. Report: `.sdlc/evals/rounds/2026-10-18-r11-targeted/``report.md` cluster I.

## Constraints
The failing test lands before or with the fix, never after.

## Kim ruling (2026-10-18, close-out round)
Promoted to ready; run as a keyless solo lane with one verifier, no live spend.

## Outcome

2026-10-18 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 25097e88d3a1
- Changed: LONE_BUTTON_FRAME sees through one-child wrappers, one shared rule (#2147)
- Commits: none
- Check: 1 Goal: LONE_BUTTON_FRAME sends back Card > CardFooter > Row > one Button: pass
- Check: 2 Expected: producer and dogfood lint agree on one-child Row or Column wrappers: pass
- Check: 3 Constraint: failing test lands with the fix: pass
- Check: 4 gate: pass
- Follow-up: note: scripts/dogfood-compose.mjs:257 scoping by innermost array means a... -> notes.md
