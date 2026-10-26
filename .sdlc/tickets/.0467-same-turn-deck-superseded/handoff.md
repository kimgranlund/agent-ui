---
id: T-0467
title: "A surface created earlier in the same turn is not superseded, so an ask deck sent before its HUD stays answerable"
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
A surface created earlier in the same turn is not superseded, so an ask deck sent before its HUD stays answerable.

## Context
Live round 14 cluster X (`.sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`; `:n` refs are lines of its `traces/2026-10-26.jsonl`):
- Cluster: X. An ask deck created before another surface in the same turn is superseded and its press sends nothing
- Runs: 1 failed run: `pick-mentalist-answer-deck-haiku-1` (:117)
- Class: (d) host lifecycle
- Evidence: :117 creates `ask-1` (the OptionDeck) first and `hud-1` second in one `messages` array; the passing :131 and :146 create `hud-1` first. The probe presses "Yes" in `ask-1`, no produce request follows (`click-target` fail); the turn-2 screenshot shows the deck dimmed. A keyless replay of the run's `fixture.json` fails the same way. Source: `conversation.ts:1080-1088` (GH #1164) supersedes every other open surface when a new one mounts, including one created earlier in the same turn.
- Fix layer: host, or producer; file: `packages/agent-ui/app/src/controls/conversation/conversation.ts` (the superseded sweep), or a producer check that the turn's `ask` surface is created last
- Keyless test that proves it: the :117 replay (`npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r14-pattern/runs/pick-mentalist-answer-deck-haiku-1/fixture.json`) passes `click-target`

## Constraints
The failing keyless test lands with the fix (a replay from the round 14 trace via `chat:probe --from-trace` where the cluster is model behavior). Model-read text changes follow the debate rule (Opus author, Fable review). No em dashes.

## Done when
- The keyless test named above fails before the fix and passes after.
- `npm run check` plus the touched folders' tests pass, including the probe replays.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/app/src/controls/conversation/` exits 0; its case `T-0467: two surfaces minted in the SAME turn both stay live` fails when the sweep in `conversation.ts` goes back to `otherId !== id`.
- `npm run check` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0.
- The browser replay of the :117 fixture (`npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-26-r14-pattern/runs/pick-mentalist-answer-deck-haiku-1/fixture.json`) no longer reports `click-target`; its remaining turn-2 fails (`action-updates-surface`, `expect-component`) are the fixture having no recorded turn-2 answer, since the live run never sent one.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: f5b921b61d6c
- Changed: A surface created earlier in the same turn is not superseded, so an ask deck sent before its HUD stays answerable
- Commits: none
- Check: 1 conversation vitest exits 0 and the T-0467 case goes red when the sweep reverts: pass
- Check: 2 `npm run check` exits 0: pass
- Check: 3 `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0: pass
- Check: 4 browser replay of the :117 fixture no longer reports `click-target`, remaining fails are only the...: pass
- Follow-up: note: the old same-turn jsdom case was replaced rather than kept, and the... -> notes.md
- Follow-up: note: packages/agent-ui/app/src/controls/conversation/conversation.ts:108... -> notes.md
