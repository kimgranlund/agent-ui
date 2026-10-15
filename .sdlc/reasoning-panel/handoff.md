---
id: T-0021
title: "Agent activity strip: expandable reasoning panel, a strip line plus a panel (GH #1841, needs ADR draft)"
type: feature
status: done
size: M
priority: P2
depends: []
router: .sdlc/AGENTS.md
created: 2026-10-07
---

## Goal
Issue #1841: the activity strip shows only "Reasoned 0.0s". Ship an expandable reasoning panel: one strip line (the existing Reasoned step) that expands to a panel showing the model's reasoning text. Scope chosen by Kim (AskUserQuestion, 2026-10-07): "Expandable panel", a new component, with an ADR draft for his ratification. Worktree `.claude/worktrees/wave-reasoning`, branch `feat/reasoning-panel`.

## Intent
- Do 1, ADR draft: write the next free ADR (check `.claude/docs/adr/` and `site/public/adr-index.json`, claim the number against every worktree and open PR) with Status `proposed`, never accepted. It decides: the reasoning source (provider thinking blocks versus a model-authored note already on the meta-line; pick what the ADR-0073 trust boundary allows, with `produce()` and keys staying out of devtools), where it rides (`TurnProgress`, the trace, the neutral `ActivityStep` model from the ADR-0159 amendment), the cap and collapse defaults, privacy and token cost, and the devtools capture/replay effect (ADR-0239). Record rejected alternatives.
- Do 2, build: the neutral `ActivityStep` gains an optional reasoning text; the strip step row expands to a reasoning panel (a new descriptor-backed control only if the ADR needs one; otherwise a part of `ui-conversation` step mode, following the descriptor, no-barrels and registry rules, ADR-0233). Keyless: scripted turns carry reasoning text, so tests need no key. Panel is collapsed by default, length-capped, escapes text, accessible (button, aria-expanded via ElementInternals rules).
- Do 3, tests: red-then-green unit tests for the step model and a real-host browser guard for the expanded panel; the Reasoned step with no text keeps today's look.
- Non-goals: enabling provider extended thinking by default (cost); a paid live call; other personas' behavior.
- Done when: `npm run check` and full `npm test` exit 0; `test:browser` for touched browser tests exits 0; registry, assets and manifest regenerated as needed; no em dashes; stale records repaired.

## Context
Strip code: `site/lib/a2ui-activity.ts`, `packages/agent-ui/app/src/controls/conversation/activity-step.ts` and `conversation.ts`. Recent: #1839 (retry marker, badge option on status stream), ADR-0159 amendment, ADR-0239. Judge gates by exit code; never hand-edit generated files.

## Constraints
Imports point inward only. ADRs are never self-ratified. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. An ADR file exists with Status `proposed` and the decisions above.
2. A turn that carries reasoning text shows it in an expandable panel, collapsed by default and capped; a turn without text looks as before.
3. Red-then-green tests; gates green.

## Closed

2026-10-07: Merged in #1844
