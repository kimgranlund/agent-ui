---
id: T-0365
title: "Board-less GameHud check misses a stat strip of uncued Badges or Texts"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0358]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
GAME_HUD_MISSING fires on the board-less stat strips a live Haiku 5.5 built in round `.sdlc/evals/rounds/2026-10-18-t0362-smoke/`, so the first round of a Mentalist or Dungeon Master turn is sent back for its GameHud.

## Repro
1. `npx vitest run --project scripts scripts/e2e-admin/probe/replays/smoke-mentalist-first-answer-haiku.test.mjs scripts/e2e-admin/probe/replays/smoke-dungeon-master-first-scene-haiku.test.mjs`
2. Both are pinned `// expectedFail: T-0365`: no recorded round of Mentalist turns 0 and 1 or Dungeon Master turn 0 gets GAME_HUD_MISSING.

## Expected
The GameHud row's board-less `statStrip` (`packages/agent-ui/a2ui/src/catalog/composite-moments.ts`) reads these strips as a hand-built score and status strip.

## Actual
The row needs two components of type Badge, Stat or Progress whose words match its cue (`hp`, `gold`, `questions`, ...):
- Mentalist (traces 1 and 2): a Badge "Q1 of 20" (no cue word), a Progress "Questions spent" (one hit) and a Text "Confidence: low" (Text is not a strip type). One hit, so the row stays silent; the turn's only retry is FEED_SCOPE on `ask-1:Progress`.
- Dungeon Master turn 0 (trace 5): round 1 shows "HP 12 / 12" and "Gold 0" as Texts in a Row, so only TIMELINE_MISSING fires. Round 3 rebuilds them as Badges, which the row would catch, but at the 3-round bound it can only tally SEMANTIC_UNCORRECTED.

## Context
Found by T-0362's live re-record (Haiku 5.5, $0.04). Cause class (d), a check gap: the `game-hud` mini-skill was in the turn 0 prompt and the model still hand-built the strip. A guess, to settle in the fix: count a `N of M` counter as a cue, and admit Text as a strip type when a Row holds two or more cued Texts. Widening the row must keep the CardTable stand-aside and the T-0358 negative cases green. When this lands, rerun the two replays and flip or re-pin their turns.

## Constraints
The failing test lands before or with the fix, never after. Recorded rounds are never hand-edited.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the recorded Mentalist ("Q1 of 20" Badge, "Questions spent" Progress, "Confidence: low" Text) and Dungeon Master (HP and Gold Texts in a Row) strips yield GAME_HUD_MISSING and none with a GameHud; a Badge and Text mix, a stat Text in a single-child wrapper, one Text or Badge naming two stats, and the slash and spaced counters ("Q1/20", "Q 1 of 20", "Round 2/5", "Guess 3/6") fire; a bare "3 of 6" or "3/6", narration naming gold and HP, stat Texts split across two groups, game-worded KPI, loyalty and receipt strips, and the hiring, workout and survey strips whose only game word is a counter yield none, each guard shown to bite; the T-0358 negative controls and the CardTable stand-aside stay green.
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0: the Mentalist smoke replay is flipped to `toEqual([])` through an appended authored round 3 per turn (recorded rounds untouched), and the Dungeon Master pin keeps its list with its comment updated.
- `npm run check` exits 0.
