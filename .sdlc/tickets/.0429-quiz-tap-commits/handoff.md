---
id: T-0429
title: "A quiz answer commits on tap: QuestionCard drops Check answer"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
On ui.nonoun.io the quizmaster's QuestionCard answer commits on tap: picking an option sends the answer as the round's action (the next turn reads it and reveals), with no in-card "Check answer" Button, matching the T-0419 single-pick ruling for every persona.

## Intent
- Do: QuestionCard (packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.ts, catalog.json, selection.json) emits the answer action on pick; the quizmaster persona (site/agent-content/personas/quizmaster/agent.md and its skills), any quiz mini-skill, exemplar, corpus record, check, seed, replay fixture and e2e flow that teach or expect the Check answer Button move to tap-commits; a disabled or revealed card commits nothing.
- Non-goals: other personas; OptionDeck itself.
- Done when: a keyless replay or e2e flow shows a quiz pick sending the answer and the next round revealing; npm run check plus the touched folders' tests pass; a screenshot of the real card is the look evidence.

## Context
Kim 2026-10-23 (screenshot): "gets stuck, nothing happens after selection". Live quiz on ui.nonoun.io: QuestionCard rendered Science, Round 1 of 3, four options, no Check answer Button; the pick marks Gd and nothing is sent. Root cause: the QuestionCard answer reaches the agent only through its in-card Check answer Button (persona changelog v4, T-0082, ADR-0243 Amendment 1), and T-0419's grammar (grammar.md:164-165) now tells every persona a single pick has no Button, so the model drops it. Kim chose: tap commits the answer (2026-10-23).

## Constraints
Model-read text follows the debate rule (Opus architect, fable plan-reviewer). grammar.md stays as T-0419 left it unless the design proves a line must move. Baseline and budget moves follow skill a2ui-prompt-authoring's deliberate flow. Keyless; no live spend.

## Debate
- Architect ask (2026-10-23): design QuestionCard tap-commits end to end: the factory's action (name, context shape, guard while revealed or disabled), catalog and selection edits, every persona, skill, exemplar, corpus, check, seed, probe and replay that expects Check answer, with exact text for model-read edits; prototype keyless and list risks.
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21
- Plan-reviewer ask (2026-10-23): challenge architect-L1.md: is QuestionCard tap-commit sound (action name and context, guards while revealed or disabled, double taps), is every model-read edit (persona, skills, exemplars, corpus) right and complete so no retrieved text still teaches Check answer, do checks, seeds, replays and baselines move correctly; replay and report pass, replan or blocked.
- Plan review 2026-10-23: pass (plan-reviewer-L1.md); the builder folds its notes-fixes.

## Acceptance criteria
- A QuestionCard pick commits through its required `actionName` (a fresh pick, a re-press of the picked row and Space each send one action with the picked value; Enter on an unpicked row, an arrow key, a revealed card and a card with no `actionName` send nothing), and the catalog row declares the prop: `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/quizmaster` exits 0.
- The keyless replays show the round: the smoke round repairs CATALOG qcard.actionName, and in the new fixture a pick on Canberra sends the `answer` action and the next turn rewrites the card revealed with one Next question Button: `npx vitest run scripts/e2e-admin/probe/replays/quizmaster-pick-reveals.test.mjs scripts/e2e-admin/probe/replays/smoke-quizmaster-first-question-haiku.test.mjs` exits 0.
- Both quizmaster seeds carry `actionName` and no Check answer Button, and the v7 persona, its manifest and the seed pins agree: `npx vitest run packages/agent-ui/a2ui/src/examples site/pages/agent-admin-seed-digests.test.ts site/pages/agent-admin-presets.test.ts site/lib/agent-manifest site/agent-content` exits 0.
- The generated agent-content registries are fresh: `node scripts/generate-agent-content.mjs --check` exits 0.
- The open seed card ends at its options with the 13px block inset: `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/catalog/personas` exits 0.
- The standing gate passes: `npm run check` exits 0.
- The look evidence is in the ticket folder: the open card with no Check answer Button (the ruling, not a mockup miss) and the revealed card with its Next question Button, from the keyless browser replay: `test -s .sdlc/tickets/0429-quiz-tap-commits/shots/replay-turn-2-revealed.png` exits 0.

## Outcome

2026-10-23 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: b1646add4286
- Changed: A quiz answer commits on tap: QuestionCard requires actionName and sends the pick on click or Space; no Check answer button
- Commits: none
- Check: 1 A QuestionCard pick commits through its required `actionName` (fresh pick, re-press, Space send o...: pass
- Check: 2 The keyless replays show the round (smoke repairs CATALOG qcard.actionName; the new fixture's Can...: pass
- Check: 3 Both quizmaster seeds carry `actionName` and no Check answer Button, and the v7 persona, manifest...: pass
- Check: 4 The generated agent-content registries are fresh: pass
- Check: 5 The open seed card ends at its options with the 13px block inset: pass
- Check: 6 The standing gate passes: pass
- Check: 7 The look evidence is in the ticket folder: pass
- Follow-up: decide: site/pages/agent-admin-prompt-budget.test.ts:8 note: the MEASURED... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/personas/quizmaster/factories.ts... -> notes.md
