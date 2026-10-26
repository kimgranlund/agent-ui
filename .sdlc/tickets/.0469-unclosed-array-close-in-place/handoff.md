---
id: T-0469
title: "A messages string whose only defect is one unclosed array is closed in place, and an identical resend is never sent back unchanged"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
from: T-0458
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A messages string whose only defect is one unclosed array is closed in place, and an identical resend is never sent back unchanged.

## Context
Live round 14 cluster S2 (`.sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`; `:n` refs are lines of its `traces/2026-10-26.jsonl`):
- Cluster: S2. Haiku resends a byte-identical broken `messages` string after the exact PARSE hint
- Runs: 1 failed run: `long-concierge-spa-services-haiku-1` (:33); the same unclosed `components` array opens :4, :41, :78, :121 and :144, all saved
- Class: (c) model, with a (d) repair-path question
- Evidence: :33 sends a 1,774 character string whose `components` array is still open at character 1756 on all three rounds, identical bytes, and ships SURFACE_DEGRADED with no surface. `messagesParseNote` on that string returns the exact T-0450 sentence ("a closing ] is missing in message 3 (its updateComponents): its `components` array is still open at character 1756"); the trace records only a `userDigest`, so that the sentence reached round 2's prompt is inferred, not observed.
- Fix layer: producer; file: `packages/agent-ui/a2ui/src/agent/produce.ts`, `packages/agent-ui/a2ui/src/agent/response-type.ts` (`messagesParseNote`)
- Keyless test that proves it: the :33 replay ships the spa menu; a unit test heals a string whose only defect is one named unclosed array

## Constraints
The failing keyless test lands with the fix (a replay from the round 14 trace via `chat:probe --from-trace` where the cluster is model behavior). Model-read text changes follow the debate rule (Opus author, Fable review). No em dashes.

## Done when
- The keyless test named above fails before the fix and passes after.
- `npm run check` plus the touched folders' tests pass, including the probe replays.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/agent/response-type.test.ts` exits 0; its T-0469 case heals a missing `]` and a surplus `}` before `components` closes, and leaves a truncated string, an early break and a missing `}` between messages unedited.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0, including `concierge-haiku-spa-string-unclosed.test.mjs` (the :33 replay: the identical string is closed in place, the repair shows the closed payload and names only the CATALOG defect left, and an authored round 2 ships the spa menu).
- Both T-0469 tests fail with `closedInPlace` disabled in `stringifiedMessages` and pass with it.
- `npm run check` exits 0.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: f5b921b61d6c
- Changed: A messages string broken only by a missing or surplus closer is closed in place instead of sent back for an identical resend
- Commits: none
- Check: 1 response-type.test.ts exits 0 with the T-0469 case: pass
- Check: 2 probe replays dir exits 0 including concierge-haiku-spa-string-unclosed.test.mjs: pass
- Check: 3 both T-0469 tests fail with closedInPlace disabled: pass
- Check: 4 `npm run check` exits 0: pass
