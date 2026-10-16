---
id: T-0290
title: "A booking form built as a feed ask: FEED_SCOPE and BOOKING_FORM_MISSING push opposite ways and the SURFACE_DROPPED halt leaks the ask id"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Haiku booking ask ships its BookingForm as an ordinary surface: no FEED_SCOPE ping-pong, no halt, no surface id in the guest's chat.

## Repro
Keyless: `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-feed-ask-halt.test.mjs` (pinned, `// expectedFail: T-0290`). Live: `.sdlc/evals/rounds/2026-10-15-r5-fixes/` traces :54-:55, :16-:17, :21-:22.

## Expected
The booking turn ships one pre-filled BookingForm.

## Actual
Haiku builds the form on a feed ask (`"ask":{"surfaceId":"ask-1"}`). FEED_SCOPE rejects BookingForm there; round 2 answers with a meta-line only; round 3 gets SURFACE_DROPPED and the turn halts with "produce: no valid surface within the round bound (SURFACE_DROPPED at ask-1)" shown to the guest (:55, no-internal-leak fails). On :22 BOOKING_FORM_MISSING sends back the hand-built form Haiku made to fit the feed subset, then FEED_SCOPE sends back the BookingForm; uncorrected. On :17 the last round ships a read-back Card, which the persona forbids.

## Context
Fog report `4095416195875afe423e60ea`, decision d2, finding f3 (T-0287). T-0281 added SURFACE_DROPPED; its hint ("leave ask out of your meta-line") arrives only on the last round, and FEED_SCOPE goes back through the generic re-emit wording (`packages/agent-ui/a2ui/src/agent/produce.ts`). The grammar's "present the proposed outcome ... as an ORDINARY ask" is the likely pull toward the ask (a guess). The halt text is `ProduceHalt` (produce.ts:459).

## Constraints
The failing test lands before or with the fix.

## Acceptance criteria
verifier: L3
- `npx vitest run scripts/e2e-admin/probe/replays/concierge-haiku-feed-ask-halt.test.mjs` exits 0: the booking turn ships one BookingForm with no ask, no halt and no failed probe check (round 2 AUTHORED to the FEED_SCOPE hint, as T-0281 did).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts packages/agent-ui/a2ui/src/live-agent/turn-deadline.test.ts` exits 0: the FEED_SCOPE repair says to keep the surface whole as an ordinary one, and a halt's user line names its codes with no surface id.
- `npx vitest run packages/agent-ui/a2ui/tools scripts/e2e-admin/probe site/lib/admin-live-runner.test.ts` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-15 · lane: full L2 · verdict: closed by reason (Merged in #2052 (round 5 Concierge fixes); verifier pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
