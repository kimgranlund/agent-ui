# e2e-admin and the chat probe

Headless drivers for the real agent-admin app (`site/agent-admin-app.html`). Both boot their own `vite dev` on a free port and Chromium; both are local only, never a CI gate.

| Command | Does |
|---|---|
| `npm run e2e:admin` | Keyless flows (Test Chat, Builder, Settings, teams, failure paths) replayed from `fixtures/*.json`; registry and negative controls in `flows/index.ts` |
| `npm run e2e:admin:record -- --flow <name> --out <path>` | Records one flow's model turns live into a scenario (needs a key in `.env`) |
| `npm run chat:probe -- ...` | The chat probe below (T-0174) |

## Chat probe

Runs a persona's turn sequence in the real Test Chat, live or replayed, and checks it. Code in `probe/`, entry `scripts/chat-probe.mjs`.

| Command | Does |
|---|---|
| `npm run chat:probe -- --agent concierge --model claude-haiku-5-5 --effort medium --say "hello" [--click "Reserve a table"] [--say ...]` | Live: spends API credit. The dev proxy holds the key server-side and writes the `.agent-traces/` line; the probe never reads a key |
| `npm run chat:probe -- --replay <fixture.json>` | Keyless: every model call answered from the fixture |
| `npm run chat:probe -- --from-trace last` | Turns the newest produce trace into `probe/replays/<name>.json` plus `<name>.test.mjs` |
| `npm run chat:probe -- selftest` | Fast, DOM-free; rides `check:scripts` |
| `npm run chat:probe -- selftest --browser` | The selftest fixtures replayed in the real page (about 10 s warm) |

Flags: `--expect-component <Type>` (repeatable; some turn ships the type), `--expect-turn <Type>` (repeatable, after a `--say` or `--click`: that step's turn updates a surface holding the type), `--out <dir>` (default `.agent-traces/probe/<name>-<time>/`), `--name <name>`. `--from-trace` takes `last`, `last:<k>` (the last k produce turns, for a say-then-click sequence) or ids `<day>.jsonl:<line>` from `npm run traces`. The first converted turn must be an intent. A live probe needs `.env` at the checkout root; in a worktree, symlink the main checkout's.

A step is recorded once its own exchange has landed and the page has gone quiet. A turn the page fires itself (the error turn after a renderer rejection) is recorded as its own row, step `{"page": "<error code>"}`; a replay never plays that step, the page fires it again. `available` on a missing click lists visible buttons only.

Each turn records the request the page sent (model, effort, catalog), the wire lines, the trace id, outcome and retry codes, the surfaces and component types, the chat prose, the render lint and a full-page screenshot. The run writes `report.json` and `turn-<n>.png`; a live run also writes `fixture.json`, the run as a keyless replay. Exit 0 pass, 1 a check failed, 2 usage or setup.

### Checks

| Check | Fails when |
|---|---|
| `model-pick` | the produce request does not carry the `--model` or `--effort` asked for (picked through the composer's own pickers) |
| `no-halt` | an error meta-line, a `halt` or `error` trace outcome, or a non-2xx answer |
| `no-json-as-prose` | the chat log's visible prose (outside surface hosts and the activity strip) carries A2UI JSON, or a `{"a2uiMeta"` meta-line (T-0213) |
| `no-internal-leak` | the chat prose shows a repair round's correction note (`Corrected:`, a leading `Fixed.`) or a surface id (`table-3`, `ask-2`) (T-0217) |
| `no-surface-loss` | a surface some round created (round text or `render_surface` payload) never shipped, or fewer hosts mounted than shipped; skipped with no round data or on a halted turn |
| `expect-component` | a `--expect-component` type never shipped (one run row), or a step's `--expect-turn` type is on no surface its turn updated (one row per turn) |
| `render-lint` | the `nested-card`, `type-floor` or `column` rule of `scripts/dogfood-rules.json` finds a surface element; the other rules need the full render-lint harness and are listed as not run |
| `reasoning` | warn only (until T-0172): effort above low but no thinking text in the trace |

### Fixtures and regressions

A probe fixture (`agent-ui-chat-probe` v1) holds the preset, the steps and, per produce request, the wire `lines` plus the model `rounds` behind them. `--from-trace` never hand-builds lines: each recorded round runs through the real `produce()` with the testkit's scripted provider, threading the session and passing the persona's semantic checks as the dev proxy does, so self-correct, check retries and halts are today's code. The generated `<name>.test.mjs` re-derives the lines the same way and asserts every DOM-free check is green; it runs in `npm test` (the `scripts` project). A test generated from a failing live trace is red until the producer fix lands, so commit it with that fix.

A replay pinned to today's failures carries an `// expectedFail: T-NNNN` comment and asserts the exact failing `check:turn` list. When that ticket's fix lands, the list empties and the test goes red: flip it to `toEqual([])` in the fix's change (re-pin with a comment, as in #1995 and #1997). A lane rebased onto a main that pinned new replays re-runs `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` and re-pins what its own fix flipped.

`probe/fixtures/` holds the selftest cases: `green-button` and `recorded-haiku-hello` (the T-0174 live smoke) are green; `seeded-json-prose` must fail `no-json-as-prose` and `no-surface-loss`; `seeded-dropped-surface` must fail exactly `no-surface-loss`.

## Live rounds

A live round runs many probes in one go to find bugs, not to gate. Round 1 was T-0184 (the Croupier); round 2 was T-0225 (`.sdlc/live-round-2/report.md`).

1. Scenarios are data in `probe/scenarios/*.ts` (one file per preset, `--expect-turn` per step). `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round.ts` prints the round's `live-commands.sh` (Haiku first, then Sonnet, then Opus, so a stop at the cap leaves the cheap cells filled); `round.test.mjs` pins the file to the generator.
2. `node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts <live-commands.sh> --cap <usd>` runs it one probe at a time, skips a run whose `report.json` exists, and stops once the spend estimated from `.agent-traces/` reaches the cap. `--dry-run` lists the runs.
3. Prices come from the claude-api skill's model table, never from memory (`PRICES` in `run-capped.ts`: Haiku 5.5 $0.10 / $0.50, Sonnet 5.5 $2 / $10, Opus 5.5 $4 / $20 per million input / output tokens). Seen so far: 8 Haiku runs about $0.23; round 2, 42 runs about $17.86 under a $20 cap; an Opus Croupier run about $1.20.
4. Phase 2 turns the runs into a report (a findings table with trace lines as evidence), one ticket per root cause (not per symptom), and a keyless replay per finding via `--from-trace`, pinned as above.

Model behavior seen live is in `.claude/docs/spec/agent-closed-loop.spec.md` §5.
