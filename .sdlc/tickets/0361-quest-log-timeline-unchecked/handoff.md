---
id: T-0361
title: "A quest log with no Timeline gets no repair round"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0358]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Dungeon Master turn that lists its scenes as a Column of Texts instead of the Timeline the `quest-log` skill names gets a repair round asking for ONE Timeline, so `smoke-dungeon-master-first-scene-haiku` loses its run-level `missing Timeline` failure.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs`
2. The replay is pinned (`// expectedFail: T-0361`) to run-level `expect-component` `missing Timeline` (and turn 1, see T-0362).

## Expected
A hand-built scene log (a Column of numbered scene Texts on a quest surface) yields a producer finding whose repair asks for a Timeline of TimelineItems, and a compliant answer ships a Timeline.

## Actual
Live smoke round `.sdlc/evals/rounds/2026-10-18-smoke/` (Haiku 5.5, `traces/2026-10-18.jsonl:23`): the quest log listed scenes as `scenes` Column > `s1` Text "1. The stair down...". No check names Timeline, so no turn is sent back. T-0358 left this half of the oracle red.

## Context
Found by T-0358 (code review asked for no Timeline in the authored GameHud repair). Guess: a `COMPOSITE_MOMENTS` row cannot carry it as is (Timeline is a layout type, not a selection.json composite), so it may need its own semantic check or a mini-skill change. A wording change follows skill `a2ui-prompt-authoring` and the debate rule.

## Constraints
The failing test lands before or with the fix, never after. Flip the replay pin in the fix's change (`scripts/e2e-admin/README.md`, Fixtures and regressions).

## Acceptance criteria
verifier: L3

- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs` exits 0: turn 0 carries GAME_HUD_MISSING and TIMELINE_MISSING into its authored round 2, which ships ONE Timeline, so the run-level `missing Timeline` failure is gone; turn 1 stays pinned to T-0362.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the recorded quest log yields TIMELINE_MISSING, and the order history, changelog, chat history, adventure itinerary, quest inventory and quiz question negatives yield none, each guard shown to bite.
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts packages/agent-ui/a2ui/src/live-agent/chat-validation.test.ts` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/` exits 0: no other replay changes.
- `npm run check` exits 0.
