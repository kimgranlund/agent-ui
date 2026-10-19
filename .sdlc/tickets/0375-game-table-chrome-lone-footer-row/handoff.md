---
id: T-0375
title: "game-table-chrome teaches a Row around a lone Deal again Button, against grammar.md:188"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
On every turn that loads card-game-sheet or game-table-chrome, the composed prompt teaches that a lone action Button (a settled hand's Deal again) carries no Row, two or more share one Row, and the action bar rides the CardFooter of the Card that holds the hands, never a separate actions Card.

## Intent
- Do: reword `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-table-chrome.md` and `packages/agent-ui/a2ui/src/agent/prompts/mini-skills/card-game-sheet.md` (the action-bar clause, the root cause on the r11 stud turns), with their pinned tests in `mini-skills.test.ts` and the composed-prompt tests, so a CardFooter with one action Button holds it directly (grammar.md:188), and a Row of Buttons only when there are two or more; recapture the prompt-equivalence baseline through the a2ui-prompt-authoring flow; regenerate assets.
- Non-goals: the LONE_BUTTON_FRAME check (T-0369 shipped it).
- Done when: the debate ran (Opus architect proposes the wording, a fable plan-reviewer challenges it); `npm run check`, the prompt-equivalence and system-prompt tests and the croupier replays exit 0; recorded rounds unchanged.

## Context
Found by the T-0369 code review: the teaching "CardFooter = Row of action Buttons" sits beside a settled state with one Deal again Button, against grammar.md:188 ("A footer with exactly one action Button skips the Row"). Kim ruled 2026-10-18: ticket it and run the debate. Conductor call 2026-10-18: scope widened to card-game-sheet.md after the architect showed game-table-chrome was not loaded on the failing r11 turns (:159-:164). The rule is at grammar.md:188 (the :179 cite was stale).

## Constraints
Model-read text: debate rule applies. grammar.md unchanged.
