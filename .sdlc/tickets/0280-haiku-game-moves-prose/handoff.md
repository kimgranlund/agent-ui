---
id: T-0280
title: "Haiku answers word guesses, give-ups and the Omaha river in prose with no board update, and no check sends them back"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Haiku game move that should update an open board (a word guess, a give-up, a poker street) but answers in prose only is sent back, the way an Admiral shot is.

## Repro
`npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-guess-prose.test.mjs` (keyless, pinned). Live: `.sdlc/evals/rounds/2026-10-15-r4-fixes/`traces :87-:89, :91-:95, :120-:123 (Lexicographer), :52-:55 (Omaha), :67 (stud).

## Expected
Each guess updates the BoardGrid, the give-up ships a ResultCard, and each Omaha street updates the table, or a repair round makes it.

## Actual
Haiku answers every Lexicographer guess in prose with a `target` on the board and no update, and says "I've put the result on the board" (:89). Give-ups ship no ResultCard (prose at :89 and :94, a hand-built Card at :122). Omaha streets update only a Text (:52-:54) and the river ends in prose with no surface (:55). No check fires on any of these turns: 0 codes. On seven-card stud (:67) ACTION_NOT_APPLIED fired and counted as saved, but the retry updated only the actions Row while the reply dealt fifth street in prose, so `action-updates-surface` failed t1. Sonnet passes the same scenarios (3 of 3 Lexicographer runs).

## Context
T-0265 covered openings, Admiral shots and Concierge turns, and ACTION_NOT_APPLIED covers typed Croupier moves at a table with move buttons. A word guess and a typed poker street have no detector. RESULT_CARD_MISSING does not fire on a prose give-up or on a hand-built Card. Found by T-0275.

## Done when
- A checks test: a guess or give-up say turn targeting the word board with no update is sent back; an updating guess passes.
- The replay is recaptured; `npx vitest run scripts/e2e-admin/probe` and `npm run check` exit 0.

## Lane bundle
This solo lane delivers these tickets in order, one commit each (`T-NNNN: <title>`):
- .sdlc/tickets/0280-haiku-game-moves-prose/handoff.md
- .sdlc/tickets/0284-admiral-haiku-no-gamehud/handoff.md

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts` exits 0: the T-0280 word-move-applied block sends back a prose-only guess and give-up targeting word-forge (ACTION_NOT_APPLIED), a give-up with a hand-built Card (RESULT_CARD_MISSING), and passes an updating guess and a ResultCard give-up.
- `npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-guess-prose.test.mjs` exits 0, pinned to ACTION_NOT_APPLIED on turns 1 and 3.
- `npx vitest run scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
