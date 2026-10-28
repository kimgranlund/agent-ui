---
id: T-0499
title: "An empty repair round keeps the semantic failure it was repairing (round 16 cluster Q)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
After a semantic repair round comes back empty (no text, no tool), the next round re-sends the same repair ask with its forced render, instead of a PARSE hint.

## Context
Round 16 cluster Q (T-0486, report `.sdlc/evals/rounds/2026-10-28-r16-pattern/report.md`, merging as #2300). Run `regress-concierge-spa-booking-haiku-1` :13: r1 answers a confirm in prose with a `target` meta line, no tool (SURFACE_MISSING; the hint asks for a ConfirmReceipt re-creating `spa-booking`). r2 (the forced render_surface round) ends `end_turn` with 483 output tokens, no text, no tool call, and is filed as PARSE. r3 gets the PARSE hint, not the SURFACE_MISSING ask, answers note-only, and the confirm ships in prose (SEMANTIC_UNCORRECTED). Fix layer: `packages/agent-ui/a2ui/src/agent/produce.ts` repair loop. Fixture (until #2300 merges, copy from the T-0486 lane): /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/T-0486-wave-w0486/.sdlc/evals/rounds/2026-10-28-r16-pattern/runs/regress-concierge-spa-booking-haiku-1/fixture.json

## Constraints
Reuse the existing SURFACE_MISSING repair text; if any model-read text changes, flag it for a Fable review. Keep `forceSurfaceRound`. Failing-first. Add a keyless replay under `scripts/e2e-admin/probe/replays/` if the recorded turn can drive it. No paid runs. No em dashes.

## Acceptance criteria
- A `produce.test.ts` case with a scripted adapter (r1 prose plus target meta on a confirm turn, r2 empty): r3's request carries the SURFACE_MISSING repair text and toolChoice render_surface; it fails with the fix reverted.
- An empty round with no prior semantic failure still gets the PARSE hint (existing behavior kept, tested).
- `npm run check` and the tests under `packages/agent-ui/a2ui/src/agent/` pass.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 0a52a81848f6
- Changed: An empty round after a semantic repair re-sends that repair ask with its forced render instead of a PARSE hint (round 16 cluster Q)
- Commits: none
- Check: 1 A scripted-adapter case (r1 prose plus target meta on a confirm turn, r2 empty): r3 carries the S...: pass
- Check: 2 An empty round with no prior semantic failure still gets the PARSE hint (existing behavior kept, ...: pass
- Check: 3 `npm run check` and the tests under `packages/agent-ui/a2ui/src/agent/` pass: pass
- Check: 4 Lane: solo because size L2: pass
- Follow-up: note: produce.ts:2078-2086 the new empty-round guard covers only the... -> notes.md
- Follow-up: note: no red deviation lines printed by redck.py; the red run above was... -> notes.md
- Follow-up: note: no keyless replay under scripts/e2e-admin/probe/replays/ was added... -> notes.md
