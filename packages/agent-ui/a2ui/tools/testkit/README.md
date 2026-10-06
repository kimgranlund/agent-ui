# A2UI test kit

A deterministic, keyless, headless test kit for the A2UI system: one scenario format, scripted doubles on the real seams (transport, provider, MCP server, tools), a deterministic mount and closed interaction loop, a catalog-generated per-type matrix, seeded-defect fixtures per layer, and a seeded mutation fuzz (T-0011). The live-model leg stays separate and manual (`npm run eval:agent-behavior -- live`); nothing here reads a key or the network.

| Where | What |
|---|---|
| `packages/agent-ui/a2ui/tools/testkit/` | the library, the data (`scenarios/`, `__seeded__/`) and the CLI (`kit.ts`) |
| `packages/agent-ui/a2ui/src/testkit/` | the vitest legs (jsdom `*.test.ts`, two `*.browser.test.ts`) |

## Commands

| Command | Runs |
|---|---|
| `npm run test:a2ui-kit` | the jsdom legs, the Node-only tests and `kit.ts selftest` |
| `npm run test:a2ui-kit:browser` | the two real-engine legs in the `packages-rest` shard |
| `node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest` | pins, parse, layer coverage, the green scenarios and every DOM-free seeded fixture; also in `check:scripts` |
| `... kit.ts run <file>` | the DOM-free legs of one scenario or seeded doc; prints `<file>: red layer=<layer> code=<code>` per finding and `skip: needs DOM` per turn with a mounted expectation or an act |
| `... kit.ts list` | every scenario with its catalog and tags |

Exit codes: 0 green, 1 red, 2 usage error or a missing or unparseable file. Run from the repo root: catalogs, selection sidecars and producer prompts load from `process.cwd()`; `--repo-root <dir>` redirects only the kit data dir. The kit legs also run in `npm test` (the `packages` and `tools` projects) and in `test:browser:packages:rest`.

## Tiers

| Tier | Legs | Runs |
|---|---|---|
| plain Node | `kit.ts` (selftest, run, list), `load.test.ts`, `kit.test.ts` | heal, verdict, order, producer, MCP, tools, the seeded fixtures except renderer |
| jsdom | `src/testkit/*.test.ts` | everything above, plus the mounted loop, the per-type matrix over every catalog, the renderer seeded fixture, the fuzz |
| real engine | `interaction.browser.test.ts`, `matrix.browser.test.ts` | the act-driven `lines` scenarios and the two base catalogs' matrix cells, Chromium and WebKit |

Browser-safe modules: `scenario`, `findings`, `judge`, `offline`, `scripted-transport`, `mount`, `interaction`, `catalogs`, `minimal-node`, `matrix`, `load.vite`, `from-conformance`, `mutate`. Node and jsdom only: `producer-leg` (`produce()` reads prompt files from cwd), `catalog-gates` and `seeded` (sidecars through `node:fs`), `load.node` and `kit`. `mount.ts` is the one module that names the control-definition seam (`src/catalog/controls.ts`); a raw-source scan holds every other kit file and leg to that.

## Scenario format (`agent-ui-a2ui-scenario` v1)

One `*.scenario.json` per scenario, expectations inline per turn. The parser (`scenario.ts`) is strict: an unknown key in any kit-owned object is a `ScenarioError` naming its JSON path. Free-form slots are never key-checked: object entries of `lines`, `equals`, `value`, both `input` fields, `input_schema`, and every `clientMessages` entry.

```ts
{ kind: 'agent-ui-a2ui-scenario', version: 1, name, description?, catalogId, intent, turns: ScenarioTurn[], expectRed?: { layer, code } }
ScenarioTurn = { intent?, match?, respond, atFinalize?, expect?, act? }
respond = { lines: (string | object)[] } | { rounds: (string | { tool, input, then })[], maxRounds?, tools?: ScriptedToolSpec[] } | { error: string }
match   = { inputKind?: 'intent' | 'client', textIncludes?, actionName? }
act     = { click: { surfaceId, select, nth? } } | { setValue: { surfaceId, select, nth?, prop, event, value } }
expect  = { heal?, verdict?, produce?, tree?, bindings?, clientMessages?, dataModel?, tools? }
```

- `catalogId` selects the catalog document the verdict uses; the wire `createSurface.catalogId` may differ (the conformance `catalogsNote`).
- `intent` is turn 0's input; `turns[i].intent` (i >= 1) is the input when no act reached that turn.
- `lines` replays raw wire lines; `rounds` feeds the real `produce()` one scripted model text per round (a tool round calls the request's `executeTool` once, records it, then yields `then`); `error` streams one terminal error meta-line.
- A missing `heal`, `verdict` or `produce` means must succeed. `heal.repairs` never lists `single-object-envelope`: per-line heal reports it for every one-object line, so the kit drops it from every repair union.
- `bindings` is opt-in per turn, because an unresolved binding is a legitimate render-time placeholder (SPEC-R4 AC2).
- `setValue` names the control property and the commit event, because `RendererHost` exposes no factory value mark: `prop: 'value', event: 'change'` for a TextField, `prop: 'checked', event: 'change'` for a CheckBox.
- `dataModel` reads the kit's fold of ingested messages (the renderer has no data-model accessor); a `setValue` writeback is observed through the next action's `context` or `dataModel` instead.
- `list` tags derive from content: `lines`, `rounds`, `error`, `act`, `no-response` (an act, and some object in a `lines` turn carries `"wantResponse": false`), `persona`, `a2ui-basic`.
- `fromConformanceFixture` maps every `conformance/fixtures.jsonl` row onto this format. A string payload becomes one raw line whose `expect.heal.ok` is false exactly when the expected verdict holds `PARSE`; the line then reaches the validator's own text arm.

## The loop (`interaction.ts`)

`runScenario(scenario, env)`, with `env = { resolveCatalog(id), createMount?, produceTurn? }`. `produceTurn` (from `producer-leg.ts`) runs a `rounds` turn; its judged findings reach the runner through the scripted transport's `log`. Turn 0 runs on the scenario intent; a later turn runs on `nextTurn(session, action)` when the previous act emitted an action and `shouldRunTurn(action)` holds, else on its own `intent`; otherwise the loop ends. Per turn: pull, order, heal, seeded verdict, ingest, finalize when asked, settle, tree, bindings, data model, act, settle, client messages, session append.

`settle()` waits for every live surface root, two quiet macrotasks and no control load in flight; after 2000 ms (below vitest's 5000 ms default) it rejects with `RENDER_ERROR`, so a stuck cell reports the kit's code, not a vitest timeout.

## Finding codes

| Layer | Codes |
|---|---|
| validator | the native codes `PARSE`, `SCHEMA`, `VERSION_UNSUPPORTED`, `CATALOG`, `IDGRAPH`, `CONTAINMENT`, `POINTER` and `VERDICT_MISMATCH`, for every catalog outside the a2ui-basic family |
| interop | the same native codes and `VERDICT_MISMATCH` on `a2ui-basic`, `a2ui-basic--*` or the canonical `https://a2ui.org/` id (ADR-0169) |
| heal | `HEAL_UNPARSEABLE`, `HEAL_MISMATCH` |
| producer | `ORDER_CONTENT_BEFORE_META`, `TARGET_NOT_MUTATED`, `PRODUCE_HALT`, `PRODUCE_MISMATCH` |
| renderer | `TREE_MISMATCH`, `BINDING_UNRESOLVED`, `RENDER_ERROR`, `CLIENT_MESSAGE_MISMATCH`, `DATA_MODEL_MISMATCH` |
| catalog | `MINIMAL_UNDERIVABLE`, `SELECTION_BIJECTION` |
| integration | `SCRIPT_UNMATCHED`, `SCRIPT_EXHAUSTED`, `SCRIPT_UNCONSUMED`, `TOOLS_MISMATCH`, `MCP_HTTP`, `MCP_TIMEOUT`, `MCP_TOO_LARGE`, `MCP_PARSE`, `MCP_JSONRPC`, `MCP_TOO_MANY_PAGES`, `MCP_TOOL_ERROR` |
| the fixture's own | `SEEDED_NOT_RED`, `SEEDED_WRONG_CODE`, `SEEDED_LAYER_UNCOVERED` |

`findings.ts` `KIT_CODE_LAYER` is the one table; the tripwire's own rejection is `KIT_NETWORK`.

## Seeded defects (`__seeded__/<layer>/`)

One directory per layer (Kim's 2026-10-05 ruling), each with at least one fixture and a `pins.json` (`{ "algorithm": "sha256", "files": { <name>: <hex> } }`) checked by the T-0005 pin rule (`tools/agent-eval/pins.ts`). A fixture is a scenario with `expectRed`, an `agent-ui-a2ui-seeded-catalog` doc (delete `dropEntries` from the live selection sidecar, judge the bijection) or an `agent-ui-a2ui-seeded-mcp` doc (one call through the real MCP client against a scripted server). Red-then-green: each fixture must red FIRST with exactly its pinned layer and code; a green fixture is `SEEDED_NOT_RED`, another first code `SEEDED_WRONG_CODE`, a layer with no fixture `SEEDED_LAYER_UNCOVERED`. A fixture's `expectRed.layer` must equal its directory.

After a deliberate fixture edit, update its pin by hand in the same change:

```sh
shasum -a 256 packages/agent-ui/a2ui/tools/testkit/__seeded__/<layer>/<file>
```

The earlier seeded-defect precedent is the rubric calibration set [`.claude/docs/rubrics/fixtures/a2ui-deceptive-composition`](../../../../../.claude/docs/rubrics/fixtures/a2ui-deceptive-composition/README.md).

## Fuzz (`mutate.ts`)

A seeded PRNG (mulberry32) and a closed operator list, no dependency. Form operators (`fence`, `prose`, `trailing-comma`, `drop-version`) must heal back to the original messages and gain exactly their repair name; semantic operators (`drop-root`, `unknown-type`, `wrong-version`) must draw their native code. Each operator has a precondition: `drop-root` applies only to an `updateComponents` line that delivers `root` plus at least one other node, because a single-node surface with its root dropped is an empty set, which validates outside finalize.

## Offline by construction

Every kit test calls `armOffline()`: `fetch` rejects with `KIT_NETWORK` (in plain Node and jsdom for every URL; in a real page only off-origin, since the vitest browser client fetches its own origin) and every env var ending in the key suffix is removed until disarm. `src/testkit/offline-wiring.test.ts` scans every kit file and leg: each test arms the tripwire, none names the provider adapter or imports the `./agent` barrel, none names a key variable.
