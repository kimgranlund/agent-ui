---
id: T-0383
title: "conversation.browser.test.ts: 4 resumed-bubble and composed-path reds"
type: bug             # feature | bug | chore | spike | idea
status: claimed        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-20
claimed_by: claude:a8ce3b21 2026-10-21
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
The 4 failing tests in `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts` pass in chromium and webkit, fixed at the cause (code or a stale test), never loosened.

## Repro
1. `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts`

## Expected
Exit 0.

## Actual
4 failures (2 tests x 2 engines): "TKT-0079: a RESUMED turn's bubble stays visible throughout" ("precondition: the first turn revealed its bubble") and "a real A2UI stream through beginAgentTurn()/ingestLine() mounts a real ui-button ..." ("bubble collapsed to zero width: expected 0 to be greater than 1").

## Context
Found by T-0374 step 8 (2026-10-20). Already red at 819418d62, before T-0374 step 1, so not caused by T-0374. Not on CI (CI runs no browser shards). T-0382 (#2173) later touched the resumed-turn textDelta path in conversation.ts; check it did not change the picture. Kim ruled 2026-10-20: ship T-0374 and file this separately.

## Constraints
The failing tests are the red; fix the cause.
- Lane: solo because size L2 (steps.py lane); fanout 2026-10-21

## Acceptance criteria
- `env -u NODE_OPTIONS npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts` exits 0 in chromium and webkit.
- The two tests are fixed at the cause: both relied on the pre-T-0194 message tally revealing a card-only bubble; they now give the turn the reply line T-0194 makes every surface turn carry, with no assertion removed or weakened.
- The stale GH #313 / TKT-0079 reveal comment in `conversation.ts` matches GH #1221 and T-0194.
- `npm run check` exits 0.
