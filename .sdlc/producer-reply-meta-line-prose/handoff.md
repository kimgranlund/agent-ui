---
id: T-0213
title: "A meta-line written into render_surface reply shows as raw JSON in the chat"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A `render_surface` reply that carries a meta-line is read as a meta-line (note, ask), never shown to the player as JSON.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-stud-bet-table-missing.test.mjs`, then read the derived note of turn 1, or open `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/seven-card-stud-haiku-1/turn-1.png`.

## Expected
The chat shows "Seven-card stud it is..." and the ask is declared on ask-2.

## Actual
The chat shows the raw text `{"a2uiMeta":{"note":"Seven-card stud it is. ...","ask":{"surfaceId":"ask-2"}}}`. The third round's `render_surface` input had that whole meta-line as its `reply` (trace 2026-10-15.jsonl:49). `no-json-as-prose` passed because its patterns only match A2UI message keys.

## Context
Guess: `produce()` uses `reply` verbatim as the note (T-0194). Fix both sides: read a meta-line in `reply` (or strip it), and add the `{"a2uiMeta"` shape to the probe's `A2UI_IN_PROSE` patterns (`scripts/e2e-admin/probe/model.ts`). Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/produce-response-type.test.ts` exits 0: a meta-line written as the `render_surface` reply ships as its note and ask, never as JSON.
- (red) `node scripts/chat-probe.mjs selftest` exits 0: a `{"a2uiMeta"` shape in chat prose fails `no-json-as-prose`.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-stud-bet-table-missing.test.mjs` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-14 · lane: full L1 · verdict: closed by reason (Merged in #1997; batched lane verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
