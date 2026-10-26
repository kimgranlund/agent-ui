---
id: T-0468
title: "A game turn repaired after SURFACE_CLAIMED keeps its GameHud: the repair asks for the HUD with the ask deck"
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
A game turn repaired after SURFACE_CLAIMED keeps its GameHud: the repair asks for the HUD with the ask deck.

## Context
Live round 14 cluster W (`.sdlc/evals/rounds/2026-10-26-r14-pattern/report.md`; `:n` refs are lines of its `traces/2026-10-26.jsonl`):
- Cluster: W. A Twenty Questions turn answered as a meta line with no tool call ships only the claimed ask deck, or halts
- Runs: 2 failed runs: `smoke-mentalist-first-answer-haiku-1` (:7, :8), `smoke-mentalist-first-answer-haiku-3` (:82)
- Class: (c) model, with a (d) repair-path gap
- Evidence: :7 round 1 writes `{"a2uiMeta":{"note":"...Question 1 of 20: Is it a living thing?","ask":{"surfaceId":"ask-1"}}}` and prose, no tool; the SURFACE_CLAIMED repair builds `ask-1` alone (one OptionDeck), so the game never gets a GameHud and the smoke fails `expect-component`. :8 repeats it for `ask-2`. :82 round 1 is note-only with target `hud-1` (ACTION_NOT_APPLIED), round 2 is 830 output tokens with empty text and no tool call (coded PARSE), round 3 is note-only again and its SURFACE_CLAIMED on the last round halts.
- Fix layer: producer repair wording, or a games check; file: `packages/agent-ui/a2ui/src/agent/produce.ts` (the SURFACE_CLAIMED repair), the games domain checks
- Keyless test that proves it: replays of :7 and :82 (`--from-trace`) end with a GameHud on the surface, or a finding that names the missing HUD

## Constraints
The failing keyless test lands with the fix (a replay from the round 14 trace via `chat:probe --from-trace` where the cluster is model behavior). Model-read text changes follow the debate rule (Opus author, Fable review). No em dashes.

## Done when
- The keyless test named above fails before the fix and passes after.
- `npm run check` plus the touched folders' tests pass, including the probe replays.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- `npx vitest run scripts/e2e-admin/probe/replays/mentalist-haiku-claim-ask-only.test.mjs scripts/e2e-admin/probe/replays/mentalist-haiku-claim-last-round.test.mjs` exits 0: the :7/:8 replay ends turn 0 with `GAME_HUD_MISSING` tallied (rounds 3, ask-1 one OptionDeck), and the :81/:82 negative control draws no `GAME_HUD_MISSING` on its HUD opening and keeps its all-model halt. Removing `gameAskHudCheck` from `HIDDEN_STATE_CHECKS`, or the hint sentence from `SURFACE_CLAIMED_HINT`, reds the first file.
- `SURFACE_CLAIMED_HINT` in `packages/agent-ui/a2ui/src/agent/produce.ts` carries the sentence "In a game, also send the game's HUD surface beside the ask deck in this answer: create it with ONE GameHud if the game has none yet, else update the open one." (model-read text).
- `npx vitest run scripts/e2e-admin/probe packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/tools` exits 0 (every probe replay, the check contracts, the hidden-state unit tests).
- `npm run check` exits 0.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: f5b921b61d6c
- Changed: A game turn repaired after SURFACE_CLAIMED asks for the GameHud with the ask deck, and GAME_HUD_MISSING flags an ask deck with no HUD
- Commits: none
- Check: 1 `npx vitest run scripts/e2e-admin/probe/replays/mentalist-haiku-claim-ask-only.test.mjs scripts/e...: pass
- Check: 2 `SURFACE_CLAIMED_HINT` carries the sentence "In a game, also send the game's HUD surface beside t...: pass
- Check: 3 `npx vitest run scripts/e2e-admin/probe packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/s...: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:461-480... -> notes.md
