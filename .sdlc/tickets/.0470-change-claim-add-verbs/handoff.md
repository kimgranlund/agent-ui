---
id: T-0470
title: "CHANGE_CLAIM_IN_REPLY covers an add claim (added, comes to)"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
from: T-0458
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
CHANGE_CLAIM_IN_REPLY covers an add claim (added, comes to).

## Context
Live round 14 cluster P3 (`.sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`; `:n` refs are lines of its `traces/2026-10-26.jsonl`):
- Cluster: P3. A say reply that claims an add ("Added ...", "comes to") ships with no update
- Runs: 1 failed run: `reach-shopkeeper-cart-amount-haiku-2` (:138)
- Class: (d) check gap
- Evidence: :138 meta `{"note":"Added two Brass Arc Floor Lamps at $189 each, so your order comes to $378. Adjust the quantity below any time.","target":{"surfaceId":"storefront-1"}}`, no tool call, rounds 1, codes none. The T-0448 regex matches "is now" and "updated", not "added"; round 13's P1 row named "Added" as a miss. T-0456's `shopkeeper-haiku-add-claim-no-id` replay guards the "is now" wording only.
- Fix layer: producer; file: `packages/agent-ui/a2ui/src/agent/produce.ts` (`CHANGE_CLAIM_IN_REPLY`)
- Keyless test that proves it: a replay of :138 gets a CHANGE_CLAIMED round with render_surface offered

## Constraints
The failing keyless test lands with the fix (a replay from the round 14 trace via `chat:probe --from-trace` where the cluster is model behavior). Model-read text changes follow the debate rule (Opus author, Fable review). No em dashes.

## Done when
- The keyless test named above fails before the fix and passes after.
- `npm run check` plus the touched folders' tests pass, including the probe replays.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: f5b921b61d6c
- Changed: CHANGE_CLAIM_IN_REPLY also catches add claims (added, comes to) that ship with no update
- Commits: none
- Check: 1 The keyless test named above fails before the fix and passes after: pass
- Check: 2 `npm run check` plus the touched folders' tests pass, including the probe replays: pass
- Check: 3 Lane: solo because size L1: pass
- Follow-up: note: packages/agent-ui/a2ui/src/agent/produce.ts:1263 ?:^|.!:\sadded\b... -> notes.md
