---
id: T-0442
title: "A note-only reply that names a surface it never creates gets the full repair (mentalist on Haiku)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A tool-mode reply whose note or ask names a surface ("the card below", an ask surface) that the reply never creates keeps the full repair offer, and the final round refuses a note-only reply on a turn that needs a surface, so mentalist on Haiku ships its GameHud and OptionDeck instead of prose claiming them.

## Context
T-0440 live sweep (report .sdlc/tickets/.0440-live-quality-sweep/report.md, round .sdlc/evals/rounds/2026-10-24-t0440-sweep/): mentalist Haiku smoke 1 of 3 (was 3 of 3 on 2026-10-19). Opening turn ships prose naming the card with no GameHud or OptionDeck; a typed answer stays a2uiMeta-only through ACTION_NOT_APPLIED and PARSE repairs and the producer accepts it (SEMANTIC_UNCORRECTED). T-0428 kept the full repair only for a claim on an OPEN surface; this extends it to a claimed surface the reply does not create. Keyless replays from the round fixtures reproduce it.

## Constraints
Code and checks only (packages/agent-ui/a2ui/src/agent/produce.ts and its tests); no prompt text change; the :182 false-creation guard and the T-0428 rule keep holding; keyless; no live spend.

## Done when
A keyless replay test from the round fixture (pick-mentalist-answer-deck-haiku-1) shows the repair offering render_surface and a scripted surface landing; the T-0428 and :182 tests stay green; npm run check plus the a2ui agent and live-agent tests pass.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `npx vitest run scripts/e2e-admin/probe/replays/mentalist-haiku-note-claim.test.mjs` exits 0: the recorded round 1 of pick-mentalist-answer-deck-haiku-1 (note plus an ask on ask-1, no call) gets a repair round and the authored render_surface round ships the OptionDeck on ask-1 and the GameHud on hud-1, every probe check green.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/produce-narration.test.ts` exits 0: the repair round offers and forces render_surface, the last round halts or ships an earlier valid round, an ask on an open surface ships on round 1, and the T-0428 and :182 tests stay green.
- `npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent scripts/e2e-admin/probe` exits 0 with NODE_OPTIONS unset.
- `npm run check` exits 0.

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 2964486667d8
- Changed: A note-only reply that names a surface it never creates gets the full repair, refused on the last round (SURFACE_CLAIMED)
- Commits: none
- Check: 1 mentalist-haiku-note-claim replay exits 0: pass
- Check: 2 produce-narration.test.ts exits 0: pass
- Check: 3 a2ui agent, live-agent and e2e-admin probe vitest run exits 0, NODE_OPTIONS unset: pass
- Check: 4 npm run check exits 0: pass
- Follow-up: note: the four edited replays now assert a no-halt failure... -> notes.md
