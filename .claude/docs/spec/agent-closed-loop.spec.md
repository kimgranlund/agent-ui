# SPEC: Agent closed-loop testing (scenarios, checks, signal rows, replay and live)

> Status: proposed · v0.2 · 2026-10-15 · Layer: SPEC (execution contract) · solo seat, sdlc-lite run `spec-closed-loop` (T-0181); upserted by T-0237, T-0243 and T-0342
> Scope: the loop that drives a real agent turn (live or replayed), checks it, records one signal row and turns a live failure into a keyless regression. Shipped base: T-0174 (`npm run chat:probe`), the live round runner and archive (T-0225, T-0241), the producer check families (T-0208, T-0229, T-0230) and the trace routing block (T-0239). Signals over the round archive and the baseline comparison: T-0342. Judged checks on round transcripts: T-0178. Planned on this contract (the 2026-10-17 re-scope closed T-0176, T-0177 and T-0179): T-0343 (scenario tags and smoke scenarios), T-0163 (bundle digests and affected selection). The rows below that still cite T-0176 or T-0179 are repaired by T-0343 (CL-R1, R5 to R7) and T-0163 (CL-R10).
> Decisions cite their tickets; the ADR system is frozen (T-0164) and this SPEC adds no ADR clause. Holds unchanged: ADR-0073 cl.5 (keys and `produce()` stay server-side and never enter devtools), the devtools capture contract ([`devtools-harness.spec.md`](./devtools-harness.spec.md)), the A2UI test kit format ([`packages/agent-ui/a2ui/tools/testkit/README.md`](../../../packages/agent-ui/a2ui/tools/testkit/README.md)).
> IDs are file-scoped `CL-R#` and `CL-N#`. Each requirement is marked **shipped** (with its code) or **planned** (with its ticket). When this SPEC disagrees with the tree, the tree wins and this file is repaired.
> Terms: [`references/agent-model.md`](../references/agent-model.md) §3 (probe fixture, eval scenario, signal row, check).

## 1. Definitions

- Eval scenario: one agent use case as data: the persona, the models and efforts it runs on, its tags, the steps a user takes and the checks each turn must pass. The unit the runner (T-0176) plays and the signal store counts.
- Probe fixture: the `agent-ui-chat-probe` v1 file a probe run replays: the preset, the steps and, per produce request, the wire `lines` plus the model `rounds` behind them (`scripts/e2e-admin/probe/model.ts`, `ProbeFixture`).
- Check: one named, deterministic or judged verdict over one turn record, with a status of `pass`, `fail`, `warn` or `skip`.
- Signal row: one probe run as `scripts/e2e-admin/probe/signals.ts` joins it from the committed round archive (its ledger row, report and trace lines, CL-R4); every aggregate, report and baseline reads it, and it is never stored on its own.
- Replay: every model call answered from recorded rounds or lines; keyless, no network to a provider. Live: the dev proxy calls the provider with its server-side key and spends credit.

## 2. Requirements

### CL-R1: one scenario contract (planned, T-0176)

An eval scenario carries `kind: 'agent-ui-eval-scenario'`, `version: 1`, `id`, `persona` (a preset id), `models[]`, `efforts[]`, `tags[]` (`smoke`, `regression`, `capability`, `persona-rules`), `steps[]` (`say`, `click`, `fill`, `wait`), per-turn `expect` (check names from CL-R2, `expect-component` types, data-model assertions by JSON pointer), an optional replay fixture per model, and an optional `expectedFail` (CL-R5). Home: `scripts/e2e-admin/scenarios/<persona>/<id>.scenario.json`, beside `probe/`. The `kind` string is the discriminator: the A2UI test kit also names its files `*.scenario.json`, and a loader rejects a file whose `kind` it does not own. The parser is strict (an unknown key names its JSON path), the kit's and the admin scenario's precedent.

Shipped meanwhile (T-0225): a live round's scenarios are TypeScript data, one file per preset in `scripts/e2e-admin/probe/scenarios/<preset>.ts` (steps as `chat:probe` flags, `--expect-turn` per step), and `probe/scenarios/round.ts` prints the round's `live-commands.sh`, pinned by `round.test.mjs`. That home stays until T-0176 lands the JSON format above and folds these files into it.

The four existing formats map onto it; T-0176 folds or adapts them rather than keep a second agent-level format:

| Format | `kind` | Owner | Fills | Lacks | Mapping |
|---|---|---|---|---|---|
| kit scenario | `agent-ui-a2ui-scenario` v1 | `tools/testkit/scenario.ts` | turns, `expect` per layer, `expectRed` | persona, models, efforts, tags, user steps | stays its own format: it tests the A2UI layer, not an agent; an eval scenario may reuse its `dataModel` assertion shape |
| probe fixture | `agent-ui-chat-probe` v1 | `probe/model.ts` | agent, model, effort, steps (`say`, `click`), turns with `lines` and `rounds`, `expect.components` | id, tags, models[], efforts[], per-turn expectations | becomes an eval scenario's replay fixture for one model; its `steps` and `expect.components` lift into the scenario |
| agent-eval fixture | none (label files pinned by `fixtures/pins.json`) | `tools/agent-eval/cases.ts` | persona, catalog, prompt, expected type or response type, scripted rounds | steps beyond one prompt, model per case, check names | a case becomes a one-turn scenario with `expect-component`; its scripted rounds become a replay fixture; the leg scores stay `eval:agent-behavior`'s until T-0176 links or folds them |
| admin scenario | `agent-ui-admin-scenario` v1 | `scripts/e2e-admin/scenario.ts` | seed, status, scripted turns per endpoint | persona, checks, model | stays the admin flow's fixture: it drives Builder, Settings and failure paths that no eval scenario covers; a Test Chat flow may be re-expressed as an eval scenario |

- AC1: the T-0176 validator rejects a seeded bad scenario (unknown key, unknown check name, unknown tag) naming the path.
- AC2: every committed eval scenario parses, and a kit scenario fed to the eval loader is rejected on `kind`.

### CL-R2: the check registry (shipped, T-0174; rows planned per ticket)

The code table is the owner: `CHECK_NAMES` and `runChecks` in `scripts/e2e-admin/probe/model.ts`. This table is derived from it.

| Check | Severity | Fails when | State |
|---|---|---|---|
| `model-pick` | fail | the produce request does not carry the requested model or effort | shipped, T-0174 |
| `click-target` | fail | a `--click` step finds no visible surface button with that label | shipped, T-0172 |
| `no-halt` | fail | an error meta-line, a `halt` or `error` trace outcome, or a non-2xx answer | shipped, T-0174 |
| `no-json-as-prose` | fail | the visible chat prose carries A2UI JSON or a meta-line | shipped, T-0174; meta-line shape T-0213; text-shape tail T-0229 |
| `no-internal-leak` | fail | the visible chat prose shows a repair round's correction note or a surface id | shipped, T-0217 |
| `reply-text` | fail | a turn shipped A2UI lines with no reply text, or the chat shows the message tally in place of a reply | shipped, T-0194 |
| `no-surface-loss` | fail | a surface some round created never shipped, or fewer hosts mounted than shipped | shipped, T-0174 |
| `action-updates-surface` | fail | a click turn neither updates the clicked surface nor hands the flow to a surface it creates | shipped, T-0172 |
| `expect-component` | fail | an expected component type never shipped, or a step's own expected type is on no surface its turn updated (`--expect-turn`, T-0222) | shipped, T-0174 |
| `routing-expect` | fail | a step's declared routing (`--expect-routing`: domains, exemplars include and exclude, sections, references with load) misses the turn's trace `routing` block, read by run id live and from the fixture on replay | shipped, T-0260 |
| `render-lint` | fail | a `scripts/dogfood-rules.json` rule the probe runs finds a surface element | shipped, T-0174 (three rules; the rest listed as not run) |
| `reasoning` | warn | effort above low but no thinking text in the trace | shipped, T-0174; still warn after T-0172 merged, so a flip to fail is a new ticket |
| `data-model` | fail | a JSON-pointer assertion on the surface data model does not hold | planned, T-0176 |
| `judge` (per rubric criterion) | measurement only | a rubric criterion scores under its threshold or its quoted evidence is not in the transcript (CL-R8); written after the run by `eval:judge` into the round's `judged/<name>.json`, never run by the probe, never part of a run's checks or verdict, and listed by `eval:signals` in its own Judged checks table, outside the pass rates, `--floor` and `--max-drop` | shipped, T-0178 |

Status law: `fail` makes the run exit 1; `warn` is reported and never fails a run; `skip` names why (no round data, halted turn). A check name is a stable code: a signal row, a baseline and a report key on it, so a rename is a migration, not an edit.

- AC1: `node scripts/chat-probe.mjs selftest` exits 0 with each seeded fixture failing exactly its named checks (shipped).
- AC2: adding a check adds one `CHECK_NAMES` entry, one row here and one line in the e2e-admin README in the same change.

Producer check families. The probe checks above judge a finished turn from outside. A second layer runs inside the turn: semantic checks (ADR-0238, `src/catalog/semantic-check.ts`) whose findings `produce()` feeds into the repair round, so the model self-corrects before the turn ships, and the trace's retry codes name them. Every one ships with a unit test and, where a live trace showed the miss, a keyless replay (CL-R3). Shipped families:

| Family | Owner | Codes | Runs on | State |
|---|---|---|---|---|
| composite moments | one data table, `src/catalog/composite-moments.ts`, turned into checks by one generator | `<COMPOSITE>_MISSING` per row: `BOOKING_FORM_MISSING`, `BOOKING_CONFIRMATION_MISSING`, `BOARD_GRID_MISSING`, `GAME_HUD_MISSING`, `RESULT_CARD_MISSING`, `PRODUCT_CARD_MISSING` (a priced bookable Table, T-0279); `<COMPOSITE>_WRAPPED` for a row's `notInside` (`BOOKING_CONFIRMATION_WRAPPED`, T-0262) | a catalog that holds the composite (`requires`); catalog SPEC CA-R9 | shipped, T-0208 |
| hidden state | `src/catalog/hidden-state-checks.ts` | `WORD_SECRET_MISSING`, `WORD_SECRET_CHANGED`, `WORD_MARK_WRONG`, `FLEET_SECRET_MISSING`, `FLEET_SECRET_CHANGED`, `SHOT_RESULT_WRONG`, `RETURN_FIRE_WRONG` | every catalog, silent unless a surface carries the word-game or Battleship signature, and neither judges the other game's surface (a word cue with no committed fleet, or a fleet with no word, T-0263); the state lives under `/secret` (T-0230 Decision) | shipped, T-0230 |
| persona rules | `PersonaCatalogManifest.semanticChecks`, for example `catalog/personas/croupier/checks.ts` (`BET_TABLE_MISSING`, `HOLE_CARD_CHANGED`) | per persona | the persona's catalog | shipped, T-0172 (bet table), T-0218 (hole cards) |

The text-shape leak (T-0229) is a producer repair, not a check: a meta-line after the prose is peeled wherever it sits and an A2UI line that does not parse goes to the repair round, so `no-json-as-prose` and `no-internal-leak` stay green on Haiku's text-shape turns (replay `croupier-draw-haiku-meta-tail`). A rule the producer is taught but no check backs is a hint, not a guarantee (catalog SPEC CA-R9; skill `a2ui-prompt-authoring`).

### CL-R3: trace to replay (shipped, T-0174)

`npm run chat:probe -- --from-trace <last | last:k | day.jsonl:line>` converts produce traces from `.agent-traces/` into `probe/replays/<name>.json` plus `<name>.test.mjs` (`scripts/e2e-admin/probe/trace.ts`). Rules: lines are never hand-built; each recorded round runs through the real `produce()` with the testkit's scripted provider, threading the session, so self-correct and halts are today's code. The first converted turn must be an intent. The generated test re-derives the lines the same way and asserts every DOM-free check green; it runs in `npm test` (`scripts` project). A test generated from a failing live trace is red until its fix lands and is committed with that fix, or with `expectedFail` (CL-R5) once T-0176 lands. Until then a replay may be pinned to its failing checks with an `// expectedFail: T-NNNN` comment; the fix's change flips the pin to green (#1995, #1997; the re-pin rule is in `scripts/e2e-admin/README.md`, Fixtures and regressions). When the live turn never reached the repaired shape, a fix's replay may have its last round AUTHORED to the repair (the earlier rounds stay as recorded; the test's header comment says which round is authored, T-0281 onward). Such a replay proves the loop mechanics (the check fires, its message reaches the model, a compliant answer ships), not that a live model complies; only the next live round shows that.

- AC1: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0 (shipped).

### CL-R4: the signal row (shipped, T-0342)

The committed round archive is the signal store (CL-R11): there is no separate `.agent-evals/` file. A signal row is one probe run joined in memory, never stored, by `scripts/e2e-admin/probe/signals.ts`: its `ledger.jsonl` row, its `runs/<name>/report.json` (joined by `out`) and its trace lines (joined by the row's `traces` ranges into `traces/<day>.jsonl`). A round with no ledger (r1, r2, t0208) is read from its reports alone, with cost and turns unknown. Where each field lives:

| Field | Home | Meaning |
|---|---|---|
| `runId` | ledger, report, each trace line | the id the probe sent as `x-a2ui-run-id` (T-0259); absent before T-0259 |
| `scenario`, `sample` | derived from `name` over the round's names (the ledger keeps the result from T-0342) | `<scenario>-<model family>-<n>`, or `<scenario>-<n>` when another run of the round shares the stem; any other name is its own scenario, sample 1 |
| `agent`, `model` | ledger, report | preset id and model id as sent |
| `effort` | ledger (from T-0342) | the `--effort` the command passed, else `default`; each trace line carries the effective effort |
| `checks` | report | every CL-R2 result, `{check, turn, status, detail}` |
| `verdict` | ledger, report | `pass`, `fail`, or null when the probe wrote no report (a miss, counted as a fail) |
| `retries` | trace lines, `rounds[].status` and `rounds[].failures[].code` | each failed round and its codes; `trace.failureCodes` names the codes a turn shipped with (`*_UNCORRECTED`, SURFACE_DEGRADED) |
| `tokens`, `costUsd` | ledger | summed provider usage and its estimate at `PRICES` (`probe/ledger.ts`) |
| `latencyMs` | trace lines, `ms` | turn wall time; no field records time to first token, so there is no `ttftMs` |
| `digest` | trace lines, `routing.sections[].digest` | per prompt section; a halted turn carries none. Bundle digests are T-0163 |
| `screenshots` | report, `turns[].screenshot` | absolute paths into the local evidence cache (T-0256) |

The row never carries a key, a header or the system prompt. `npm run eval:signals -- --round <folder>` prints pass rate per scenario x model and per preset x model with sample counts, mixed cells, a histogram of failing checks, producer retry codes as fired / saved / extra USD, spend and latency per turn, section digests per persona, turn outcomes and `trace.failureCodes`, repair and payload shapes, and exemplar retrieval per persona (T-0349); `--against <round>` adds churn on all samples and on like samples, multi-sample cells as rates, and those tallies beside the baseline's runs in the same cells; `--json` prints the same as data. The runner writes the same tables as `signals.md` into each round at archive time.

- AC1: `npx vitest run --project scripts scripts/e2e-admin/probe/signals.test.mjs` exits 0 (shipped): two fixture round folders, one without a ledger, assert cell counts, a mixed cell, histogram counts, retry tallies, churn transitions and a floor miss that exits 1; the committed r8 and r9 rounds reproduce r9's hand-written `report.md` (22 / 28 / 27 of 29, churn 6 / 6 / 4 / 71).

### CL-R5: `expectedFail: T-NNNN` (planned, T-0176)

A scenario known red until a ticket lands names it: `expectedFail: "T-0172"`. A run whose scenario fails as expected records `verdict: 'expected-fail'` and does not fail the runner. A run whose `expectedFail` scenario passes fails the runner with `EXPECTED_FAIL_PASSED`, so the mark is removed in the change that fixed it. The value must match `^T-\d{4}$`.

- AC1: a seeded passing scenario marked `expectedFail` makes the runner exit 1.

### CL-R6: replay versus live, and the CI rule (shipped in part, T-0174; rest planned, T-0176)

- Replay is the default mode and may gate. Gating legs are DOM-free and keyless: `chat-probe.mjs selftest` in `check:scripts` (shipped), the `probe/replays/*.test.mjs` tests in `npm test` (shipped), and the replay of the `smoke` and `regression` tags in `npm test` or `check:scripts` (planned, T-0176).
- Headless browser drivers (`npm run e2e:admin`, `chat:probe -- selftest --browser`, any `chat:probe` page run) are local only and not CI jobs.
- Live never runs in CI, in any job, under any flag. A live run is a person's or an agent's manual run with a key in `.env` at the checkout root.

- AC1: no CI workflow file names `--live`, `eval:matrix` or `eval:judge`.

### CL-R7: the live cap and the key boundary (round cap shipped, T-0225; per-run cap planned, T-0176 and T-0179; boundary shipped)

- Round cap (shipped, T-0225): a live round runs only through `scripts/e2e-admin/probe/run-capped.ts <live-commands.sh> --cap <usd>`, which estimates spend from the `usage` tokens in `.agent-traces/` at `PRICES` (per model family, copied from the claude-api skill's table, never from memory) and starts no run once the estimate reaches the cap. The round lifecycle around it is CL-R11.
- Per-run cap (planned, T-0176 and T-0179): every live scenario run has a spend ceiling, default `$5` per run (Kim, 2026-10-14), set by `--max-usd`. The runner estimates first, accrues `costUsd` from each turn's billed token usage, and hard-stops before the next call that the remaining budget cannot cover; it reports coverage (cells run of cells planned). Judge calls (CL-R8) stop at their own `--cap` (default $5) on `eval:judge`. T-0176 moves `PRICES` beside the trace reader for it.
- Key boundary: keys live only in the dev proxy at `/__a2ui/agent` (ADR-0073 cl.5); the probe, the runner and every row and report read none and print none. The one exception outside the proxy is a keyed CLI arm, as `eval-agent-behavior.ts` does: `scripts/e2e-admin/probe/eval-judge.ts` reads the key only in its `selftest` and `run` arms and passes the provider into `judge.ts`, which reads none (T-0178); a judged file holds no key. Nothing in `@agent-ui/devtools` imports `produce()`, a provider or a key. Shipped for the probe (T-0174: the probe never reads a key; trace lines go through `redactSecrets`).

- AC1: a keyless test of the cap stops a fixture run at the ceiling and reports partial coverage. Shipped in part: `scripts/e2e-admin/probe/run-capped.test.mjs` stops a round of fake probes at the cap read from fake traces (T-0225, runs in `npm test`); the per-run stop and the coverage report land with T-0179.

### CL-R8: judged checks (shipped, T-0178)

A judged check scores what no deterministic check reaches: persona voice, whether the reply answered the question or the move, and asking before acting where no BOOKING_* or other semantic check fires. Deterministic first: a rule checkable from the data model or the surface (bankroll after a hand, card totals, letter marks) is a semantic check (CL-R2 producer families), never a judge criterion.

- Rubrics are data per persona: `scripts/e2e-admin/probe/rubrics/<persona>.md`, a front matter block (`id`, `version`, `threshold`, `criteria`) and a body naming each criterion as a `### <id>: <title>` heading. The body is the judge prompt, read verbatim after a fixed wrapper (the `tools/corpus-genui/legs/judge.ts` pattern), so the standard and the prompt never drift apart. Shipped for croupier, concierge and lexicographer; quizmaster waits for its scenario (T-0343).
- The judge runs on committed round transcripts after the run, not inside it: `npm run eval:judge -- run --round <folder>` builds each run's transcript from its `report.json` (the user's step; the reply the agent sent, from the turn's meta-lines; the words the chat log the user saw gained that turn, a word-level diff of `proseText` against the previous turn's, since the log edits earlier messages in place and a prefix cut would credit a turn with later messages; the surface's component types and literal strings and the data model the turn wrote, the table state a reply is judged against; a long text's head and tail with the middle elided; a halted turn's error) and writes `judged/<name>.json` in the round folder, a new file only (a finished record, a run's report, the round's `signals.md` or an earlier judged file, is never rewritten): the rubric id, version and sha256, the pinned model (`JUDGE_MODEL` in `probe/judge.ts`), `temperature: null` (the 5.5 models accept no sampling parameter and the adapter sends none, so the model default is the pin), per criterion a 1 to 5 score with quotes and whether each quote is in the transcript, the lowest score, the verdict, token usage and estimated cost. The verdict is recomputed from the scores: a criterion passes when it scores at or over the rubric's threshold and its evidence is supported (at least one quote, every quote found in the transcript; an invented quote fails the criterion whatever its score), and a run passes when every criterion does. A provider error leaves its run unjudged and the next goes on; a second in a row stops; every run prints spend, judged, remaining and errors and exits 1 on any error. The cap is checked before each call against the prompt and the `max_tokens` the adapter sends. A judged result is a measurement, never a gate: `eval:signals` lists it in its own Judged checks table (per rubric and model, and per criterion) and never moves a run's verdict, the pass rates, the failing checks, `--floor` or `--max-drop` with it; an invalid judged file is skipped with a warning.
- The key: read only in the CLI's keyed arm (CL-R7 key boundary), never in devtools and never by the probe.

Calibration: each rubric's set is cited committed round runs, known-good passes and known-bad fails, in `probe/rubrics/calibration.json` (round folder, run name, the criterion a bad case visibly misses), never authored transcripts. `npm run eval:judge -- selftest` must score every bad case under its threshold and every good case at or over it, and prints each criterion's score, reason and quotes (found or not) and its cost. It is live only (keyed), a manual measurement under its own `--cap`, and a rubric whose calibration fails may not gate anything. `npm run eval:judge -- check` (keyless, in `check:scripts`) parses every rubric and resolves every citation to a `report.json` of the rubric's persona whose verdict is pass for a good case and fail for a bad one, and checks each rubric's front matter `id` is its file name.

- AC1: three rubrics (croupier, concierge, lexicographer) with calibration sets; the keyless `judge.test.mjs` pins the judged file shape and the threshold verdict with a scripted provider (shipped); the live selftest passes and reports its cost (manual).

### CL-R9: baselines and pass-rate floors (shipped, T-0342)

The baseline is a committed round: it already pins the commit, the prices and the prompt digests, so there is no `--save-baseline` store. `npm run eval:signals -- --round <folder> --against <baseline folder>` prints the churn of every cell (scenario x model family x effort): fail to pass, pass to fail, fail to fail, pass to pass, plus cells in only one round. A cell passes for churn only when every sample passed.

Gates are opt-in flags and reuse the `floorMet` reading of [`lld/genui-b3-judged-eval.lld.md`](../lld/genui-b3-judged-eval.lld.md) §5 (code: `tools/corpus-genui/legs/report.ts`): `--floor <tag>=<rate>` fails a cell whose pass rate is under its tag's floor (`all` covers every tag without its own), and `--max-drop <delta>` fails a cell whose pass rate fell by more than the delta from the baseline. A miss (no report) counts against the cell, a baseline cell with zero samples now fails its floor and counts as a drop to 0 rather than being skipped, and a cell with fewer than `--min-samples` samples (default 3) on a side it is read from is reported, not gated, since a one-sample cell is noise. Rates compare with a 1e-9 slack, so a drop of exactly the delta passes. An unknown floor tag or a stray argument exits 2. Any gated miss exits 1. Until scenarios carry tags (T-0343), the tag is read from the scenario name prefix: `regress-` regression, `routing-` routing, `long-` long, else other. `expected-fail` samples (CL-R5) are not in the archive yet.

- AC1: the CL-R4 test asserts the churn transitions, a floor miss and a drop that exit 1, and a one-sample cell left ungated (shipped).

### CL-R10: digest-affected selection (planned, T-0179; depends T-0163)

`--affected` runs only the scenarios whose persona bundle digest differs from the one recorded in the baseline. T-0163 shipped the digests (each trace line's `bundle.digest`, and `node scripts/agent-content.mjs compile <persona> --json` for the current tree); the flag itself lands with `probe/scenarios/plan.ts` (T-0343), and until then it is refused with a usage error rather than approximated.

### CL-R11: the live round (shipped, T-0184, T-0225, T-0241)

A live round runs many probes in one go to find bugs, not to gate. Kim's ruling (2026-10-15): every round keeps all its traces, payloads and ledgers, so it can be analyzed later; only turn screenshots stay out of git. The how-to is `scripts/e2e-admin/README.md`, Live rounds; this requirement is the lifecycle.

Phase 1, the run:

1. Scenarios: `scripts/e2e-admin/probe/scenarios/<preset>.ts` (CL-R1, shipped meanwhile); `round.ts` prints `live-commands.sh`, Haiku first, then Sonnet, then Opus, so a stop at the cap leaves the cheap cells filled.
2. The capped runner (CL-R7): `run-capped.ts <live-commands.sh> --cap <usd> --round <slug>`, run from the main checkout because lane worktrees are reaped. It skips a run whose `report.json` exists, so a restart resumes.
3. The archive (T-0241): the round home is `.sdlc/evals/rounds/<YYYY-MM-DD>-<slug>/` (the date is the round start). After every run, and again on a cap stop or a crash, the runner writes `traces/<day>.jsonl` (exactly the round window's `.agent-traces` lines), `ledger.jsonl` (one row per run: scenario, sample, effort, agent, model, exit code, verdict, 1-based line ranges into `traces/`, tokens, `costUsd` at `PRICES`), `round.json` (commit, cap, stop reason, window, price table and source, totals) and `README.md`, the round's entry file (every file present, its provenance and how to read it). The final archive (the round's end, a cap stop or a crash) also writes `signals.md`, the round's tables (CL-R4, T-0342). `runs/<name>/` keeps `report.json` and `fixture.json` in git; `runs/*/*.png` is ignored by `.sdlc/evals/.gitignore`. The rounds archived by hand before T-0241 (r1, r2 and the T-0208 probe) carry `traces/`, `runs/`, `report.md` and a `README.md` written by `run-capped.ts --describe`, with no ledger or `round.json`.
4. The index: `.sdlc/evals/README.md`, regenerated by the runner on every archive (or `run-capped.ts --index .sdlc/evals`), lists every round (date, ticket, agents, models, runs, pass, spend when known). It is generated; never edit it by hand.

Phase 2, the follow-through:

5. A `report.md` in the round folder: a findings table with trace lines (`<day>.jsonl:<line>`) as evidence, and a `## Why it failed and how to fix it` decision analysis made with the context-fog-of-war skill on the published round (its fog report id cited): one row per failure cluster with its cause class (CL-R12 triage order), evidence, fix layer, file, the keyless test that proves the fix, and the ticket. The first full one is round 5 (`.sdlc/evals/rounds/2026-10-15-r5-fixes/report.md`, T-0287).
6. One ticket per root cause, not per symptom; each cites the round folder.
7. One keyless replay per finding via `chat:probe -- --from-trace <id>` (CL-R3), pinned to its failing checks with `// expectedFail: T-NNNN`; the fix's change flips the pin to `toEqual([])` (re-pin on fix).

- AC1: `npx vitest run --project scripts scripts/e2e-admin/probe/run-capped.test.mjs scripts/e2e-admin/probe/scenarios/` exits 0 (cap stop, resume skip, archive writers, index, scenario pin).

### CL-R12: routing observability (shipped, T-0239; expected routing T-0260)

Every producer trace line that reaches the model carries a `routing` block (`TraceRouting`, `packages/agent-ui/a2ui/tools/agent/trace-log.ts`): the effective catalog read as base, persona and domains; the referenced skills, playbooks and resources, each with `load` (`index-only` or `full`) and `via` (`index`, `message`, `history`); the selected mini-skill ids; the system prompt sections with char counts and cache side (`stable` or `volatile`); and the cache boundary. Entry content, keys and user secrets are never logged. This is where an index-only miss (T-0231) or an off-domain exemplar (T-0238) shows per turn without hand analysis.

`python3 scripts/agent-traces-to-fog.py <trace.jsonl> --out <session.json>` hydrates a trace file (a day file, or a round's `traces/`) into a context-fog-of-war v2 session: one event per turn, its exposures as sources, retries and failure codes as findings evidence; lines without `routing` fall back to `exemplarIds` and `promptChars`. The skill's `fog.py validate` and `fog.py render` read it, and `library.py publish` puts it in the user-level report library. Its keyless `selftest` rides `check:scripts`. The first example is the round 2 atlas: `.sdlc/evals/rounds/2026-10-15-r2-presets/traces/2026-10-15.jsonl` hydrated to 281 events, 66 sources and 91 findings (`.sdlc/evals/context-fog-of-war-claude-parity.md`, the update of 2026-10-15). A round folder also ingests through the skill's own bundle path with the committed mapping `.sdlc/evals/fog-manifest.json` (T-0248): one `model_request` per trace line and its exemplar ids as chunks, published per round with the report id kept in `.sdlc/evals/fog/<round>.json` and shown in the round README; the adapter stays for what that vocabulary cannot carry (sections, mini-skills, references, failure codes). T-0311: each trace round is also one `model_request` in the mapping (its own `requestId`, the line's `runId`, `maxTokens`, `outputTokens`, `stopReason`), so the skill's stop-at-cap detector reads every round; a section's `digest` names its text in the local prompt store `.agent-traces/prompts/<digest>.txt`.

Triage order for a failed live turn (rounds 3 to 5, T-0275, T-0287): first rule out lost context, that every retrieved exemplar was framed (retrieved == framed) and every tool result reached the next request; round 5 ruled it out on all 169 assessed lines. Then classify each failure cluster as (a) exposure: the guidance never reached the model (an index-only entry, no exemplar framed); (b) conflicting guidance: two rules the model saw disagree, often named in its own reasoning; (c) the model ignored clear guidance it saw; or (d) a check, oracle or scenario defect. Fix (a) and (b) in what the model sees, (d) in the check or the scenario, and treat (c) as a model note (§5) only once (a), (b) and (d) are ruled out.

- AC1: `python3 scripts/agent-traces-to-fog.py selftest` exits 0, and `npx vitest run --project packages packages/agent-ui/a2ui/src/live-agent/agent-trace.test.ts` asserts the routing block for a croupier and a concierge turn.

Expected routing (T-0260): a scenario step may declare the routing its turn should get (`--expect-routing`), and the `routing-expect` check (CL-R2) compares it to the turn's `routing` block, so a round shows expected against actual exposure per turn. The routing pressure pack (`scripts/e2e-admin/probe/scenarios/routing.ts`, round 3) puts an oracle on every step of six scenarios: domain switch, decoy words, a long session with integration-tool turns (so the fog `tool-result-not-propagated` detector has pairs), a doc-only answer whose index-only resource must load `full`, a guidance conflict on hidden state, and two open surfaces then "make it bigger".

- AC2: `node scripts/chat-probe.mjs selftest` exits 0 with the seeded wrong-routing replay red on exactly `routing-expect`, and `npx vitest run scripts/e2e-admin/probe/scenarios/routing.test.mjs` pins the pack to its generator.

## 3. Negative requirements

- CL-N1: no live provider call in CI (CL-R6).
- CL-N2: no key, `produce()` or provider in `@agent-ui/devtools`, the probe, the runner, a row or a report (ADR-0073 cl.5).
- CL-N3: a replay makes no network call to a provider; a replay leg that reaches one fails.
- CL-N4: no live run without a cap; no flag removes it.
- CL-N5: this SPEC adds no ADR clause; a decision here cites its ticket.

## 4. Acceptance summary

Keyless, running today: CL-R2 AC1, CL-R3 AC1, CL-R4 AC1, CL-R9 AC1, CL-R11 AC1 and CL-R12 AC1 and AC2, plus the round-cap half of CL-R7 AC1 (`run-capped.test.mjs`, T-0225) and the producer check families' unit tests (`composite-moments.test.ts`, `hidden-state-checks.test.ts`). Keyless, planned: CL-R1, R5 and R6 AC1, landing with T-0343 under `npm test` or `check:scripts`; T-0343 also repairs CL-R7, whose per-run half the round cap replaces. Keyless, running today for CL-R8: `judge.test.mjs` (the `judge.json` shape and threshold verdict) and `eval:judge -- check` in `check:scripts`. Live and manual: a capped round on a real key (CL-R11; rounds so far in `.sdlc/evals/README.md`), and CL-R8's judge selftest, each reporting its cost.

## 5. Model notes (seen live)

Observations from live rounds 1 to 5 (T-0184, T-0225, T-0261, T-0275, T-0287) and the T-0208 probe, not requirements; a scenario or check that depends on one cites it. The evidence for each is its round folder under `.sdlc/evals/rounds/`.

- Haiku 5.5 skipped `render_surface` on about a quarter of its turns (28 of 103 in round 2) and wrote the text shape (prose, a meta-line, wire lines) or stated a move in prose with no surface update (T-0229, T-0214).
- Sonnet 5.5 and Opus 5.5 played the Croupier's games cleanly (5 of 8 each passed; the rest were scenario defects, one Opus narration and T-0232) and drew the table on every deal; Sonnet may open blackjack-family games already dealt, with no bet strip (T-0232).
- Every model narrated surface mechanics or confessed earlier turns in prose at least once (T-0234).
- Prose did not steer composite choice in round 2: the Concierge drew its composite on 1 of 24 turns, the Lexicographer on 0 of 28, and the Admiral drew BoardGrid but never GameHud or ResultCard, on Haiku and Sonnet (T-0208 Round 2 evidence).
- With a game's hidden state left to memory, Haiku 5.5 admitted its word-game marks were made up and changed a fleet's size mid-game, and Sonnet 5.5 fitted its reveal to the marks after the fact (T-0230; now committed under `/secret` and checked).
- The T-0208 probe (Haiku 5.5, one sample each, about $0.06, `rounds/2026-10-15-t0208-probe/`): the composite moment checks repaired the Lexicographer into BoardGrid and GameHud (`BOARD_GRID_MISSING`, then `GAME_HUD_MISSING`) and the Admiral into GameHud and BoardGrid on turn 1, but both then answered later turns in prose with no surface update, and the Admiral's surrender drew no ResultCard. The Concierge drew no surface at all on its spa booking, so no composite code fired; it stays prose-only (T-0231 tracks the related gap: its facts and `booking-flow` load index-only).
- Rounds 3 to 5 (`rounds/2026-10-15-r{3-routing,4-fixes,5-fixes}/report.md`): Sonnet 5.5 passed 9 of 10 runs in round 5, its one failure a stale oracle (T-0292). Opus 5.5 failed only on the PlayingCard type floor (T-0189) and on scenario defects (T-0272, T-0283). Haiku 5.5 reads shared-grammar lines literally: it refused a complete booking because the user takes "the final action" and shipped no surface on a word-game give-up because "flow-ending turns emit no UI" (round 5 clusters A and C, T-0289, T-0291), where Sonnet read the same lines as intended; the fix lives in persona and repair text, never the grammar (skill `a2ui-prompt-authoring`, Triage).
- Exemplar retrieval ignored domain until T-0238: round 2 Croupier turns got booking and roster exemplars and no card-table one; the fix filters by the turn's selected domains, and the domain exemplars themselves are T-0240.
