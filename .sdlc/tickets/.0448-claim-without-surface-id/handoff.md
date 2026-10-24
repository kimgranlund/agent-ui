---
id: T-0448
title: "A say reply claiming a change, or a note targeting a never-created surface, gets repaired"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
from: T-0445
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A tool-mode reply that claims a change but sends no update, or whose meta `target` names a surface that never exists, is sent back for repair instead of shipping as prose.

## Context
Round 13 clusters P1 and P2 in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445). P1: the T-0428 CHANGE_CLAIM_IN_REPLY test sits inside the `narratedMechanics` branch (`produce.ts:1987-1999`), so a claim that names no surface id never reaches it (:155, :43). P2: SURFACE_CLAIMED (T-0442) reads the meta `ask`, not `target` (:149).

## Constraints
Code and checks only, no prompt text. Keep T-0428, T-0442 and their replays green.

## Done when
- Keyless replays of :155, :43 and :149 fail before the fix and get the repair after it.
- `npm run check` plus the a2ui agent and live-agent tests and `scripts/e2e-admin/probe` tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-rename-claim-no-id.test.mjs scripts/e2e-admin/probe/replays/shopkeeper-haiku-add-claim-no-id.test.mjs scripts/e2e-admin/probe/replays/concierge-haiku-itinerary-target-claim.test.mjs` exits 0: the keyless replays of round 13 :155, :43 and :149 get the full repair and the authored round 2 lands (all three failed `action-updates-surface` before the produce.ts change).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0, with the T-0428 and T-0442 blocks unchanged and green.
- `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent scripts/e2e-admin/probe` exits 0 with NODE_OPTIONS unset.
- `npm run check` exits 0.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8c724c43552b
- Changed: A note-only reply that claims a change with no surface id, or targets a never-created surface, gets the full repair (CHANGE_CLAIMED, SURFACE_CLAIMED on target)
- Commits: none
- Check: 1 Keyless replays of :155, :43 and :149 get the full repair: pass
- Check: 2 produce-narration.test.ts exits 0 with T-0428 and T-0442 blocks unchanged: pass
- Check: 3 a2ui agent, live-agent and probe suites exit 0: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/a2ui/src/agent/produce.ts:2011 the... -> notes.md
- Follow-up: note: redck.py deviations printed no process deviation: lines; no red... -> notes.md
