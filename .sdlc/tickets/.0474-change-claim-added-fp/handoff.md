---
id: T-0474
title: "CHANGE_CLAIM_IN_REPLY does not fire on a non-claim 'Added fees'"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
A sentence-initial 'Added' that is not an add claim ('Added fees may apply.') does not trigger CHANGE_CLAIMED.

## Context
T-0470 verifier note: `packages/agent-ui/a2ui/src/agent/produce.ts:1263` `(?:^|[.!:]\s*)added\b` matches 'Added fees may apply.'. Wave 2.

## Constraints
Keep every T-0470 replay green. No em dashes.

## Done when
- A unit case for 'Added fees may apply.' passes; the T-0470 add-claim replay still flags.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L1 (steps.py lane)

## Outcome

2026-10-26 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 215357f24670
- Changed: CHANGE_CLAIM_IN_REPLY no longer fires on a sentence-initial non-claim Added (Added fees may apply.)
- Commits: none
- Check: 1 A unit case for 'Added fees may apply.' passes; the T-0470 add-claim replay still flags: pass
- Check: 2 `npm run check` plus the touched folders' tests pass: pass
