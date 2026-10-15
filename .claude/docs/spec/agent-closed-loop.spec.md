# SPEC: Agent closed-loop testing (scenarios, checks, signal rows, replay and live)

> Status: proposed · v0.1 · 2026-10-14 · Layer: SPEC (execution contract) · solo seat, sdlc-lite run `spec-closed-loop` (T-0181)
> Scope: the loop that drives a real agent turn (live or replayed), checks it, records one signal row and turns a live failure into a keyless regression. Shipped base: T-0174 (`npm run chat:probe`). Planned on this contract: T-0176 (scenario format, runner, signal store), T-0177 (report page), T-0178 (judged checks), T-0179 (live matrix, baselines, affected selection), T-0163 (bundle digests).
> Decisions cite their tickets; the ADR system is frozen (T-0164) and this SPEC adds no ADR clause. Holds unchanged: ADR-0073 cl.5 (keys and `produce()` stay server-side and never enter devtools), the devtools capture contract ([`devtools-harness.spec.md`](./devtools-harness.spec.md)), the A2UI test kit format ([`packages/agent-ui/a2ui/tools/testkit/README.md`](../../../packages/agent-ui/a2ui/tools/testkit/README.md)).
> IDs are file-scoped `CL-R#` and `CL-N#`. Each requirement is marked **shipped** (with its code) or **planned** (with its ticket). When this SPEC disagrees with the tree, the tree wins and this file is repaired.
> Terms: [`references/agent-model.md`](../references/agent-model.md) §3 (probe fixture, eval scenario, signal row, check).

## 1. Definitions

- Eval scenario: one agent use case as data: the persona, the models and efforts it runs on, its tags, the steps a user takes and the checks each turn must pass. The unit the runner (T-0176) plays and the signal store counts.
- Probe fixture: the `agent-ui-chat-probe` v1 file a probe run replays: the preset, the steps and, per produce request, the wire `lines` plus the model `rounds` behind them (`scripts/e2e-admin/probe/model.ts`, `ProbeFixture`).
- Check: one named, deterministic or judged verdict over one turn record, with a status of `pass`, `fail`, `warn` or `skip`.
- Signal row: one line of `.agent-evals/runs.jsonl`, written per scenario run per sample; the store every aggregate, report and baseline reads.
- Replay: every model call answered from recorded rounds or lines; keyless, no network to a provider. Live: the dev proxy calls the provider with its server-side key and spends credit.

## 2. Requirements

### CL-R1: one scenario contract (planned, T-0176)

An eval scenario carries `kind: 'agent-ui-eval-scenario'`, `version: 1`, `id`, `persona` (a preset id), `models[]`, `efforts[]`, `tags[]` (`smoke`, `regression`, `capability`, `persona-rules`), `steps[]` (`say`, `click`, `fill`, `wait`), per-turn `expect` (check names from CL-R2, `expect-component` types, data-model assertions by JSON pointer), an optional replay fixture per model, and an optional `expectedFail` (CL-R5). Home: `scripts/e2e-admin/scenarios/<persona>/<id>.scenario.json`, beside `probe/`. The `kind` string is the discriminator: the A2UI test kit also names its files `*.scenario.json`, and a loader rejects a file whose `kind` it does not own. The parser is strict (an unknown key names its JSON path), the kit's and the admin scenario's precedent.

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
| `no-halt` | fail | an error meta-line, a `halt` or `error` trace outcome, or a non-2xx answer | shipped, T-0174 |
| `no-json-as-prose` | fail | the visible chat prose carries A2UI JSON or a meta-line | shipped, T-0174; meta-line shape T-0213 |
| `no-internal-leak` | fail | the visible chat prose shows a repair round's correction note or a surface id | shipped, T-0217 |
| `no-surface-loss` | fail | a surface some round created never shipped, or fewer hosts mounted than shipped | shipped, T-0174 |
| `expect-component` | fail | an expected component type never shipped, or a step's own expected type is on no surface its turn updated (`--expect-turn`, T-0222) | shipped, T-0174 |
| `render-lint` | fail | a `scripts/dogfood-rules.json` rule the probe runs finds a surface element | shipped, T-0174 (three rules; the rest listed as not run) |
| `reasoning` | warn | effort above low but no thinking text in the trace | shipped, T-0174; flips to fail only in T-0172's change |
| `data-model` | fail | a JSON-pointer assertion on the surface data model does not hold | planned, T-0176 |
| `judge` | fail below threshold | a rubric criterion scores under its threshold (CL-R8) | planned, T-0178 |

Status law: `fail` makes the run exit 1; `warn` is reported and never fails a run; `skip` names why (no round data, halted turn). A check name is a stable code: a signal row, a baseline and a report key on it, so a rename is a migration, not an edit.

- AC1: `node scripts/chat-probe.mjs selftest` exits 0 with each seeded fixture failing exactly its named checks (shipped).
- AC2: adding a check adds one `CHECK_NAMES` entry, one row here and one line in the e2e-admin README in the same change.

### CL-R3: trace to replay (shipped, T-0174)

`npm run chat:probe -- --from-trace <last | last:k | day.jsonl:line>` converts produce traces from `.agent-traces/` into `probe/replays/<name>.json` plus `<name>.test.mjs` (`scripts/e2e-admin/probe/trace.ts`). Rules: lines are never hand-built; each recorded round runs through the real `produce()` with the testkit's scripted provider, threading the session, so self-correct and halts are today's code. The first converted turn must be an intent. The generated test re-derives the lines the same way and asserts every DOM-free check green; it runs in `npm test` (`scripts` project). A test generated from a failing live trace is red until its fix lands and is committed with that fix, or with `expectedFail` (CL-R5) once T-0176 lands.

- AC1: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0 (shipped).

### CL-R4: the signal row (planned, T-0176)

Every scenario run appends one row per sample to `.agent-evals/runs.jsonl` at the repo root, git-ignored like `.agent-traces/` (only `.agent-traces/` is ignored today; T-0176 adds the line). Row, `v: 1`:

| Field | Type | Meaning |
|---|---|---|
| `runId` | string | one id per runner invocation; every row of the invocation shares it |
| `at` | ISO string | row write time |
| `scenario` | string | eval scenario `id` |
| `persona` | string | preset id |
| `model`, `effort` | string | as sent, read back from the produce request |
| `mode` | `replay` or `live` | |
| `sample` | integer | 1..N within the run |
| `digest` | string | prompt bundle digest (T-0163); until then the assembled-prompt sha256, with `digestKind: 'bundle' or 'prompt'` |
| `checks` | `{check, turn, status, detail?}[]` | every CL-R2 result |
| `verdict` | `pass`, `fail` or `expected-fail` | |
| `expectedFail` | string, optional | the `T-NNNN` the scenario names |
| `retries` | `{count, codes[]}` | self-correct rounds and their failure codes |
| `tokens` | `{in, out}` | summed provider usage |
| `costUsd` | number or null | `tokens` times the price table; null in replay |
| `latencyMs`, `ttftMs` | number | turn wall time, time to first wire line |
| `traceIds` | string[] | `<day>.jsonl:<line>` refs into `.agent-traces/` (live only) |
| `screenshots` | string[] | paths relative to the repo root |

The row never carries a key, a header or the system prompt. A signal row is per scenario run; a trace line (T-0151, `tools/agent/trace-log.ts`) is per live turn; `traceIds` links them.

- AC1: a keyless test writes rows from a replay run and `npm run eval:signals` reads them back: pass rate per scenario x model, flaky (mixed) cells, failure-code histogram, retry and retry-surface-loss rates, cost and latency per turn.

### CL-R5: `expectedFail: T-NNNN` (planned, T-0176)

A scenario known red until a ticket lands names it: `expectedFail: "T-0172"`. A run whose scenario fails as expected records `verdict: 'expected-fail'` and does not fail the runner. A run whose `expectedFail` scenario passes fails the runner with `EXPECTED_FAIL_PASSED`, so the mark is removed in the change that fixed it. The value must match `^T-\d{4}$`.

- AC1: a seeded passing scenario marked `expectedFail` makes the runner exit 1.

### CL-R6: replay versus live, and the CI rule (shipped in part, T-0174; rest planned, T-0176)

- Replay is the default mode and may gate. Gating legs are DOM-free and keyless: `chat-probe.mjs selftest` in `check:scripts` (shipped), the `probe/replays/*.test.mjs` tests in `npm test` (shipped), and the replay of the `smoke` and `regression` tags in `npm test` or `check:scripts` (planned, T-0176).
- Headless browser drivers (`npm run e2e:admin`, `chat:probe -- selftest --browser`, any `chat:probe` page run) are local only and not CI jobs.
- Live never runs in CI, in any job, under any flag. A live run is a person's or an agent's manual run with a key in `.env` at the checkout root.

- AC1: no CI workflow file names `--live`, `eval:matrix` or `eval:judge`.

### CL-R7: the live cap and the key boundary (planned cap, T-0176 and T-0179; boundary shipped)

- Cap: every live run has a spend ceiling, default `$5` per run (Kim, 2026-10-14), set by `--max-usd`. The runner estimates first, accrues `costUsd` from each turn's billed token usage, and hard-stops before the next call that the remaining budget cannot cover; it reports coverage (cells run of cells planned). Judge calls (CL-R8) count against the same cap. Precondition: a price table per model id, which no module carries today (`trace-log.ts` records `usage` tokens only); T-0176 adds it as data beside the trace reader.
- Key boundary: keys live only in the dev proxy at `/__a2ui/agent` (ADR-0073 cl.5); the probe, the runner, the judge client and every row and report read none and print none. Nothing in `@agent-ui/devtools` imports `produce()`, a provider or a key. Shipped for the probe (T-0174: the probe never reads a key; trace lines go through `redactSecrets`).

- AC1: a keyless test of the cap stops a fixture run at the ceiling and reports partial coverage (T-0179).

### CL-R8: judged checks (planned, T-0178)

A `judge` expectation names a rubric id and a threshold. Rubrics are data per persona or capability. The judge runs through the dev proxy with a pinned model id and temperature recorded in the row, returns a score per criterion with quoted evidence from the transcript, and its results join the row's `checks`. Deterministic first: a rule checkable from the data model or the surface (bankroll after a hand, card totals) is a `data-model` check or a semantic check, never a judge criterion.

Calibration: each rubric ships a seeded known-good and known-bad transcript set; `npm run eval:judge -- selftest` must score every bad case under threshold and every good case over it. It is live only (keyed), counted against the cap, and a rubric whose calibration fails may not gate anything.

- AC1: three rubrics (croupier, concierge, quizmaster) with calibration sets; the live selftest passes and reports its cost.

### CL-R9: baselines and pass-rate floors (planned, T-0179)

`--save-baseline <name>` stores per-cell (scenario x model x effort) pass rates and metrics. A later run compares against the latest baseline. Floors reuse the `floorMet` reading of [`lld/genui-b3-judged-eval.lld.md`](../lld/genui-b3-judged-eval.lld.md) §5 (code: `tools/corpus-genui/legs/report.ts`): a cell passes when at least k of its at most N samples pass, a miss (no output, halt) counts against the cell rather than being dropped, a cell with zero samples fails rather than being skipped, and the run's floor is met only when every cell passes. The floor is per tag (for example `smoke`: 0.9 over N samples); a cell also fails when its pass rate drops by more than a set delta from the baseline. `expected-fail` samples are excluded from a floor and reported beside it.

- AC1: a keyless test on a fixture store asserts planning order (regression, smoke, capability), cap stop and the baseline comparison.

### CL-R10: digest-affected selection (planned, T-0179; depends T-0163)

`--affected` runs only the scenarios whose persona bundle digest differs from the one recorded in the baseline. Until T-0163 ships `compile()` digests, `--affected` is refused with a usage error rather than approximated.

## 3. Negative requirements

- CL-N1: no live provider call in CI (CL-R6).
- CL-N2: no key, `produce()` or provider in `@agent-ui/devtools`, the probe, the runner, a row or a report (ADR-0073 cl.5).
- CL-N3: a replay makes no network call to a provider; a replay leg that reaches one fails.
- CL-N4: no live run without a cap; no flag removes it.
- CL-N5: this SPEC adds no ADR clause; a decision here cites its ticket.

## 4. Acceptance summary

Keyless: CL-R2 AC1 and CL-R3 AC1 run today. CL-R1, R4, R5, R6, R7 AC1 land with T-0176 and T-0179 under `npm test` or `check:scripts`. Live and manual: CL-R7's cap on a real run, CL-R8's judge selftest and T-0179's baseline run, each reporting its cost.
