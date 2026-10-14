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

Flags: `--expect-component <Type>` (repeatable), `--out <dir>` (default `.agent-traces/probe/<name>-<time>/`), `--name <name>`. `--from-trace` takes `last`, `last:<k>` (the last k produce turns, for a say-then-click sequence) or ids `<day>.jsonl:<line>` from `npm run traces`. The first converted turn must be an intent. A live probe needs `.env` at the checkout root; in a worktree, symlink the main checkout's.

Each turn records the request the page sent (model, effort, catalog), the wire lines, the trace id, outcome and retry codes, the surfaces and component types, the chat prose, the render lint and a full-page screenshot. The run writes `report.json` and `turn-<n>.png`; a live run also writes `fixture.json`, the run as a keyless replay. Exit 0 pass, 1 a check failed, 2 usage or setup.

### Checks

| Check | Fails when |
|---|---|
| `model-pick` | the produce request does not carry the `--model` or `--effort` asked for (picked through the composer's own pickers) |
| `no-halt` | an error meta-line, a `halt` or `error` trace outcome, or a non-2xx answer |
| `no-json-as-prose` | the chat log's visible prose (outside surface hosts and the activity strip) carries A2UI JSON |
| `no-surface-loss` | a surface some round created (round text or `render_surface` payload) never shipped, or fewer hosts mounted than shipped; skipped with no round data or on a halted turn |
| `expect-component` | a `--expect-component` type never shipped |
| `render-lint` | the `nested-card`, `type-floor` or `column` rule of `scripts/dogfood-rules.json` finds a surface element; the other rules need the full render-lint harness and are listed as not run |
| `reasoning` | warn only (until T-0172): effort above low but no thinking text in the trace |

### Fixtures and regressions

A probe fixture (`agent-ui-chat-probe` v1) holds the preset, the steps and, per produce request, the wire `lines` plus the model `rounds` behind them. `--from-trace` never hand-builds lines: each recorded round runs through the real `produce()` with the testkit's scripted provider, threading the session, so self-correct and halts are today's code. The generated `<name>.test.mjs` re-derives the lines the same way and asserts every DOM-free check is green; it runs in `npm test` (the `scripts` project). A test generated from a failing live trace is red until the producer fix lands, so commit it with that fix.

`probe/fixtures/` holds the selftest cases: `green-button` and `recorded-haiku-hello` (the T-0174 live smoke) are green; `seeded-json-prose` must fail `no-json-as-prose` and `no-surface-loss`; `seeded-dropped-surface` must fail exactly `no-surface-loss`.
