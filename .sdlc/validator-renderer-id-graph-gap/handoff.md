---
id: T-0220
title: "Server validation passes an update the renderer rejects as an id-graph violation"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
An update that passes server validation also mounts in the renderer: the server judges the merged component graph the renderer will hold.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-draw-id-graph.test.mjs` (traces 2026-10-15.jsonl:110 to 114), then mount the turn-3 lines on the turn-1 and 2 state.

## Expected
Turn 3 (Discard and draw) is either repaired on the server or mounts cleanly.

## Actual
The renderer answered with two client errors, `VALIDATION_FAILED: id-graph violation: acts->bBet` and `acts->bCheck` (traces :113, :114), for an update the producer had shipped as valid. Again on table-3 (:121, :122). five-card-draw-sonnet-1.

## Context
Guess: the server validator checks the turn's components against the turn's own payload, while the renderer checks children against the merged surface after the turn removed `bBet` and `bCheck` but left them in `acts`. Fix owner: the validator spine (`packages/agent-ui/a2ui/src/renderer/validate.ts`) or the semantic surface views. Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/agent/surface-seeds.test.ts` exits 0: the seed and the semantic views drop the children a resent container no longer lists, the server fails the relisting update as `acts->bBet` and `acts->bCheck`, and the real renderer reports the same two violations (and none for the redelivered update).
- (red) `npx vitest run scripts/e2e-admin/probe/replays/croupier-draw-id-graph.test.mjs` exits 0: turn 3 ships the recorded heal that redelivers bCheck and bBet, and every probe check is green but T-0217's `no-internal-leak` on the recorded heal's "Fixed." (a pinned known fail). Since T-0222 the replay's CARD_DUPLICATE rounds mask round 1's IDGRAPH, so the first criterion carries the T-0220 proof.
- `npm run check` exits 0.

## Lane verify scope (conductor)
One batched verifier for this lane (Kim's ruling: one verifier per bundle). Verify this handoff AND each of these, criterion by criterion, in the same tree; give one verdict per ticket under Criteria and one overall Verdict:
- .sdlc/admin-error-turn-per-violation/handoff.md
- .sdlc/producer-reply-meta-line-prose/handoff.md
- .sdlc/chat-repair-leaks-to-prose/handoff.md
- .sdlc/inner-radius-quizmaster-stylist/handoff.md
- T-0223 screenshots: /private/tmp/claude-501/-Users-kimgranlund-Projects-nonoun-agent-ui/a8ce3b21-c0a4-4e5f-b099-1796666e5f7f/scratchpad/t0223/
