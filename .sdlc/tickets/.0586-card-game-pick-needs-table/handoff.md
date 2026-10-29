---
id: T-0586
title: "A picked card game with no CardTable asks for its table"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
Round 20 cluster G closes: a picked card game answered with no CardTable on any surface asks for its CardTable.

## Intent
- Do: the croupier row in `composite-moments.ts` the row below proposes, with the mentalist OptionDeck plus GameHud negative. Keyless tests that fail on base with false-positive guards, and `--from-trace` replays of the failing runs (copy the r20 traces to a temp `.agent-traces/` and remove them after). Done when: the new tests fail on base and pass after; the replays pass after; the a2ui suites, probe replays and `npm run check` exit 0.

## Context
Round 20 report (`.sdlc/evals/rounds/2026-10-29-r20-pattern/report.md`, PR 2389; until it merges, read it at `../agent-ui.worktrees/T-0584-wave-w0584/.sdlc/evals/rounds/2026-10-29-r20-pattern/`). Kim approved this fix 2026-10-29.

| G. A game picked from the croupier's OptionDeck is answered by restyling the deck (or a text Column) with no CardTable | 2: `pick-croupier-game-deck-haiku-2` (:131), `-3` (:146); round 19 `-1` (:116) | (c) model, with a (b) check gap | :131: the `pick_game` action (`context.value: blackjack`) is answered by one `updateComponents` on `ask-1` that relabels the OptionDeck "Blackjack selected" and disables it; reply "Place your bet to deal"; no code fires. :146: r1 shrinks the deck to 1 option (OPTION_DECK_COUNT, whose hint says to drop the deck and offer a Button), r2 replaces `game-pick-1` with a Column of two Texts; no CardTable. Round 19's :116 updated `hud-1` alone. No check covers a game pick that opens no table. | catalog semantic check (croupier) | `packages/agent-ui/a2ui/src/catalog/composite-moments.ts`, a croupier row: an action turn whose action is `pick_game` (or whose context value names a card game) and whose reply invites a bet or deal, answered with no CardTable on any surface, asks for the CardTable (SURFACE_MISSING) | `composite-moments.test.ts` cases from :131's and :146's payloads with the pick action and reply: each yields SURFACE_MISSING for CardTable; negatives: the same pick answered with a CardTable stays clean, and a mentalist pick on an OptionDeck answered with a GameHud stays clean. Then the two fixture replays | "A picked card game with no CardTable asks for its table" (L2) |

## Constraints
No em dashes. No paid runs. Never rewrite a round archive. Regenerate generated files with their scripts. Model-read text unchanged unless the ticket names it; any new model-read string needs a Fable review.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0; its T-0586 positives (:131 r1's relabelled deck on `ask-1` and :146 r2's Text Column on `game-pick-1`, each with its `pick_game` blackjack press and "Place your bet to deal" reply, yield exactly one SURFACE_MISSING; a prose-only pick, a Surprise me pick whose reply deals blackjack, and a blackjack value under another action name draw it too) fail with base `composite-moments.ts`, and its negatives (the same pick with a CardTable on the pick surface or a fresh `table-1`, a mentalist `choose` press on its OptionDeck answered with a GameHud, a hold'em, stud or draw pick, a reply with no bet or deal, a PlayingCard hand, a say turn, no reply) yield none.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-pick-deck-restyle.test.mjs scripts/e2e-admin/probe/replays/croupier-haiku-pick-deck-text-column.test.mjs` exits 0: fixtures derived with `--from-trace` from 2026-10-29.jsonl:130,131 and :145,146; each fails with base `composite-moments.ts`.
- `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0.
- `npm run check` exits 0.
- Model-read text: the existing finding and repair strings are unchanged; the new strings are the CardTable row's repair and its SURFACE_MISSING message.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L3 (fable) · base: b8f022ba437c
- Changed: A picked card game with no CardTable asks for its table, closing round 20 cluster G
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0; T-0586 pos...: pass
- Check: 2 `npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-pick-deck-restyle.test.mjs scripts...: pass
- Check: 3 `npx vitest run packages/agent-ui/a2ui scripts/e2e-admin/probe` exits 0: pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 Model-read text: existing finding and repair strings unchanged, the new strings are the CardTable...: pass
- Follow-up: decide: .sdlc/tickets/0586-card-game-pick-needs-table/handoff.md:30: note... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/agent: note: @agent-ui/a2ui/agent sits... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:364: note... -> notes.md
- Follow-up: decide: scripts/e2e-admin/probe/replays: note: round 19 :116 the HUD-only... -> notes.md
