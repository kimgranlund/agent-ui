---
id: T-0419
title: "Grammar teaches a single pick among two to eight options as one own-commit OptionDeck for every persona"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-22
claimed_by: claude:a8ce3b21 2026-10-22
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 60
---

## Goal
Every persona, not only the Builder (T-0412), asks a single pick among two to eight options as ONE OptionDeck that commits on press, instead of grammar.md's balanced archetype (a RadioGroup plus a commit Button, grammar.md near :164) and the model-choice RadioGroup (:210). Kim 2026-10-22 ruled yes (AskUserQuestion), after a runtime agent asked "Dinner style for the week" as four radios plus a "Plan my week" button inside a narrow Card nested in the feed frame (before-dinner-style.png).

## Intent
- Do: debate the grammar edit (Opus architect, then fable plan-reviewer) under skill a2ui-prompt-authoring: the balanced archetype for a single pick becomes one OptionDeck (value, title, one-line description, a fitting icon; actionName set; no Button; the question on the deck's heading, no Card around it), keeping RadioGroup only for a pick inside a larger form with other fields, and Checkboxes plus one commit for several picks. Reconcile the Builder paragraph (builder-mission.md, T-0412) so it does not repeat what grammar now says. Check every check, corpus record and mini-skill that teaches or expects the old archetype (framed-choice, lone-button, composite-moments, exemplars) and move what must move, judged and admitted where a corpus record changes. Recapture the prompt-equivalence baseline through the deliberate flow; re-measure the prompt budgets deliberately.
- Non-goals: component changes; the heading scale (T-0418).
- Done when: grammar teaches the single-pick OptionDeck; a pin test covers it; `npm run check`, the a2ui agent, live-agent and catalog tests, the probe project and the touched site tests exit 0; baseline recaptured deliberately and budgets re-measured; a keyless replay of a pick turn renders an OptionDeck (screenshot in the ticket folder).

## Context
Kim's ruling: AskUserQuestion 2026-10-22. T-0412 (#2216) did this for the Builder only (builder-mission.md). grammar.md lines ~37-52 already allow own-commit asks (T-0395). Never rewrite .sdlc/evals/rounds; use the archived-round transforms in scripts/e2e-admin/probe/scenarios if pins move.

## Constraints
grammar.md changes only through this debate. No em dashes. No live spend.
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21

## Debate
- Architect ask (2026-10-22): write the exact grammar.md replacement for the balanced single-pick archetype (:164-165) and the model-choice line (:210), any builder-mission.md trim, and every check, corpus record, mini-skill, exemplar, pin, baseline and budget that moves; prototype it keyless and list risks.
- Plan-reviewer ask (2026-10-22): challenge architect-L1.md: is the grammar and ask-archetype wording sound and model-effective, are the selection.json edge changes (RadioGroup, SegmentedControl, OptionDeck) right and reciprocal, do checks, corpus records, exemplars and probe pins that expect the old archetype move correctly, is the builder-mission trim safe, and do the baseline and budget moves follow the deliberate flow. Replay it and report pass, replan or blocked.
- Plan review 2026-10-22: replan (plan-reviewer-L1.md). plan review: replan: the variant-picker mini-skill still teaches the old single-pick shape and is the top retrieved module on the dinner-style turn; plan review: replan: the option-deck mini-skill body scopes the deck to starting choices and contradicts the new grammar on the same turn; plus the notes-fixes on smoke-mentalist-first-answer-haiku.json round 3 and the liveChecks mirror in domain-seeds.test.ts.
- Architect ask, try 2 (2026-10-22): revise architect-L1.md to fold every plan-reviewer-L1.md finding: reword variant-picker and option-deck mini-skills (exact text, budget and baseline moves) so no retrieved module contradicts the single-pick grammar, plus the two notes-fixes. Keep everything else that passed.
- Plan-reviewer ask, try 2 (2026-10-22): review architect-L1-2.md (the revision folding plan-reviewer-L1.md's findings); confirm each finding is closed and the whole design holds; replay it; pass, replan or blocked.
- Plan review try 2 (2026-10-22): pass (plan-reviewer-L1-2.md). Builder notes: keep the mentalist-ask-hud-beside turn 0 pin at `{ rounds: 2, failureCodes: ['FEED_SCOPE'] }` (the FEED_SCOPE gate continues before the semantic checks, produce.ts:2051-2054); give single-pick-check.test.ts one firing case per code (a lone RadioGroup of 3 on ask-1 fires SINGLE_PICK_DECK; an OptionDeck under a Card fires OPTION_DECK_WRAPPED; a root OptionDeck is clean).
- Build ask (2026-10-22): one solo L3 applies architect-L1-2.md in full with the builder notes above, following the deliberate baseline recapture flow in skill a2ui-prompt-authoring and re-measuring budgets; local gate is npm run check plus the touched folders' tests; a keyless replay screenshot of the dinner-style pick is the look evidence.

## Acceptance criteria
- The standing gate is green: `npm run check` exits 0.
- The a2ui agent, live-agent, catalog, examples and corpus tests are green, including the new single-pick check, its contract entry, the grammar and mini-skill pins, the recaptured prompt-equivalence baseline and the re-measured budgets: `npx vitest run --project packages packages/agent-ui/a2ui/src` exits 0.
- The tools corpus and registry tests and the probe project (both mentalist replays re-authored to the OptionDeck) are green: `npx vitest run --project tools --project scripts packages/agent-ui/a2ui/tools scripts/e2e-admin` exits 0.
- The touched site tests are green (game-hud placement, seed digests, manifests, prompt and ambient budgets): `npx vitest run --project site site/agent-content site/lib site/pages/agent-admin site/pages/a2ui-live.ask-lifecycle.test.ts` exits 0.
- A keyless replay of the dinner pick renders four OptionDeck cards with no Button and no Card around the deck, and the press sends `choose` with the card's value: `node scripts/e2e-admin.mjs run --only chat-pick-deck` exits 0.
- The look evidence is saved: `test -s .sdlc/tickets/0419-grammar-own-commit-single-pick/shots/after-chat-pick-deck.png` exits 0.

## Outcome

2026-10-23 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: 07a5c2afaa9d
- Changed: Grammar, ask archetypes, mini-skills and selection edges teach a lone single pick as a root OptionDeck the press commits, enforced by SINGLE_PICK_DECK and OPTION_DECK_WRAPPED; baseline recaptured
- Commits: none
- Check: 1 The standing gate is green: `npm run check` exits 0: pass
- Check: 2 `npx vitest run --project packages packages/agent-ui/a2ui/src` exits 0: pass
- Check: 3 `npx vitest run --project tools --project scripts packages/agent-ui/a2ui/tools scripts/e2e-admin`...: pass
- Check: 4 `npx vitest run --project site site/agent-content site/lib site/pages/agent-admin site/pages/a2ui...: pass
- Check: 5 `node scripts/e2e-admin.mjs run --only chat-pick-deck` exits 0: pass
- Check: 6 `test -s .sdlc/tickets/0419-grammar-own-commit-single-pick/shots/after-chat-pick-deck.png` exits 0: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/examples/catalog-frontier.ts:453-478 the... -> notes.md
- Follow-up: note: site/agent-content/skills/guess-hud/SKILL.md:4 the description... -> notes.md
- Follow-up: decide: packages/agent-ui/components/src/controls/option-deck/option-deck.m... -> T-0421
- Follow-up: decide: scripts/e2e-admin/admin-page.ts:33 the probe --click reads... -> notes.md
