<!-- role=architect level=L1 model=fable effort=high -->
## Approach

The kit is a library of scripted doubles and judges on seams that already exist. No new runner, no production behavior change. Three tiers, as fork 1 recommends:

- Pure legs (heal, validator, line order, producer, MCP, tools) run in plain Node and jsdom.
- Mounted-renderer legs and the per-type matrix run in jsdom Vitest.
- One click-loop file and one matrix smoke file run in the existing `packages-rest` browser shard.

The kit lives in `packages/agent-ui/a2ui/tools/testkit/` (unpublished, typed by `check:tools`, importable by site tests and `scripts/` by relative path). Its vitest legs live in `packages/agent-ui/a2ui/src/testkit/`, because the browser shard only globs `src/**`. The legs import only the DOM-safe kit modules.

The handoff's sharing premise is inverted. T-0010 already built its own `AdminScenario` and `scripts/lib/dev-server.mjs` on `feat/admin-headless-flows`, and T-0005's `scripted-turns.json` is merged and hash-pinned. The kit supplies neither of them anything and migrates no fixture. It aligns instead: one envelope whose per-turn reply is either `lines` (raw wire lines, the atom `RecordedTurn.lines` and T-0010's `respond.lines` share) or `rounds` (raw model text per round, T-0005's arm). The `match` vocabulary is T-0010's `inputKind` and `textIncludes` plus `actionName`. HTTP arms stay T-0010's.

Fork 2: one `*.scenario.json` per scenario with expectations inline per turn. This is what the conformance fixtures, T-0005 and `RecordedTurn.expectClientMessage` already do. Existing conformance rows run through the same judge via an adapter.

Two doubles sit on two different seams:

- The scripted transport replays `lines` turns, chosen by the incoming `TurnInput`. It is browser-safe.
- The scripted provider feeds `rounds` to the real `produce()`, so repair, halt and validate-then-stream are the shipped code. `produce()` reads prompts from disk at import, so `rounds` turns run in Node and jsdom only.

The loop driver pulls a turn, checks order and the cross-turn verdict, ingests into a deterministic mount, runs expectations, performs the act, and frames the emitted client message with the real `nextTurn` and `shouldRunTurn`.

The matrix is generated from the catalogs, never listed. A probe of the real validator found 384 type cells across 8 catalogs (2 bases plus 3 personas on both). Only 6 bare-root cells fail, all derivable: three `PropDef.required` props and three Card-region containment cases.

Seeded defects are data under `tools/testkit/__seeded__/<layer>/` with an `expectRed {layer, code}` and a `pins.json` per directory. They are verified by the existing `verifyPins`. Fuzz is a seeded PRNG with a closed operator list.

Build base is main with PR #1824 merged. Control definition sits behind `mount.ts` alone.

## Interfaces

New library files under `packages/agent-ui/a2ui/tools/testkit/`:

- `scenario.ts`: `A2uiScenario { kind: 'agent-ui-a2ui-scenario', version: 1, name, catalogId, turns: ScenarioTurn[], expectRed?: { layer, code } }`.
  - `ScenarioTurn { match?: { inputKind?, textIncludes?, actionName? }, respond: { lines: (string | object)[] } | { rounds: string[], maxRounds? } | { error: string }, atFinalize?, expect?: TurnExpect, act?: { click | setValue: { surfaceId, select, nth? } } }`.
  - `TurnExpect { heal?, verdict?, produce?, tree?, bindings?, clientMessages?, dataModel?, tools? }`.
  - `parseScenario(text)` raises `ScenarioError` with a JSON path; `toRecordedTranscript(scenario)`.
- `findings.ts`: `LAYERS = ['validator','heal','renderer','catalog','producer','integration','interop']`, `KitFinding { layer, code, path?, detail? }`, `ScenarioResult { name, ok, findings }`.
- `judge.ts`: `judgeHeal`, `judgeVerdict` (set compare of `(code, path)`, `atFinalize`, session seeds), `orderDefects(lines)`. Codes: `HEAL_UNPARSEABLE`, `VERDICT_MISMATCH`, `ORDER_CONTENT_BEFORE_META`, `TARGET_NOT_MUTATED`; native validator codes pass through.
- `from-conformance.ts`: `fromConformanceFixture(row): A2uiScenario`.
- `scripted-transport.ts`: `createScriptedTransport(scenario, { produceTurn? }): AgentTransport & { log }`. Codes: `SCRIPT_UNMATCHED`, `SCRIPT_EXHAUSTED`.
- `scripted-provider.ts`: `scriptedProvider(rounds: (string | { tool, input, then })[]): AgentProvider`.
- `producer-leg.ts`: `runProducerTurn(input, rounds, catalog, opts)` returns `{ outcome, rounds, failureCodes, lines }`. Code: `PRODUCE_HALT`.
- `scripted-mcp.ts`: `scriptedMcpServer(script): { handle(req: Request): Promise<Response>, fetchImpl, calls }`.
- `scripted-tools.ts`: `scriptedTools(script): { manifests: IntegrationManifest[], calls }`.
- `mount.ts`: `createKitMount({ loader?: 'builtin' | 'url' }): { host, root, ingest(lines), settle(), clientMessages(), dispose() }`.
- `interaction.ts`: `runScenario(scenario, env): Promise<ScenarioResult>`. Codes: `TREE_MISMATCH`, `BINDING_UNRESOLVED`, `RENDER_ERROR`, `CLIENT_MESSAGE_MISMATCH`, `DATA_MODEL_MISMATCH`.
- `catalogs.ts` (`allCatalogs()`), `minimal-node.ts` (`minimalMessages(catalog, type)`, code `MINIMAL_UNDERIVABLE`), `catalog-gates.ts` (predicates lifted from `selection-guidance.test.ts`).
- `seeded.ts` (`runSeeded(fixtures)`; codes `SEEDED_NOT_RED`, `SEEDED_WRONG_CODE`, `SEEDED_LAYER_UNCOVERED`), `mutate.ts` (`mutate(messages, seed)`).
- `offline.ts` (`armOffline()`, code `KIT_NETWORK`), `load.vite.ts`, `load.node.ts`.
- `kit.ts`: guarded CLI with `selftest | run <file> | list`, exit 0, 1, 2.
- Data: `scenarios/*.scenario.json`, `__seeded__/<layer>/*.json` plus `pins.json`. Docs: `README.md`. Node-only tests: `kit.test.ts`, `load.test.ts`.

New legs under `packages/agent-ui/a2ui/src/testkit/`: one `*.test.ts` per library module, plus `scenarios`, `matrix`, `integration`, `seeded`, `fuzz`, `offline-wiring`, and `interaction.browser.test.ts`, `matrix.browser.test.ts`.

Changed files:

- `packages/agent-ui/a2ui/src/renderer/validate.ts`: export the containment map.
- `packages/agent-ui/a2ui/src/agent/produce.ts`: export `sessionSurfaceSeeds`.
- `packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts`: import the lifted predicates; negative-control count unchanged.
- `vitest.config.ts`: one include line in the `tools` project.
- `package.json`: `test:a2ui-kit`, `test:a2ui-kit:browser`, selftest appended to `check:scripts`.
- `vitest.browser.config.ts`: unchanged, unless a leg proves focus-sensitive.

## Constraints and assumptions

- Browser legs must sit under `src/`: verified by the `packages-rest` include `packages/agent-ui/*/src/**/*.browser.test.ts` (`vitest.browser.config.ts:286`).
- jsdom legs under `src/testkit/` need no config edit: verified by the `packages` glob (`vitest.config.ts:47`).
- Node-only kit tests need an explicit `tools` project line: verified by the explicit list and its no-wildcard rule (`vitest.config.ts:139`).
- `node:` imports type-check under root `tsc`: verified, `src/live-agent/mcp-boot.test.ts:27` imports `node:fs` and `tools/agent/dev-proxy-plugin.ts`; only the `process` global needs a `declare`.
- Plain Node cannot import catalog modules or `personas/manifests.ts`: verified by probe (`ERR_IMPORT_ATTRIBUTE_MISSING`). The Node loader composes personas from `catalog.json` via `loadCatalogFragment` and `composeCatalog`, with a parity test against the module catalogs.
- `produce()` needs cwd at repo root and cannot load in a browser page: verified by `src/agent/system-prompt.ts:66` and a failed import probe from the package directory.
- 384 cells, 6 bare-root failures (Image `alt`, Video `label`, AudioPlayer `label`, three Card regions): verified by running `validateA2ui` with `atFinalize` over every type of all 8 catalogs.
- An unresolved binding raises no error (`src/renderer/binding.ts:43-55`), so the renderer-layer defect is caught by the kit's `BINDING_UNRESOLVED` check and tree assertions: verified by reading.
- `RendererHost` has no data-model accessor: verified (`src/renderer/renderer.ts:161-183`). Data-model expectations read the action's context or `sendDataModel` payload and the kit's own fold of ingested lines.
- Nodes carry no A2UI id in the DOM; only the surface root is marked (`renderer.ts:752`): verified. Acts and tree assertions use a selector scoped to `[data-a2ui-surface]`.
- After #1824, apply is deferred until controls load, so the mount must await a settle: verified by the `renderer.ts:63-74` header and `builtin-controls.test.ts:88`.
- Every control upgrades cleanly in jsdom through `builtinControls`: unverified. The planner's first matrix step must prove it.
- `TOOL_CALL_TIMEOUT_MS` is a non-injectable 30 s constant, reachable only by fake timers (`tool-dispatch.ts:37`, `tool-dispatch-timeout.test.ts:38`): verified. The integration seeded defect uses the MCP client's injectable `timeoutMs` (`mcp/client.ts:39`) and pins `McpClientError` code `timeout`.
- The scripted MCP server plugs into existing seams: verified, `McpClientOptions.fetchImpl` (`client.ts:37`), `DiscoveryDeps.createClient` and `register` (`discover.ts:51,58`), `mcpDiscovery` (`dev-proxy-plugin.ts:182`).
- Pins reuse `verifyPins(dir)` (`tools/agent-eval/pins.ts:27`), which is generic over any directory: verified. Kim's fork 4 ruling (2026-10-05) covers the rule.
- The directory location `tools/testkit/__seeded__/<layer>/` is my recommendation: unverified with Kim.
- ADR-0206 is the `target` meta-line arm; validate-then-stream is SPEC-R5: verified by reading the ADR. The kit asserts both: meta-lines before content, and a named target mutated in that turn.
- Keyless by structure: no kit file imports `src/agent/index.ts` (it re-exports the Anthropic adapter at `:32`) or names a key, enforced by a raw-source scan with a negative control: verified.
- A blanket `fetch` stub may break vitest's browser client: unverified. The browser tripwire therefore throws only for off-origin URLs; jsdom and Node throw for every URL.
- Fork 6: build after #1824 merges (the PR is open); step 1 carries `Depends on: #1824 merged`: unverified with Kim.
- "Adding a type reds the gate until covered" is read as: a new type gets a generated cell and reds if it cannot be derived, validated or mounted. No per-type hand file: unverified with Kim.

## Rejected alternatives

- JSONL stream plus a sibling `.expect.json`: a flat stream has no turn boundaries or client acts. Per-turn expectations in a second file drift by index. Every precedent here is inline.
- Migrating T-0005 or T-0010 fixtures to the kit format: both are built, and T-0005's are hash-pinned acceptance cases. Alignment costs nothing.
- Kit library under `src/`: `tools/` is the unpublished, Node-typed home and the handoff's constraint.
- Browser tests under `tools/testkit/`: they would run in no shard.
- One hand-kept `__seeded__/` next to each layer's source: scatters data across `src/` and the integrations tree. One root keeps discovery to a single directory read.
- A second pin implementation: `verifyPins` is already generic.
- Importing `planted.ts` for the interop defect: `layering.test.ts:150` forbids non-test importers. The plant is committed JSON.
- Duplicating the selection predicates in the kit: two copies of one rule drift. Lift them and keep the test's negative controls.
- Reimplementing cross-turn seeds or the Card containment set in the kit: export the originals.
- Stamping `data-a2ui-id` on rendered nodes: changes shipped DOM for a test need.
- Driving the 30 s dispatch deadline in the seeded fixture: needs fake timers, so it cannot run in the Node selftest.
- `@playwright/test`, a new vitest project, or a `fast-check` dependency: ruled out by the ticket.
- A browser run of all 384 cells: persona-derived cells repeat the base controls. Two base catalogs prove the real-engine loader.

## Risks

- If many controls fail to upgrade in jsdom, the matrix mount leg moves to the browser shard and its cost rises.
- Selector-based acts couple scenarios to factory tags. A catalog `mapsTo` change reds scenarios, not only the matrix.
- The binding check covers absolute pointers and list-template paths. A new binding form would pass unseen until the check is extended.
- Programmatic `click` and value events avoid focus. If a control needs real focus, that file must join `FOCUS_TIMING_FILES`.
- `src/testkit/` adds jsdom files to `npm test` and two files to `packages-rest`. If that shard nears its heap, the matrix smoke is the first to trim.
- GH #1812 (persona manifest) and GH #1811 (catalog split) can move the paths the Node loader reads. The parity test reds, which is the intended signal.
- T-0004's captured payload is not recorded yet, so its regression scenario is an empty slot.
- If Kim wants per-layer seeded directories beside the source, the loaders and the layer-coverage gate change shape.

## Carry forward

- Line numbers below are from the no-barrels tree (`.claude/worktrees/wave-nobarrels`, branch `feat/no-barrels`, PR #1824 open); the main checkout is behind `origin/main`.
- Decomposition: `.sdlc/a2ui-test-kit/decompose/manifest-v1.json` (33 leaves, 44 actions, clean in plan and strict mode) and `decompose/report.md`. The handoff Context still needs `Decomposition: decompose/report.md`.
- T-0010's format is already built: `scripts/e2e-admin/scenario.ts:7-25` on `feat/admin-headless-flows` (commit 58289be8). The handoff's `depends` and Dependencies text should say "align", not "supply".
- Seams: `AgentTransport` `src/agent/agent-transport.ts:79`, `AgentProvider` `:138`, `ProduceDeps` `src/agent/produce.ts:94`, `produce` `:969`, `createRecordedTransport` `src/agent/recorded-transport.ts:89`.
- Non-exported today: `sessionSurfaceSeeds` `src/agent/produce.ts:928`, `CARD_REGION_TYPES` `src/renderer/validate.ts:395` (used at `:415`).
- Required-prop rule: `src/catalog/conformance.ts:75`. Persona composition: `composePersonaCatalogDocs` `src/catalog/compose.ts:306`, `derivedCatalogId` `:100`.
- Session reducer: `nextTurn` `src/agent/session.ts:76`, `shouldRunTurn` `:95` (only an explicit `wantResponse: false` skips the turn).
- Renderer DOM markers: `data-a2ui-surface` `src/renderer/renderer.ts:752`, `a2ui-placeholder` `src/renderer/widget.ts:237`.
- MCP seams: `fetchImpl` and `timeoutMs` `tools/agent/integrations/mcp/client.ts:37,39`, `register` and `createClient` `mcp/discover.ts:51,58`, `mcpDiscovery` `tools/agent/dev-proxy-plugin.ts:182`, `TOOL_CALL_TIMEOUT_MS` `integrations/tool-dispatch.ts:37`.
- Pins: `verifyPins` `tools/agent-eval/pins.ts:27`. Scripted provider precedent: `tools/agent-eval/scripted.ts`.
- Vitest globs: `packages` `vitest.config.ts:47`, `tools` explicit list ends at `:139`, `packages-rest` `vitest.browser.config.ts:286`.
- Never import `src/agent/index.ts` (re-exports Anthropic at `:32`) or `tools/harness/validate-payload.ts` (runs `main()` on import). `planted.ts` importers are gated at `src/layering.test.ts:150`.
- Matrix probe: 8 catalogs, 384 cells, 6 bare-root failures (Image, Video, AudioPlayer, CardHeader, CardContent, CardFooter on `agent-ui` bases). Reproduce with `validateA2ui(..., undefined, { atFinalize: true })` over catalogs composed from `src/catalog/**/catalog.json`.
- Existing scripted-transport copies the kit could later replace (out of scope): `grep -rn "function scriptedTransport" site/pages` (4 files) and `packages/agent-ui/devtools/src/transports/replay.ts:28`.
- Kim rulings outstanding: seeded directory location (recommended `tools/testkit/__seeded__/<layer>/`), build after #1824 (recommended), no visual baselines (recommended).
