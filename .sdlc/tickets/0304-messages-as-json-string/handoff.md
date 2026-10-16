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
