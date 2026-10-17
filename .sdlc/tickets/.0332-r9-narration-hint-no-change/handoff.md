---
id: T-0332
title: "NARRATION_HINT leaves the surface as it is when the reply needs no change (round 9 cluster E)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A narration repair on a turn that needed no surface change does not deal a new round.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A produce replay of :182 that keeps table-2 settled with Deal again; red first. This changes model-read text: the debate rule applies to the wording (one short challenge is enough for a one-line hint). `npm run check` plus the touched folders' tests exit 0.

## Context
produce.ts:1136-1140 NARRATION_HINT. Round 9 :182 (blackjack-moves-sonnet): "Hit me again." after a bust; the repair opened table-3. report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster E. Note: NARRATED_MECHANICS fires rose 2 to 14 with no code change; that is open and needs a 5-sample rerun, not this ticket.

## Constraints
None.

## Outcome

2026-10-17 · lane: full L1 · verdict: pass · verifier: verifier-L3 (fable) · base: c4a66490a692
- Changed: A narration-only failure ships the round's surfaces and rewords the reply in one text-only call (#2094)
- Commits: 2564938 T-0332: record lane wave-w332
- Check: 1 A produce replay of :182 that keeps table-2 settled with Deal again; red first: pass
- Check: 2 This changes model-read text: the debate rule applies to the wording (one short challenge is enough): pass
- Check: 3 `npm run check` plus the touched folders' tests exit 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/agent/produce.ts:1907-1917 note-only... -> notes.md
- Follow-up: fix-now: .claude/docs/spec/response-type-selection.spec.md:143 AC3e now... -> notes.md
- Follow-up: note: scripts/e2e-admin/probe/replays/croupier-haiku-surface-id-in-reply.... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent/produce.ts:683 "Send only your... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent/produce.ts:1529-1554... -> notes.md
