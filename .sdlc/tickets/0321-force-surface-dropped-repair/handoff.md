---
id: T-0321
title: "Force render_surface on a SURFACE_DROPPED repair round; the fallback never ships a round a check already failed"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16: a SURFACE_DROPPED repair round gets the forced render_surface (the T-0298/T-0301 mechanism), and the T-0302 earlier-round fallback never ships a round that a semantic check already failed.

## Context
Round 8 cluster B, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): `long-booking-confirm-haiku` (:169): round 1 failed BOOKING_FORM_MISSING, rounds 2 and 3 answered in prose with thinking on and no tool call, then T-0302 shipped round 1 (EARLIER_ROUND_SHIPPED, SEMANTIC_UNCORRECTED). `produce.ts:1711` sets no forceSurfaceRound after SURFACE_DROPPED. This narrows the T-0302 reading ("a semantic finding never blocks the fallback").

## Done when
- A produce test: after SURFACE_DROPPED the next Haiku round is forced with thinking off; a fallback candidate that failed a semantic check is not shipped (the turn degrades or halts as the spec says); red at the base. The T-0317 property test and the replays stay green (re-pin with a stated reason); `npm run check` exits 0; RTS spec updated.

## Acceptance criteria
verifier: L3

- (red) `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-forced-surface.test.ts -t T-0321` exits 0: after a SURFACE_DROPPED round (a prose round, or a valid round that left a built surface out) the next Haiku round sends `tool_choice` render_surface with `thinking: {type: "disabled"}`; a round a semantic check failed never ships as the T-0302 fallback (two prose rounds after it halt with SURFACE_DROPPED; a parse failure after it ships no payload and no EARLIER_ROUND_SHIPPED); the fallback ships the latest round no check failed over a later flagged one.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-loop-property.test.ts` exits 0: I1 and I2 still hold over every 2- and 3-round sequence on all three transports; the T-0302 pin is re-pinned (no flagged round ships as the fallback).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent scripts/e2e-admin/probe` exits 0 (every replay; each re-pinned replay is named with its reason in the report, `concierge-haiku-fallback-ships-readback` among them).
- `grep -c "T-0321" .claude/docs/spec/response-type-selection.spec.md` exits 0: RTS-R2 and RTS-P2 state the forced SURFACE_DROPPED round and the narrowed fallback.
- `npm run check` exits 0.

## Lane bundle
Lane `fix/r8-producer` (round 8 producer), one commit per ticket, in order:
1. T-0320: root-cause the one-brace-short `messages` strings (ours or the model's).
2. T-0321: force render_surface on a SURFACE_DROPPED repair round; the fallback never ships a check-failed round.
