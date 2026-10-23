---
id: T-0412
title: "The agent builder interview chat offers choices with the new selection patterns (OptionDeck, OptionCompare, own-commit asks) instead of a RadioGroup plus Confirm"
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
In the agent-admin Builder interview chat (Co-pilot authoring an agent), a turn that asks the person to pick one of a few options uses the same selection patterns the runtime agents now use: one OptionDeck for starting choices (cards are the choice, own-commit, no separate Confirm), OptionCompare when options are compared on attributes, and own-commit asks generally, instead of a RadioGroup plus a Confirm button (Kim 2026-10-22, screenshot before-builder-temperament.png: "Coach temperament" as four radios and a full-width Confirm).

## Intent
- Do: find how the Builder interview turn composes its surfaces (the authoring prompt `packages/agent-ui/a2ui/src/agent/prompts/authoring-teaching.md`, its mode, its catalog and which mini-skills `selectMiniSkills` offers on that turn), find why the option-deck / option-compare mini-skills and the own-commit grammar (T-0193, T-0393, T-0395) do not reach it, and make them reach it with the smallest change at the root (catalog selection, mini-skill eligibility or mode gating first; teaching text only if needed). Keep the builder's answer flowing back as the person's pick (the action and context the builder already reads). Add tests that pin the Builder turn's composed prompt or selected mini-skills containing the selection patterns, and a keyless replay or probe if one exists for the builder chat.
- Non-goals: grammar.md wording (Kim's ruling); the runtime personas; new components.
- Done when: the Builder interview's composed context offers OptionDeck/OptionCompare and the own-commit rule (pinned by a test that is red on main); the builder still reads the pick; `npm run check`, the touched folders' tests and the a2ui live-agent tests exit 0; prompt-equivalence baseline moved only through the deliberate flow; a screenshot or keyless replay of a Builder choice turn rendering an OptionDeck is attached in the task folder.

## Context
Screenshot: .sdlc/tickets/0412-builder-chat-selection-patterns/before-builder-temperament.png. Builder files: packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts, site/pages/agent-admin-app.ts, site/lib/admin-live-runner.ts, packages/agent-ui/a2ui/src/agent/meta-line.ts. Selection patterns: mini-skills option-deck.md and option-compare.md under packages/agent-ui/a2ui/src/agent/prompts/mini-skills/, OptionDeck and OptionCompare in the default catalog. Model-read text follows the debate rule (Opus architect, fable plan-reviewer) before a builder applies it.

## Constraints
grammar.md is byte-pinned (Kim's ruling only). No em dashes. Never rewrite .sdlc/evals/rounds. No live spend without Kim.
- Lane: full because size L3 (steps.py lane); overnight goal 2026-10-21

## Debate
- Architect ask (2026-10-22): trace how a Builder interview turn is composed (prompt mode, catalog, mini-skill selection, any authoring-only gate) and why the OptionDeck / OptionCompare mini-skills and the own-commit rule do not reach it; design the smallest root change so a Builder choice turn uses them while the builder still reads the pick; name every file, test, pin and baseline that moves, prototype it keyless, and list risks.
- Plan-reviewer ask (2026-10-22): challenge architect-L1.md: is a builder-mission.md paragraph the right root (versus mini-skill pinning or selection.json), is the draft wording sound and model-effective (one pick: OptionDeck; attribute compare: OptionCompare; no Button; actionName choose), does it conflict with grammar.md :164 and :210 on the Builder turn, does the pick still reach the builder, which baselines, budgets and pins move, and is the e2e-admin replay keyless and discriminating. Replay it and report pass, replan or blocked.
- Debate outcome 2026-10-22: architect (architect-L1.md) and fable reviewer (plan-reviewer-L1.md, pass) agree on one paragraph in builder-mission.md as the root. Folded reviewer fixes: the paragraph states that on this interview it replaces the balanced archetype's RadioGroup-plus-commit (grammar.md :164-165) and the model-choice RadioGroup (:210) for a single pick; the comparison mini-skill is comparison-table.md; the prompt budgets BASE and DERIVED are re-measured deliberately with a RE-MEASURED line; the e2e flow runs as node scripts/e2e-admin.mjs --only builder-choice-deck; npm run check and the touched e2e-admin tests are criteria; the screenshot goes in the ticket folder.

## Acceptance criteria
- The mission-section pin is green after the change (it was red before builder-mission.md gained the paragraph): `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts -t "T-0412"`
- The prompt budgets hold at their deliberate re-measure (BASE 148 700, DERIVED 149 700, RE-MEASURED T-0412 lines): `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/live-agent/prompt-budget.test.ts`
- The generated assets are fresh: `env -u NODE_OPTIONS node scripts/generate-agent-assets.mjs --check`
- A Builder OptionDeck ask renders in the Co-pilot pane and its press reaches the next Builder turn as action context: `env -u NODE_OPTIONS node scripts/e2e-admin.mjs --only builder-choice-deck`
- grammar.md and the prompt-equivalence baseline did not move: `git diff --exit-code c89107ca3 -- packages/agent-ui/a2ui/src/agent/prompts/grammar.md packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json`
- The standing gate: `env -u NODE_OPTIONS npm run check`
- The touched folders and the a2ui live-agent tests: `env -u NODE_OPTIONS npx vitest run packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/live-agent site/pages/agent-admin-prompt-budget.test.ts scripts/e2e-admin`
- The screenshot of the Builder choice turn exists: `test -f .sdlc/tickets/0412-builder-chat-selection-patterns/after-builder-choice-deck.png`
- Kim 2026-10-22 (AskUserQuestion, after the first build's screenshot showed empty icon discs): teach icons in the Builder paragraph; every OptionDeck option carries an icon that fits its answer. The component stays as is.

## Outcome

2026-10-22 · lane: full L3 · verdict: pass · verifier: verifier-L3 (fable) · base: c89107ca325d
- Changed: The Builder mission teaches a single pick as one OptionDeck (with icons) or OptionCompare that commits on press, replacing RadioGroup plus Confirm on the interview; budgets re-measured; keyless builder-choice-deck flow pins the pick read-back
- Commits: none
- Check: 1 The mission-section pin is green after the change, red before builder-mission.md gained the parag...: pass
- Check: 2 The prompt budgets hold at their deliberate re-measure (BASE 148 700, DERIVED 149 700, RE-MEASURE...: pass
- Check: 3 The generated assets are fresh: pass
- Check: 4 A Builder OptionDeck ask renders in the Co-pilot pane and its press reaches the next Builder turn...: pass
- Check: 5 grammar.md and the prompt-equivalence baseline did not move: pass
- Check: 6 The standing gate: pass
- Check: 7 The touched folders and the a2ui live-agent tests: pass
- Check: 8 The screenshot of the Builder choice turn exists: pass
- Check: 9 Kim 2026-10-22: teach icons in the Builder paragraph; every OptionDeck option carries an icon tha...: pass
- Follow-up: note: the live-model leg is unmeasured by design no live spend without... -> notes.md
