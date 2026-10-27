---
id: T-0482
title: "GAME_HUD_MISSING runs without OptionDeck in the catalog, and grammar.md says every game ask turn keeps its HUD"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-27
claimed_by: claude:a8ce3b21 2026-10-27
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
GAME_HUD_MISSING runs whenever a game ask turn opens a play control, and grammar.md states that a game ask turn keeps its GameHud.

## Repro
1. `hidden-state-checks.ts:476`: `requires: ['GameHud', 'OptionDeck']` skips the check for a catalog with AmountPicker, Slider, ChoiceGroup or OptionCompare but no OptionDeck.
2. `packages/agent-ui/a2ui/src/agent/prompts/grammar.md:44` reads "a game with no GameHud has none", which models can read as permission for a game ask turn without a HUD.

## Expected
The check's `requires` gates on GameHud plus any one of the PLAY_CONTROLS. grammar.md says a game's ask turn sends or updates its HUD surface (Kim's ruling 2026-10-27: keep the check, amend grammar).

## Actual
The OptionDeck gate predates T-0479; grammar text is older than the check.

## Context
Follow-ups from the T-0479 Fable review (hidden-state-checks.ts:476 decide, grammar.md:44 note). grammar.md changes only by Kim's ruling; this ticket carries that ruling for line 44 only.

## Constraints
grammar.md is model-read text: Opus author, Fable review, and recapture `prompt-equivalence.baseline.json` only via the deliberate flow in skill `a2ui-prompt-authoring`; regenerate `assets.gen.ts` with its script. Smallest wording change that states the rule. No em dashes.

## Done when
- A unit case where a catalog without OptionDeck still gets GAME_HUD_MISSING.
- The T-0468 and T-0479 replays pass; the keyless false-positive sweep over the round 14 and 15 fixtures stays unchanged except the target.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
verifier: L3
- A unit case gates HIDDEN_STATE_CHECKS on a catalog with GameHud and AmountPicker but no OptionDeck and gets `GAME_HUD_MISSING ask-1:hud` (red before the `requires` change, green after), and the grammar test pins the new line 44 text: `npx vitest run packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts packages/agent-ui/a2ui/src/live-agent/system-prompt-grammar.test.ts` exits 0.
- grammar.md line 44 reads "A game's ask turn sends or updates its HUD surface, its first ask included; only a game whose card table carries its status has none." in place of "and a game with no GameHud has none", and the regenerated assets and recaptured baseline match it: `npx vitest run packages/agent-ui/a2ui/src/agent/agent-assets-freshness.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts` exits 0.
- The T-0468 and T-0479 replays and the keyless sweep over every recorded round 14 and 15 fixture stay green: `npx vitest run scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.

## Outcome

2026-10-27 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 02b5afbc391b
- Changed: GAME_HUD_MISSING runs for any game catalog with a GameHud, and grammar.md says a game's ask turn sends or updates its HUD surface (Kim's ruling)
- Commits: none
- Check: 1 A unit case gates HIDDEN_STATE_CHECKS on a catalog with GameHud and AmountPicker but no OptionDec...: pass
- Check: 2 grammar.md line 44 reads "A game's ask turn sends or updates its HUD surface, its first ask inclu...: pass
- Check: 3 The T-0468 and T-0479 replays and the keyless sweep over every recorded round 14 and 15 fixture s...: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: packages/agent-ui/a2ui/src/agent/prompts/grammar.md:44-45 the new... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:476 the... -> notes.md
- Follow-up: note: .sdlc/tickets/0482-hud-check-gate-and-grammar/handoff.md:40-45 the... -> notes.md
- Follow-up: fix-now: .sdlc/notes/notes.md:929 the T-0468 decide item this ticket... -> notes.md
