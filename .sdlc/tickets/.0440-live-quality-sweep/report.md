# T-0440 live chat:probe sweep, 2026-10-24

Round: `.sdlc/evals/rounds/2026-10-24-t0440-sweep/` (17 probe runs; `ledger.jsonl` costs, `traces/2026-10-24.jsonl` lines, `runs/<name>/report.json` and `fixture.json`, and the copied live-commands file: the smoke plan for the seven personas plus hand-written `pick-*` lines that press an OptionDeck card or a QuestionCard row by title). The round folder is the ruled home for probe traces (Kim 2026-10-15); this report indexes it. The Builder run has no round, so its evidence sits in `evidence/` here.

Spend: probes $0.551 (round.json totals), Builder interview about $0.032 (one Sonnet 5.5 turn of 8002 in, 1200 out, 18609 cache read, plus a Haiku naming call under $0.001). Total about $0.58 against the $5 cap.

## Per persona

| Persona | Run | Model | Verdict | Trace lines | Cost USD | Picks commit? |
|---|---|---|---|---|---|---|
| croupier | smoke-croupier-blackjack-deal-haiku-1 | Haiku | pass | 1-2 | 0.0067 | bet button press deals the CardTable |
| croupier | pick-croupier-game-deck-haiku-1 | Haiku | pass | 11-12 | 0.0059 | yes: game OptionDeck, press "Blackjack" sends a client turn on ask-1, CardTable deals |
| concierge | smoke-concierge-booking-haiku-1 | Haiku | pass | 3-4 | 0.0100 | n/a (typed confirm); turn 2 SURFACE_MISSING retry saved, ConfirmReceipt shipped |
| restaurant | smoke-restaurant-reserve-table-haiku-1 | Haiku | fail (oracle) | 5 | 0.0035 | n/a; ships one BookingForm, oracle expects Field |
| travel | smoke-travel-compare-legs-haiku-1 | Haiku | pass | 6 | 0.0037 | n/a |
| stylist | smoke-stylist-palette-haiku-1 | Haiku | fail | 7 | 0.0118 | n/a; render-lint nested-card (Swatch in Card in Card) |
| stylist | smoke-stylist-palette-sonnet-1 | Sonnet | pass | 28 | 0.2088 | n/a; PARSE and CONTRAST_PAIR_WRAPPED retries saved |
| quizmaster | smoke-quizmaster-first-question-haiku-1 | Haiku | pass | 8 | 0.0039 | n/a |
| quizmaster | pick-quizmaster-tap-commit-haiku-1 | Haiku | pass | 14-15 | 0.0063 | yes: tapping "Paris" sends a client turn on quiz-capitals, the row marks Correct and Score reads 1 (turn-2 screenshot) |
| mentalist | smoke-mentalist-first-answer-haiku-1 | Haiku | fail | 9-10 | 0.0127 | typed "Yes.": ACTION_NOT_APPLIED then PARSE, final reply note-only, HUD and deck not updated |
| mentalist | smoke-mentalist-first-answer-haiku-2 | Haiku | pass | 16-17 | 0.0085 | typed answer; ACTION_NOT_APPLIED retry saved, ask-2 deck shipped |
| mentalist | smoke-mentalist-first-answer-haiku-3 | Haiku | fail | 20-21 | 0.0063 | opening turn prose only, no HUD |
| mentalist | pick-mentalist-answer-deck-haiku-1 | Haiku | fail | 13 | 0.0035 | not reached: opening turn prose only ("Answer Yes, No, or Sort of below") with no surface |
| mentalist | pick-mentalist-answer-deck-haiku-2 | Haiku | pass | 18-19 | 0.0063 | yes: press "Yes" is a client turn, HUD and deck update |
| mentalist | pick-mentalist-answer-deck-haiku-3 | Haiku | pass | 22-23 | 0.0061 | yes |
| mentalist | smoke-mentalist-first-answer-sonnet-1 | Sonnet | pass | 24-25 | 0.1252 | typed answer, ask-2 deck shipped, no retry |
| mentalist | pick-mentalist-answer-deck-sonnet-1 | Sonnet | pass | 26-27 | 0.1219 | yes |
| builder interview | e2e:admin:record builder-choice-deck (live) | Sonnet | asks right, pick not exercised | `evidence/builder-interview.traces.jsonl` | about 0.032 | the ask renders as one OptionDeck of four cards (Encouraging, Strict, Playful, Calm and matter-of-fact); the scripted flow stops at its title assert before pressing, so the commit is not measured live (the keyless flow covers the wire) |

Trace lines are into the round's `traces/2026-10-24.jsonl`. Screenshots: `~/Library/Caches/agent-ui/evidence/2026-10-24-t0440-sweep/<run>/turn-<n>.png` (local).

## Judgment

- Picks commit: yes wherever a deck or quiz row was on screen (croupier game deck, quizmaster tap, mentalist answer deck 2 of 2 reached on Haiku and 1 of 1 on Sonnet). Every press went out as a `client` turn on the deck's surface.
- Heading scale and single-pick OptionDeck rendered with no render-lint finding on every run but the Haiku stylist (nested-card, failing in every stylist smoke since 2026-10-18, not new).
- Mentalist on Haiku is the one regression signal: smoke 1 of 3 pass now against 3 of 3 in `2026-10-19-r12-targeted`. Two failure shapes: an opening turn that is prose only while the prose points at a card "below" (2 of 6 openings), and a typed answer whose rounds stay note-only (`a2uiMeta` with `target` and `ask` but no `updateComponents`) through ACTION_NOT_APPLIED and PARSE, so the final reply claims "Question 2" with no ask-2 surface. Sonnet passes both.
- Restaurant fail is an oracle defect (class d): the smoke scenario expects Field, the persona (v6+, T-0197, T-0390) ships one BookingForm.

## Reproducers

Both mentalist failures replay keyless from the round's fixtures and fail the same checks (run 2026-10-24, exit 1 each):

- `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-24-t0440-sweep/runs/smoke-mentalist-first-answer-haiku-1/fixture.json` (action-updates-surface and expect-component on turn 2; the replay's retries read PARSE+SEMANTIC_UNCORRECTED)
- `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-24-t0440-sweep/runs/pick-mentalist-answer-deck-haiku-1/fixture.json` (expect-component turn 1, click-target turn 2)

No `--from-trace` test file was generated: the README pins one with `// expectedFail: T-NNNN`, and the regression has no ticket id yet. The fix ticket converts the fixture with `--from-trace` and pins it.

## Proposed tickets

1. Mentalist on Haiku answers a turn with a note-only reply that claims a surface it never ships. Evidence: trace lines 9-10, 13, 20 (round above). Shape: the opening turn ships prose naming "the card below" with no GameHud or OptionDeck; a typed answer stays `a2uiMeta`-only through the ACTION_NOT_APPLIED and PARSE repairs and the producer accepts it (SEMANTIC_UNCORRECTED). Likely layer: the say-claim repair (T-0428) covers a claim on an open surface only; extend it to a note whose `ask` or prose names a surface the reply does not create, and make the final round refuse a note-only reply after ACTION_NOT_APPLIED. Proof: the two fixtures above go green as `--from-trace` tests; a 3-sample Haiku smoke round back at 3 of 3. Size L2.
2. The restaurant smoke oracle expects Field; the persona ships one BookingForm. Change `probe/scenarios/restaurant.ts` to expect BookingForm and repin `plan.test.mjs`. Size L1.
3. (Optional) A live Builder probe that presses the first OptionDeck card whatever its title, so the interview pick commit is measurable live; today only the keyless `builder-choice-deck` flow proves it. Size L2.
