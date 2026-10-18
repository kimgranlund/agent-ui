---
id: T-0363
title: "GameHud is outside the feed scope, so an ask-surface game cannot answer GAME_HUD_MISSING in place"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0358]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A game whose HUD surface is an ask surface (the Mentalist's Yes / No / Sort of answer, the Negotiator's offer field) can answer GAME_HUD_MISSING with a GameHud without a FEED_SCOPE rejection, or the repair says where the GameHud goes.

## Repro
1. Author a round for `scripts/e2e-admin/probe/replays/smoke-negotiator-first-offer-haiku.json` turn 0 that keeps `"ask":{"surfaceId":"ask-1"}` in its meta-line and replaces the `sheet` DescriptionList on ask-1 with a GameHud.
2. Replay it: the round gets `FEED_SCOPE` (GameHud is not in `FEED_SURFACE_TYPES`, `packages/agent-ui/a2ui/src/agent/feed-catalog.ts`), then FEED_SCOPE_RESCOPED at the bound (seen during T-0358).

## Expected
Either GameHud joins the feed surface types (if a HUD on an ask surface is sound), or the GameHud repair tells the model to put the GameHud on its own surface beside the ask surface. T-0358's authored rounds use the second shape (hud-1).

## Actual
The `guess-hud` and `deal-sheet` skills put the GameHud and the answer control on one surface, and the model declares that surface an ask. The ruled GameHud repair line names no surface, so a live model that follows it on the ask surface is sent back with FEED_SCOPE.

## Context
Found by T-0358. The GameHud repair wording is ruled (team-lead, 2026-10-17); any change to it, a skill or FEED_SCOPE_HINT is model-read text under the debate rule and skill `a2ui-prompt-authoring`.

## Constraints
The failing test lands before or with the fix, never after.

## Kim ruling (2026-10-18, close-out round)
Option (b): teach the game persona skills to place GameHud in a surface; grammar.md stays byte-pinned and unchanged.

## Kim ruling (2026-10-18, after the T-0363 code review)
Option (b) conflicts with grammar.md (an ask turn builds ONLY its ask surface), so ask-every-turn games could never create or update the HUD. Kim ruled: change grammar.md so an ask turn may also create or update one HUD surface. grammar.md is model-read, so the debate rule applies: an Opus architect proposes the exact wording and a fable plan-reviewer challenges it before the builder applies it. The skill-sentence commit is reworked to match.

## Design
Architect revision 2 (`.sdlc/runtime/tasks/0363-gamehud-feed-scope/architect-L1-2.md`), passed by the fable plan-reviewer's second challenge (`plan-reviewer-L1-2.md`) with one fix applied: `HUD_TYPES` also holds `TimelineItem`, and produce-loop case 3 builds its Timeline with a TimelineItem.

## Conductor call (2026-10-18)
Skill descriptions trimmed to the SPEC-R14 200 B entry budget; the boundary-negotiation clause moved to the deal-sheet body.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts site/agent-content/game-hud-placement.test.ts` exits 0. The eight T-0363 grammar pins, produce-loop case 3 and game-hud-placement were each red before the change.
- `npx vitest run scripts/e2e-admin/probe/replays/mentalist-ask-hud-beside.test.mjs scripts/e2e-admin/probe/replays/negotiator-ask-hud-beside.test.mjs` exits 0: an ask turn plus its HUD surface ship, the HUD hint keeps the ask, and Accept closes the deal on the deal sheet.
- `node scripts/chat-probe.mjs selftest` exits 0 (a click that settles its targeted surface passes action-updates-surface; with no target it fails).
- `npx vitest run packages/agent-ui/a2ui/src/live-agent packages/agent-ui/a2ui/src/agent packages/agent-ui/a2ui/src/catalog site/agent-content scripts/e2e-admin/probe/replays site/lib/agent-manifest site/pages/agent-admin-seed-digests.test.ts site/pages/agent-admin-presets.test.ts site/pages/agent-admin-prompt-budget.test.ts` exits 0 (recorded rounds byte-identical, the Alchemist replay, every grammar pin and the re-measured prompt budgets green).
- `npx vitest run site/pages/agent-admin` exits 0 (the agent-admin tests, the ambient per-entry index budget among them).
- `npm run check` exits 0.
