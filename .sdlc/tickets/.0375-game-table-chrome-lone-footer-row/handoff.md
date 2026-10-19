---
id: T-0375
title: "game-table-chrome teaches a Row around a lone Deal again Button, against grammar.md:188"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
verifier: L3
- The two module bodies match architect-L1-3.md Interfaces verbatim, pinned by the new `T-0375: a lone action Button carries no Row` describe (each pin was red before `assets.gen.ts` was regenerated) and the blue-sky calibration pins: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/mini-skills.test.ts packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts`
- The baseline moved only `blueSky` and the `card-game-sheet` and `game-table-chrome` mini-skill bodies, and the prompt tests are green: `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts packages/agent-ui/a2ui/src/live-agent/domain-guidance.test.ts packages/agent-ui/a2ui/src/live-agent/a2ui-surface-toggle.test.ts packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts`
- Registry, site budget and the croupier replays stay green, and no recorded round changed: `npx vitest run packages/agent-ui/a2ui/tools/registry/generate.test.ts site/pages/agent-admin-prompt-budget.test.ts scripts/e2e-admin/probe/replays/croupier- scripts/e2e-admin/probe/replays/smoke-croupier-blackjack-deal-haiku`
- grammar.md and the replay fixtures are untouched: `git diff --quiet HEAD -- packages/agent-ui/a2ui/src/agent/prompts/grammar.md scripts/e2e-admin/probe/replays`
- `npm run check`

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 62e95c5e0a98
- Changed: Mini-skills stop teaching a Row around a lone action Button (#2157)
- Commits: none
- Check: 1 The two module bodies match architect-L1-3.md Interfaces verbatim, pinned by the new `T-0375: a l...: pass
- Check: 2 The baseline moved only `blueSky` and the `card-game-sheet` and `game-table-chrome` mini-skill bo...: pass
- Check: 3 Registry, site budget and the croupier replays stay green, and no recorded round changed: pass
- Check: 4 grammar.md and the replay fixtures are untouched (`git diff --quiet HEAD -- packages/agent-ui/a2u...: pass
- Check: 5 `npm run check`: pass
- Follow-up: note: site/agent-content/personas/croupier/agent.md:60 the persona line... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:370... -> notes.md
- Follow-up: note: packages/agent-ui/a2ui/src/agent/prompts/mini-skills/game-table-chr... -> notes.md
- Follow-up: note: .claude/docs/adr/0172-persona-catalog-composition-intake.md:110... -> notes.md
