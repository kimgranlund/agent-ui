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
