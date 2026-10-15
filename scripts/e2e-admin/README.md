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

Flags: `--expect-component <Type>` (repeatable; some turn ships the type), `--expect-turn <Type>` (repeatable, after a `--say` or `--click`: that step's turn updates a surface holding the type), `--out <dir>` (default `.agent-traces/probe/<name>-<time>/`), `--name <name>`. `--from-trace` takes `last`, `last:<k>` (the last k produce turns, for a say-then-click sequence) or ids `<day>.jsonl:<line>` from `npm run traces`. The first converted turn must be an intent. `--agent <preset id>` names the preset when the trace line logs none (a preset on the base catalog, such as the Lexicographer); with neither, `--from-trace` stops with a usage error rather than guess (T-0236). A live probe needs `.env` at the checkout root; in a worktree, symlink the main checkout's.

A step is recorded once its own exchange has landed and the page has gone quiet. A turn the page fires itself (the error turn after a renderer rejection) is recorded as its own row, step `{"page": "<error code>"}`; a replay never plays that step, the page fires it again. `available` on a missing click lists visible buttons only.

Each turn records the request the page sent (model, effort, catalog), the wire lines, the trace id, outcome and retry codes, the surfaces and component types, the chat prose, the render lint and a full-page screenshot. The run writes `report.json` and, to the local evidence cache outside the repo (T-0256: `$AGENT_UI_EVIDENCE_DIR`, else `~/Library/Caches/agent-ui/evidence` on macOS and `${XDG_CACHE_HOME:-~/.cache}/agent-ui/evidence` elsewhere, then `<round>/<run>/` for a round run or `probe/<out folder>/`), `turn-<n>.png`, each named by absolute path in the report's `turns[].screenshot`; a live run also writes `fixture.json`, the run as a keyless replay. Exit 0 pass, 1 a check failed, 2 usage or setup.

### Checks

| Check | Fails when |
|---|---|
| `model-pick` | the produce request does not carry the `--model` or `--effort` asked for (picked through the composer's own pickers) |
| `click-target` | a `--click` step finds no visible surface button with that label (T-0172) |
| `no-halt` | an error meta-line, a `halt` or `error` trace outcome, or a non-2xx answer |
| `no-json-as-prose` | the chat log's visible prose (outside surface hosts and the activity strip) carries A2UI JSON, or a `{"a2uiMeta"` meta-line (T-0213) |
| `no-internal-leak` | the chat prose shows a repair round's correction note (`Corrected:`, a leading `Fixed.`) or a surface id (`table-3`, `ask-2`) (T-0217) |
| `reply-text` | a turn shipped A2UI lines with no reply text, or the chat shows the message tally in place of a reply (T-0194) |
| `no-surface-loss` | a surface some round created (round text or `render_surface` payload) never shipped, or fewer hosts mounted than shipped; skipped with no round data or on a halted turn |
| `action-updates-surface` | a click turn neither updates the clicked surface nor hands the flow to a surface it creates (T-0172) |
| `expect-component` | a `--expect-component` type never shipped (one run row), or a step's `--expect-turn` type is on no surface its turn updated (one row per turn) |
| `render-lint` | the `nested-card`, `type-floor` or `column` rule of `scripts/dogfood-rules.json` finds a surface element; the other rules need the full render-lint harness and are listed as not run |
| `reasoning` | warn only, never fails a run: effort above low but no thinking text in the trace |

### Fixtures and regressions

A probe fixture (`agent-ui-chat-probe` v1) holds the preset, the steps and, per produce request, the wire `lines` plus the model `rounds` behind them. `--from-trace` never hand-builds lines: each recorded round runs through the real `produce()` with the testkit's scripted provider, threading the session and passing the persona's semantic checks as the dev proxy does, so self-correct, check retries and halts are today's code. The generated `<name>.test.mjs` re-derives the lines the same way and asserts every DOM-free check is green; it runs in `npm test` (the `scripts` project). A test generated from a failing live trace is red until the producer fix lands, so commit it with that fix.

A replay pinned to today's failures carries an `// expectedFail: T-NNNN` comment and asserts the exact failing `check:turn` list. When that ticket's fix lands, the list empties and the test goes red: flip it to `toEqual([])` in the fix's change (re-pin with a comment, as in #1995 and #1997). A lane rebased onto a main that pinned new replays re-runs `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` and re-pins what its own fix flipped.

`probe/fixtures/` holds the selftest cases: `green-button` and `recorded-haiku-hello` (the T-0174 live smoke, its Card-per-option surface hand-edited to a Row of plain Buttons in T-0257 so the lone-button-frame check stays green) are green; `seeded-json-prose` must fail `no-json-as-prose` and `no-surface-loss`; `seeded-dropped-surface` must fail exactly `no-surface-loss`.

## Live rounds

A live round runs many probes in one go to find bugs, not to gate. Every round keeps all its traces, payloads and ledgers (Kim, 2026-10-15) in one home, `.sdlc/evals/rounds/<YYYY-MM-DD>-<slug>/`; the generated index of every round is `.sdlc/evals/README.md`. The contract is `.claude/docs/spec/agent-closed-loop.spec.md` CL-R11 (lifecycle), CL-R7 (cap) and CL-R12 (routing observability); model behavior seen live is its §5.

1. Scenarios are data in `probe/scenarios/<preset>.ts` (`--expect-turn` per step). `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round.ts` prints the round's `live-commands.sh` (Haiku first, then Sonnet, then Opus, so a stop at the cap leaves the cheap cells filled); `round.test.mjs` pins the file to the generator.
2. Run it from the main checkout (lane worktrees are reaped): `node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts <live-commands.sh> --cap <usd> --round <slug>`. It runs one probe at a time, skips a run whose `report.json` exists (a restart resumes and reuses the folder), and starts no run once the spend estimated from `.agent-traces/` reaches the cap. `--dry-run` lists the runs.
3. Prices come from the claude-api skill's model table, never from memory (`PRICES` in `run-capped.ts`: Haiku 5.5 $0.10 / $0.50, Sonnet 5.5 $2 / $10, Opus 5.5 $4 / $20 per million input / output tokens). Seen so far: 8 Haiku runs about $0.23; round 2, 42 runs about $17.86 under a $20 cap; an Opus Croupier run about $1.20; the T-0208 probe, 3 Haiku runs about $0.06.
4. The runner archives the round itself (T-0241), after every run and again at the end, on a cap stop or a crash. `--round <slug>` retargets every `--out` into the round folder (the date is the round start) and copies the live-commands file in. The folder holds:
   - `traces/<day>.jsonl`: exactly the `.agent-traces` lines from `runs/.capped-start` to the end, the dev proxy's line shape, each with its `routing` block (T-0239);
   - `ledger.jsonl`: one row per run (scenario, agent, model, start and end, exit code, verdict, `traces` as 1-based line ranges into `traces/`, summed tokens, `costUsd` at `PRICES`);
   - `round.json`: commit sha, live-commands file, cap, stop reason, window, price table and source, totals;
   - `README.md`: the entry file, each file present with its provenance and how to read it (jq lines, ledger ranges, the `--replay` line). `run-capped.ts --describe <round dir>` writes only this file, from what the folder actually holds (the rounds backfilled before T-0241 have no ledger or `round.json`);
   - `runs/<name>/`: `report.json` and `fixture.json` in git; turn screenshots go to the evidence cache (above), never into the round folder, and each report names them by absolute path (they are local and may be gone).

   Each archive also regenerates `.sdlc/evals/README.md` (date, ticket, agents, models, runs, pass, spend when known); `run-capped.ts --index .sdlc/evals` regenerates it by hand. To load a round: read `round.json`, then `ledger.jsonl` one JSON row per line, and slice a run's turns from `traces/` by its line ranges (`npm run traces` reads the same shape).
5. Observe the routing: `python3 scripts/agent-traces-to-fog.py <round>/traces/<day>.jsonl --out <session.json>` hydrates the round for the context-fog-of-war skill (`fog.py validate`, `fog.py render`, `library.py publish` are that skill's). The whole round folder also ingests through the skill's bundle path with the committed manifest: `engineer.py ingest <round> --mapping .sdlc/evals/fog-manifest.json --out <dir>`, then `library.py publish <dir>/session.json`; record the report id in `.sdlc/evals/fog/<round>.json` and rerun `run-capped.ts --describe <round>` (T-0248). The bundle path maps each turn and its exemplar ids only; the adapter keeps the persona, prompt sections, references and failure codes.
6. Phase 2 turns the runs into `report.md` in the round folder (a findings table with trace lines as evidence), one ticket per root cause (not per symptom), and a keyless replay per finding via `--from-trace`, pinned with `// expectedFail: T-NNNN` and flipped to green in the fix's change (Fixtures and regressions, above).
