---
id: T-0002
title: "Croupier plays each round on its own surface"
type: feature
status: done
size: M
priority: P3
depends: []
created: 2026-10-05
---
## Goal
Make the Croupier blackjack preset create a new A2UI surface for each round, stacked as a new chat bubble below the previous one, with the chip bankroll seeded onto each new surface from the last settlement.

## Context
Decided by the user: (1) each round's surface is a NEW bubble stacked below the old one, history stays visible; (2) the bankroll carries onto each new surface, seeded from the last settlement.

The Croupier is a preset in `site/pages/agent-admin-presets.ts` (about lines 140-205), built around one surface for the whole session:
- its `surfaceStyle` text says "Always play on ONE persistent game surface... UPDATE THAT SAME surface in place... never redraw a fresh surface per message";
- its `round-loop` workflow says "One surfaceId for the session; each move is an updateDataModel";
- its tagline reads "on ONE live surface (ADR-0129 routing)";
- `agent-admin.ts` (about line 3444) routes follow-up turns back to the original host surface for the "Croupier's one-table game";
- the persistent-bankroll capability (GH #525) and its cross-session resume text assume the same surface.

Expected scope: rewrite the preset text (surfaceStyle, round-loop workflow, tagline); bump `seedVersion` from 5 to 6 so stores migrate; check that ADR-0129 routing sends a new round's surface to a new bubble correctly while in-round moves still update the current surface; recapture the prompt-equivalence baseline and fix any preset tests; add an ADR note or amendment, proposed and never self-ratified, because this overturns "one live surface". Read the ADR-0129 text, `.claude/skills/a2ui-prompt-authoring/` and `.claude/skills/doc-standards/` before editing byte-pinned prompt surfaces.

Repo rules: CLAUDE.md and AGENTS.md. Imports inward only, no em dashes, gates by exit code.

## Constraints
In-round moves keep updating the current round's surface in place (updateDataModel); only the start of a new round creates a new surface. Do not change unrelated presets. Gates: `npm run check` exit 0 plus the touched packages' tests (site preset tests, a2ui prompt-equivalence gates); a docs-only part gates on doc_lint plus check. No push, no PR, no issue comments; publishing needs user approval. Do not touch `.sdlc/`.

## Added requirement (user, same task)
The Croupier's action buttons (Hit, Stand, Deal again) render as a stacked Column. They must render as a Row. The shipped `game-table-chrome` mini-skill already says "CardFooter = Row (gap "sm", justify "center") of the action Buttons", but the Croupier preset's copy of that skill (`site/pages/agent-admin-presets.ts` about line 185) says only "CardFooter action buttons", with no Row. Fix the preset wording to say a Row of the action Buttons, and add a footer-Row check to the Croupier's rules (compare the footer-Row rule P4 in the a2ui payload rubric used for the wizard). This rides the same `seedVersion` 5 to 6 bump as the per-round-surface change.

## Added finding (investigation, same task)
A preset text change alone does NOT give a new bubble per round. A click on a game surface resumes the bubble that owns it (TKT-0079, `agent-admin.ts` about line 3570, `#resumeTargetFor`); only an ask-declared surface breaks out into a fresh bubble (GH #802). Asks cannot build a card table (small component subset, one per turn). So "Deal again" as a normal action click would mount the new round's surface inside the old round's bubble.

Required, in addition to the preset work:
1. Routing: extend `#resumeTargetFor` so a click that signals "new round" returns `undefined` and takes the fresh-bubble path, as an answered ask does. The signal is an action flag the Croupier's Deal again button sets in its context (for example `newRound`). Hit and Stand stay in place in the round's bubble. The exact shape of the action `context` on the wire is NOT yet confirmed: the planner must verify it in the source before relying on it.
2. Preset: one fresh surface id per round (for example `table-round-N`), the Deal again action carrying the flag, the bankroll seeded onto each new surface, `seedVersion` 5 to 6, footer Row for the action buttons.
3. Notes on ADR-0129 and TKT-0079 so they do not go stale (proposed, never self-ratified).
4. Already verified by investigation: the bankroll mirror copes (each new surface id registers in `#knownSurfaceIds`), and the dialog's stick-to-bottom scroll (`conversation-dialog.ts`, `isNearBottom` and `followTail`) already follows a new step; no component change needed.
This changes a shipped routing rule in the `app` package: include unit tests for the new-round path and for the in-place path.
