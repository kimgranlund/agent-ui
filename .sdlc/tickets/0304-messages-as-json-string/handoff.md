---
id: T-0304
title: "render_surface messages sent as one JSON string fail every round: decode a string that parses as an array"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A render_surface call whose `messages` arrives as one JSON string holding an array is decoded and validated like an array, so the turn ships its surface instead of text only.

## Context
Round 7 cluster A (`.sdlc/evals/rounds/2026-10-16-r7-fails/report.md`, P1): Haiku and Sonnet sent `messages` as a JSON string on every round of a turn; each round failed to parse and the turn shipped text (:16, :95, :96). The guidance already says not to (`response-type.ts:29`, `grammar.md:194`, `produce.ts:648`), so this is a harness-side tolerance (cause (c) with a lever). Keyless replay pinned in `scripts/e2e-admin/probe/replays/`.

## Scope
`renderSurfaceJsonl` (or the tool-input decode in `produce.ts`): when `messages` is a string that parses as a JSON array, use the array and tally a code (e.g. MESSAGES_STRING_DECODED); a string that does not parse stays a PARSE failure. `grammar.md` is byte-pinned and unchanged.

## Done when
- A produce test with a stringified array ships the surface with the tally; a non-array string still fails PARSE; red at the base.
- The cluster A replay is flipped; the live-agent and probe suites and `npm run check` exit 0.

## Acceptance criteria

Rescope (Kim 2026-10-16): every recorded cluster A string (r7 :16, :95, :96 and the replay's turns 4 and 5) fails JSON.parse, one `}` short where an `updateDataModel` value meets the next `{"version"` message, so a decode alone flips nothing. The harness does not edit model output: a string that does not parse stays a PARSE round, and its repair names where it broke (`messagesParseNote`, from the JSON.parse position and the nearest message boundary, else the plain position). The replay is re-pinned with an AUTHORED round 2 that follows the repair, as T-0281 and T-0289 did; live compliance waits for the next round.

- (red) `npx vitest run packages/agent-ui/a2ui/src/agent/response-type.test.ts -t "T-0304"` exits 0: `renderSurfaceJsonl` reads a `messages` string that parses as a JSON array exactly as the array, and any other string is the empty payload, never edited; `messagesParseNote` names the message a `}` short at a message boundary, its kind and the count, else the position and the text there.
- (red) `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts -t "T-0304"` exits 0: a stringified array ships in one round tallied `MESSAGES_STRING_DECODED`; a string a `}` short is PARSE and the repair message carries the pinpointed sentence; another broken string is still PARSE.
- (red) `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-sonnet-messages-string.test.mjs` exits 0: the cluster A replay passes every check, turns 4 and 5 ship a surface on the authored round 2 with trace `{rounds: 2, failureCodes: ['PARSE']}`, and turn 4's repair request carries the pinpointed sentence.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
