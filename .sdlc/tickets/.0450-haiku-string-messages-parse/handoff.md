---
id: T-0450
title: "Haiku invalid-JSON-string payloads recover instead of degrading"
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
A Haiku turn that sends `messages` as an invalid JSON string, or as text, is recovered by the repair path more often, measured on the round 13 cells.

## Context
Round 13 cluster S in .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md (round 13, T-0445): 16 PARSE rounds on 13 turns, 10 saved (round 12: 3, all saved); 11 string `messages` rounds. :145 fails all three rounds and ships SURFACE_DEGRADED; :13 and :50 also fail.

## Constraints
Diagnose first: name whether the cause is the tool schema, the repair message, or the model, with trace evidence. A prompt text change follows the debate rule.

## Done when
- The three replays (:13, :50, :145) reproduce the failure keylessly, and the fix makes them recover or the report names why it cannot.
- `npm run check` plus the a2ui agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
verifier: L3
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-deck-string-unclosed.test.mjs scripts/e2e-admin/probe/replays/concierge-haiku-confirm-text-unclosed.test.mjs scripts/e2e-admin/probe/replays/concierge-haiku-confirm-string-unclosed.test.mjs` exits 0: each recorded turn (:145, :13, :50) replays verbatim and still fails its expect; its repair request names the open `components` array ("a closing ] is missing ... its `components` array is still open at character N, where a } comes instead"), a string round's assistant turn carries the string as sent; an authored round that puts the one `]` back ships the OptionDeck or ConfirmReceipt. Red before the fix (pinpoint and assistant-turn assertions).
- `npx vitest run packages/agent-ui/a2ui/src/agent/response-type.test.ts packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` exits 0, with the T-0450 cases (exact pinpoint sentences; the repair assistant turn is the reply then the sent string).
- `npm run check` exits 0, and `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent scripts/e2e-admin/probe` exits 0 (NODE_OPTIONS unset).

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 8c4b9fe101bc
- Changed: A PARSE repair names the exact unclosed array and its character position, and the repair turn shows the model what it sent
- Commits: none
- Check: 1 `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-deck-string-unclosed.test.mjs scri...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/agent/response-type.test.ts packages/agent-ui/a2ui/src...: pass
- Check: 3 `npm run check` exits 0, and `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a...: pass
- Follow-up: note: scripts/e2e-admin/probe/replays/unclosed-array.mjs:12 the recovery... -> notes.md
