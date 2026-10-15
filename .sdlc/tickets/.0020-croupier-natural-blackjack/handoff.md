---
id: T-0020
title: "Croupier: a natural blackjack must end the round (no Hit/Stand/Double), persona rule plus semantic check"
type: bug
status: done
size: M
priority: P2
depends: []
router: .sdlc/AGENTS.md
created: 2026-10-06
---

## Goal
User screenshot (2026-10-06): the player is dealt A of spades and K of hearts, the surface labels it "Blackjack!", yet it still offers Hit, Stand and Double and settles nothing; the dealer's hole card stays face down. A natural must end the round. Worktree `.claude/worktrees/wave-natural`, branch `fix/croupier-natural-blackjack`.

## Intent
- Do 1, persona rule: find where the Croupier persona's behavior is authored (the seeded persona config in the agent-admin app, agent-admin-schema.ts / persona seed, and the Croupier fragment in `packages/agent-ui/a2ui/src/catalog/personas/croupier/`; the mini-skills only teach layout). Add a natural-blackjack rule: a two-card 21 ends the round on the deal turn; reveal the dealer hole card; pay 3:2 unless the dealer also has 21 (push); the actions row offers only "Deal again" (no Hit/Stand/Double); the HUD and bankroll update. Put it where persona behavior belongs and update every record that mirrors it (manifest digest writer, seedVersion if the persona seed changes, prompt baseline recapture via skill `a2ui-prompt-authoring` if a byte-pinned prompt moves, `node scripts/generate-agent-assets.mjs`, `npm run generate:registry`).
- Do 2, semantic check: extend `croupier-hand-consistency` in `checks.ts` (ADR-0238) with a code (for example NATURAL_ACTIONS): when the player hand (any list or hand container the check already resolves) is exactly two cards totalling 21 (A with a ten-value card), the surface must not contain Hit, Stand or Double buttons (match by label or id, case-insensitive), and the dealer hole card must not be face down on that surface. The finding message tells the model how to repair. A value the check cannot resolve is indeterminate, never a finding.
- Do 3, tests: red-then-green in `checks.test.ts` using the screenshot's hand (7 of clubs up and a face-down dealer card; player A of spades, K of hearts; Hit, Stand, Double buttons) plus its repair, and a case that must stay green (21 reached with three cards, or a non-natural hand).
- Non-goals: other game rules; model reasoning output (#1841).
- Done when: `npm run check` and full `npm test` exit 0; no em dashes; stale records repaired in the same change.

## Context
Recent related work: #1832 (hand totals check), #1838 (nested hand lists, recorded Haiku fixtures in `__fixtures__/`), #1839 (badges in the CardHeader trailing slot). Never hand-edit generated files. Judge gates by exit code.

## Constraints
Imports point inward only. Commit locally in the worktree; no push.

## Acceptance criteria
1. A surface with a player natural and Hit/Stand/Double buttons yields one finding from the Croupier check; the repaired surface (Deal again only, dealer card face up) yields none.
2. A three-card 21 and a two-card 20 yield no natural finding.
3. The persona prompt or seed carries the natural rule, with its mirrors regenerated and gates green.

## Closed

2026-10-06: Merged to main in #1842
