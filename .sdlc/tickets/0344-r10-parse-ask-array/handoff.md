---
id: T-0344
title: "A PARSE failure on a string messages asks for an array of objects (round 10 cluster A)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0344-parse-ask-array
worktree: ../agent-ui.worktrees/wave-w344
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A turn whose `messages` arrives as a string with unbalanced brackets converges: the PARSE repair asks for `messages` as an array of objects and the turn ships its table update.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: A produce test on the :193 round 1 string: the repair request asks for an array of objects; a model-read wording change, so one short different-family challenge before build. `npm run check` plus the touched folders' tests exit 0.

## Context
Kim 2026-10-17 ruling: the repair asks for an array; the producer never edits model output (no bracket repair). produce.ts string decode (T-0304) and response-type.ts messagesParseNote. Round 10 :193, :71, :45; all 10 string messages fail at a closing-bracket boundary. Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster A.

## Constraints
None beyond AGENTS.md.

## Acceptance criteria
verifier: L3
- (red) `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts -t "T-0344"` exits 0: on the round 10 :193 round 1 string, round 2's repair request carries the new ask ("Send messages as an array of A2UI message objects, one object per entry, not as a string", messages in code quotes) directly before the unchanged messagesParseNote sentence, and no longer the old Reminder line; the turn ships on the array round, trace failureCodes PARSE.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-sonnet-messages-string.test.mjs` exits 0.
- `npm run check` exits 0.
