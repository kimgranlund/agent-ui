---
id: T-0366
title: "A board-less game turn answered in prose alone passes the producer"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0358]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A say turn that plays a move on an open board-less game surface (the Negotiator's offer, the Dungeon Master's action) and sends it no update is sent back with a retry instead of passing the producer.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs`
2. Both are pinned `// expectedFail: T-0366` on turn 1: `action-updates-surface` and `expect-component` fail, and the turn's trace is one round with no failure code.

## Expected
The producer catches the prose-only answer as it does for the fleet and word games (ACTION_NOT_APPLIED in `packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts`) and the retry updates the targeted surface: the new price and mood on the Negotiator's GameHud, the new scene on the Dungeon Master's quest log.

## Actual
In round `.sdlc/evals/rounds/2026-10-18-t0362-smoke/` (Haiku 5.5), "I offer 20." (trace 4) and "I open the door and step inside." (trace 6) were each answered in one round with a reply, an `a2uiMeta.target` naming the open surface (`deal-1`, `quest-log`) and no `render_surface` call. The producer passed both, so the HUD still shows the old price or scene.

## Context
Found by T-0362's live re-record. Cause class (d), a check gap: ACTION_NOT_APPLIED exists only for Battleship and the word game (`fleetShotAppliedCheck`, `wordMoveAppliedCheck`, `fleetConcedeCheck`) and the Concierge's BookingForm (`personas/concierge/checks.ts`); the negotiation and quest presets have no applied-move check. Any new retry message is model-read text under skill `a2ui-prompt-authoring`.

## Constraints
The failing test lands before or with the fix, never after. Recorded rounds are never hand-edited.

## Acceptance criteria
verifier: L3
- `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` exits 0: the T-0366 block sends back the recorded prose-only "I offer 20." on deal-1 and "I open the door and step inside." on quest-log with ACTION_NOT_APPLIED, passes an updating move, a question, a rules ask, small talk, a turn with no target, and stands aside for a board, a word game and a shop surface; the new check carries its contract fixtures.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0: the two smoke replays pin turn 1 to `ACTION_NOT_APPLIED, SEMANTIC_UNCORRECTED` (the fixtures record no repaired round, so their probe checks stay red), and no other replay changes.
- `npm run check` exits 0.
