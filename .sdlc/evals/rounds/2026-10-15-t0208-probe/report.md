# T-0208 live probe (step 2): Haiku 5.5, sample 1

Run: `node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts .sdlc/tickets/.0208-composite-moment-checks/live-commands.sh --cap 3`
Total estimated spend $0.06 (cap $3). Run output is under `.sdlc/tickets/.0208-composite-moment-checks/runs/`. Probe exit 1 on all three: the `expect-*` and `no-json-as-prose` checks failed, as listed.

| Preset / scenario | Composite drawn | Codes fired (repair rounds) | Spend |
|---|---|---|---|
| Concierge `spa-booking` | No. No surface in any of the 4 turns (no ServiceCard, BookingForm or BookingConfirmation); the model answered in prose and said it has no booking system. | Turn 3 `FLOW_END_MISSING`. No `*_MISSING` composite code. | $0.01 |
| Lexicographer `six-guesses` | Yes on turn 1: surface `word-game` shipped BoardGrid and GameHud after the repair rounds. Turns 2-6 touched no surface (the model replied in prose), so `--expect-turn BoardGrid` failed on turns 4 and 6. | Turn 1 round 2 `BOARD_GRID_MISSING`, round 3 `GAME_HUD_MISSING`. | $0.04 |
| Admiral `concede` | Yes on turn 1: surface `battleship-waters` shipped GameHud and BoardGrid after repair. Turn 4 (surrender) shipped BoardGrid but no ResultCard, so the ResultCard expectation failed. `no-json-as-prose` failed on turns 2-4: an `{"a2uiMeta"...` line leaked into the chat prose. | Turn 1 round 2 `PARSE`, round 3 `GAME_HUD_MISSING`. | $0.06 |

Captured replays (a `*_MISSING` code fired and the repair round emitted the composite), both keyless and passing under vitest:
- `scripts/e2e-admin/probe/replays/lexicographer-haiku-composite-repair.json` (+ `.test.mjs`), trace `2026-10-15.jsonl:5`
- `scripts/e2e-admin/probe/replays/admiral-haiku-composite-repair.json` (+ `.test.mjs`), trace `2026-10-15.jsonl:11`

Concierge fired no composite-moment code, so no replay was captured for it. Captured by trace id (`<day>.jsonl:<line>`) rather than `last:<k>`, because the three presets' turns share one trace file and `last:<k>` would have pulled in other presets' turns.

Findings for the conductor (not fixed here, outside step 2's scope):
- Concierge on Haiku answers the spa request in prose with no surface; the moment check did not fire, so the services/booking composites were never forced.
- Admiral turn 4 (surrender) draws no ResultCard on Haiku.
- Admiral leaks an `a2uiMeta` note line into chat prose on turns 2-4 (the existing T-0213 check).
