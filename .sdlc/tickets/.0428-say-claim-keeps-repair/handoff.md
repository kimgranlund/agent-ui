---
id: T-0428
title: "A note-only say reply that claims a change on an open surface keeps the full repair"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
On a tool-mode say turn, a note-only reply whose prose claims a change on an open surface (names a live surface id or its content) keeps the full repair offer (render_surface and the update tools) instead of shipping with no surface change and a reworded reply that still claims the change.

## Context
Overnight decision 2026-10-23 on notes.md:184 (Kim's goal delegates decisions): keep the full repair for a claimed change; the :182 false-creation guard stays for prose that claims nothing.
decide: `packages/agent-ui/a2ui/src/agent/produce.ts:1907-1917` (note-only branch): a tool-mode say turn answered in prose that claims a change on an open surface and names its id, with no payload and no semantic finding, now ships with no surface change and a reworded reply that still claims it. Observed in a throwaway worktree at HEAD with the croupier checks on: intent "Rename the table to Kim's table and show my chips as euros.", round 1 `Done: table-3 is now titled Kim's table...` with no call; the repair call offered no tool (`round2 tools undefined`), the scripted model's updateComponents for table-3 could not land, wire `[]`, note `Done: the table is now titled Kim's table and your chips show as euros.`, trace `["NARRATED_MECHANICS"]`. Before this change the full repair offered `render_surface`. Typed moves, clicks and openings are caught first by `typedMoveFindings`/ACTION_NOT_APPLIED/SURFACE_MISSING, so this is the one path where a needed update is silently lost: a prose claim no persona check names. Either accept the trade (the :182 false creation was the worse failure) or add a check that a note-only narrated reply on a say turn with a `target`-less claim of change keeps the full repair. -> Kim's ruling (triage 2026-10-23)

## Constraints
The :182 false-creation fix stays: a say reply that claims no change must not be pushed into a surface. No prompt text change (model-read text follows the debate rule); code and checks only. Keyless; no live spend.

## Done when
A keyless produce test reproduces the croupier "Rename the table to Kim's table and show my chips as euros." case: round 1 prose claims the change with no call, the repair round offers the update tools, and a scripted update lands; the :182 regression test stays green. npm run check plus the a2ui agent and live-agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- The croupier rename repro (round 1 `Done: table-3 is now titled Kim's table...` with no call) gets a repair round that offers `render_surface`, and the scripted table-3 update ships; the :182 reply-only repair stays for prose that claims no change: `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0.
- The a2ui agent and live-agent tests pass: `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent` exits 0.
- The standing gate passes: `npm run check` exits 0.

## Outcome

2026-10-23 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 7dc53d16ae2f
- Changed: A note-only say reply that claims a change on an open surface keeps the full repair, so the update can land
- Commits: none
- Check: 1 Croupier rename repro gets a repair round offering render_surface and the table-3 update ships; t...: pass
- Check: 2 a2ui agent and live-agent tests pass: pass
- Check: 3 Standing gate: pass
- Follow-up: note: produce.ts:1245 CHANGE_CLAIM_IN_REPLY is a keyword regex gated on... -> notes.md
