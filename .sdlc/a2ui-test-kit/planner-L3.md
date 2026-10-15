<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Build the keyless, deterministic A2UI test kit under `packages/agent-ui/a2ui/tools/testkit` (library, data, CLI) with its vitest legs under `packages/agent-ui/a2ui/src/testkit`. The kit covers the scenario format, judges, scripted transport, provider, MCP server and tools, the mount fixture and interaction loop, the catalog-generated per-type matrix, seeded defects and fuzz, and two browser legs. Then wire its commands and apply the scrub list, with every gate green by exit code.

## Step 1: Scenario core, judges, conformance adapter, offline tripwire and the two seams
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Path shorthand: K = `packages/agent-ui/a2ui/tools/testkit` and L = `packages/agent-ui/a2ui/src/testkit`.

- Decompose leaves: n_seams, n_format, n_findings, n_judge, n_conformance, n_leg_offline.
- Interfaces follow `.sdlc/a2ui-test-kit/architect-L1.md` (`## Interfaces`) except where this Do settles otherwise.
- Build on a lane cut at or after origin/main `4d90e826` (#1824 merged).
- Depends on: none.

**Seams.** These are production edits with no behavior change.

1. `packages/agent-ui/a2ui/src/renderer/validate.ts`: export the module-private Card containment set as `export const CARD_REGION_TYPES: ReadonlySet<string>`.
   - Do not add it to `src/renderer/index.ts`. That file uses named re-exports only, so the barrel stays the same.
2. New `packages/agent-ui/a2ui/src/agent/surface-seeds.ts` exports `sessionSurfaceSeeds(session: Session): Map<string, SurfaceSeed>`.
   - Move the body and doc comment verbatim out of `src/agent/produce.ts`. produce.ts then imports the function from `./surface-seeds.ts`.
   - Why a new module and not the architect's export from produce.ts: produce.ts imports `system-prompt.ts`, whose `loadPrompt` reads `process.cwd()`-relative prompt files at import time. Anything that imports produce.ts therefore cannot load in a browser page, and the Step 5 browser loop imports judge.ts.
   - Why not `session.ts`: `src/agent/index.ts` does `export * from './session.ts'`, which would publish the function on `@agent-ui/a2ui/agent`. Never add surface-seeds.ts to `src/agent/index.ts`.
   - Its imports are type-only, so the NODE-FENCE and SDK-FREE legs of `src/agent/gates.test.ts` still hold.
   - Rewrite every em dash in the moved comment as a colon or comma. The em-dash guard counts added lines.
3. Record repairs for the move:
   - `.claude/docs/lld/a2ui-validator-finalize.lld.md`: the line naming produce.ts's `sessionSurfaceSeeds` must name `src/agent/surface-seeds.ts`.
   - `.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield.md`: its source-of-truth list must name `src/agent/surface-seeds.ts`.
   - Left alone on purpose: `src/corpus/admit.ts` (its comment names no file) and `site/.fixture-scratch/assets/*.js` (stale committed build output that no gate reads).
4. `vitest.config.ts`: add exactly one explicit line `'packages/agent-ui/a2ui/tools/testkit/*.test.ts',` to the `tools` project include list.
   - Add a short comment in the existing GH #112 style: kit.ts carries the CLI-entry guard.
   - No step touches `vitest.browser.config.ts`.

**Library in K.**
- `scenario.ts`:
  - `A2uiScenario` (`kind: 'agent-ui-a2ui-scenario'`, `version: 1`), with `ScenarioTurn` and `TurnExpect` as in the architect file.
  - The match vocabulary is `inputKind` (`intent` or `client`, from `TurnInput` in `src/agent/agent-transport.ts`), `textIncludes` and `actionName`.
  - `parseScenario(text)` is strict: an unknown field raises `ScenarioError`, and the message names the JSON path (for example `$.turns[0].respond.foo`).
  - Object lines normalize to one JSON string.
  - Also exports `toRecordedTranscript(scenario)`.
- `findings.ts`:
  - `LAYERS = ['validator','heal','renderer','catalog','producer','integration','interop'] as const`.
  - `KitFinding { layer, code, path?, detail? }` and `ScenarioResult { name, ok, findings }`.
- `judge.ts`:
  - `judgeHeal`.
  - `judgeVerdict`: a set compare of `(code, path)` pairs, with `atFinalize` and cross-turn seeds built by `sessionSurfaceSeeds` over the prior turns.
  - `orderDefects(lines)`: yields `ORDER_CONTENT_BEFORE_META` when an `a2uiMeta` line follows a content line in one turn (SPEC-R5 validate-then-stream). Yields `TARGET_NOT_MUTATED` when no content line of that turn mutates the meta-line's `target.surfaceId` (ADR-0206).
  - Kit codes are `HEAL_UNPARSEABLE` and `VERDICT_MISMATCH`. Native validator codes pass through.
  - Use `readMetaLine` from `src/agent/meta-line.ts` (no imports, browser-safe). judge.ts never imports produce.ts.
- `from-conformance.ts`: `fromConformanceFixture(row): A2uiScenario` makes one `lines` turn, takes its expectation from `expectedVerdict`, and passes `atFinalize` through.
- `offline.ts`: `armOffline(): () => void`.
  - It replaces `globalThis.fetch` with a function that throws an Error whose message starts `KIT_NETWORK`.
  - In Node and jsdom it throws for every URL. Detect jsdom by no `navigator`, or a `navigator.userAgent` that contains `jsdom`.
  - In a real browser page it throws only for URLs whose origin differs from `location.origin`, because the vitest browser client fetches same-origin.
  - It deletes every env var whose name ends `_API_KEY` from `globalThis.process?.env` when present.
  - The returned disarm restores both.
  - Reach `process` through a `globalThis` cast so the file type-checks under the root tsconfig, which has no node types.

**Legs in L.** Each file calls `armOffline()` in `beforeAll` and the disarm in `afterAll`.
- `scenario.test.ts`:
  - An unknown field raises `ScenarioError` naming its path.
  - An object line normalizes to one JSON string.
  - `toRecordedTranscript` replays byte-identical lines through `createRecordedTransport`.
- `findings.test.ts`: LAYERS is exactly the seven names, in order.
- `judge.test.ts`, negative controls:
  - A content line before a meta-line yields `ORDER_CONTENT_BEFORE_META`.
  - A meta-line target that no content line touches yields `TARGET_NOT_MUTATED`.
  - One extra `(code, path)` pair yields `VERDICT_MISMATCH`.
  - An unhealable fence yields `HEAL_UNPARSEABLE`.
  - A two-turn root resend without `createSurface` yields native `IDGRAPH` at `s:root` (probed).
- `from-conformance.test.ts`:
  - Every row of `packages/agent-ui/a2ui/conformance/fixtures.jsonl` runs green through judge.ts. Read the row count from `fixtureCount` in `conformance/manifest.json`; never pin it.
  - One row with a flipped `expectedVerdict.valid` runs red.
- `offline-wiring.test.ts`:
  - A fetch after `armOffline` throws `KIT_NETWORK`.
  - A raw-source scan confirms every `*.test.ts` under L and K calls `armOffline`.
  - No file under K or L names `anthropicProvider` or an identifier ending `_API_KEY`, or imports `src/agent/index.ts` or `@agent-ui/a2ui/agent`.
  - One planted-violation negative control per rule.
  - Assemble the forbidden strings at run time (the `spec()` join idiom in `layering.test.ts`) so the file never trips its own scan.

offline-wiring.test.ts rescans both trees at every later step, so every later test file must arm the tripwire.
### Acceptance criteria
- `for f in scenario findings judge from-conformance offline; do test -f "packages/agent-ui/a2ui/tools/testkit/$f.ts" || exit 1; done && for f in scenario findings judge from-conformance offline-wiring; do test -f "packages/agent-ui/a2ui/src/testkit/$f.test.ts" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/scenario.test.ts packages/agent-ui/a2ui/src/testkit/findings.test.ts packages/agent-ui/a2ui/src/testkit/judge.test.ts packages/agent-ui/a2ui/src/testkit/from-conformance.test.ts packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts` exits 0
- `for c in ORDER_CONTENT_BEFORE_META TARGET_NOT_MUTATED VERDICT_MISMATCH HEAL_UNPARSEABLE; do grep -q "$c" packages/agent-ui/a2ui/src/testkit/judge.test.ts || exit 1; done`
- `for s in ScenarioError toRecordedTranscript createRecordedTransport; do grep -q "$s" packages/agent-ui/a2ui/src/testkit/scenario.test.ts || exit 1; done && grep -q fixtureCount packages/agent-ui/a2ui/src/testkit/from-conformance.test.ts && grep -q KIT_NETWORK packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts`
- `grep -q '^export const CARD_REGION_TYPES' packages/agent-ui/a2ui/src/renderer/validate.ts && grep -q '^export function sessionSurfaceSeeds' packages/agent-ui/a2ui/src/agent/surface-seeds.ts && ! grep -q '^function sessionSurfaceSeeds' packages/agent-ui/a2ui/src/agent/produce.ts && ! grep -q 'surface-seeds' packages/agent-ui/a2ui/src/agent/index.ts`
- `grep -q 'surface-seeds.ts' .claude/docs/lld/a2ui-validator-finalize.lld.md && grep -q 'surface-seeds.ts' .claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield.md`
- `grep -qF "'packages/agent-ui/a2ui/tools/testkit/*.test.ts'," vitest.config.ts`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/renderer/validate.test.ts packages/agent-ui/a2ui/src/live-agent/produce-loop.test.ts packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.test.ts packages/agent-ui/a2ui/src/agent/gates.test.ts packages/agent-ui/a2ui/src/layering.test.ts` exits 0
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json vitest.browser.config.ts`
- (guard) `! { git diff "$SDLC_BASE_SHA" -- . ":(exclude).sdlc" | grep '^+'; git ls-files --others --exclude-standard -z -- . ":(exclude).sdlc" | xargs -0 cat; } | grep -q "$(printf '\342\200\224')"`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE '^(packages/agent-ui/a2ui/(tools|src)/testkit/|packages/agent-ui/a2ui/src/renderer/validate\.ts$|packages/agent-ui/a2ui/src/agent/(produce|surface-seeds)\.ts$|vitest\.config\.ts$|\.claude/docs/lld/a2ui-validator-finalize\.lld\.md$|\.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield\.md$)'`

## Step 2: Scripted doubles on the real seams and the integration leg
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Path shorthand: K = `packages/agent-ui/a2ui/tools/testkit` and L = `packages/agent-ui/a2ui/src/testkit`.

- Decompose leaves: n_transport, n_provider, n_producer, n_mcp, n_tools, n_leg_integration.
- Interfaces follow `.sdlc/a2ui-test-kit/architect-L1.md` (`## Interfaces`). Its `## Carry forward` lists the seams: `AgentTransport`, `AgentProvider`, `ProduceDeps`, `fetchImpl` and `timeoutMs` on the MCP client, and `register` and `createClient` on discovery.
- Depends on: step 1.

**Library in K.**
- `scripted-transport.ts`: `createScriptedTransport(scenario, { produceTurn? }): AgentTransport & { log }`.
  - It matches each incoming `TurnInput` against the next turn's `match` and replays `lines`.
  - An `error` arm yields one meta error line via `formatErrorLine` from `src/agent/meta-line.ts`.
  - An unmatched input yields one meta error line plus `SCRIPT_UNMATCHED` in `log`. Exhaustion yields `SCRIPT_EXHAUSTED`.
  - A `rounds` turn calls the injected `produceTurn`, so this module never imports produce.ts or producer-leg.ts and stays browser-safe.
- `scripted-provider.ts`: `scriptedProvider(rounds: (string | { tool, input, then })[]): AgentProvider`.
  - Round n yields `rounds[min(n, len-1)]`, the `tools/agent-eval/scripted.ts` precedent.
  - A tool step calls the request's `executeTool(tool, input)` once and appends the result text.
  - A rejected tool call becomes text, never a throw.
- `producer-leg.ts`: `runProducerTurn(input, rounds, catalog, opts)` returns `{ outcome, rounds, failureCodes, lines }`.
  - It runs through the real `produce()` with `ProduceDeps`, following the precedent of `tools/agent-eval/observe.ts`.
  - Never-valid rounds yield `PRODUCE_HALT` carrying the validator codes.
  - It also exports the `produceTurn` factory the transport takes.
  - It is Node and jsdom only: produce.ts reads prompts relative to the repo-root cwd.
- `scripted-mcp.ts`: `scriptedMcpServer(script): { handle(req: Request): Promise<Response>, fetchImpl: typeof fetch, calls }`.
  - It is a Streamable-HTTP JSON-RPC server for `initialize`, `tools/list` (cursor-paged) and `tools/call`, in both JSON and SSE framing.
  - A `hang` step never answers until the request's signal aborts.
- `scripted-tools.ts`: `scriptedTools(script): { manifests: IntegrationManifest[], calls }`.

**Legs in L.** Each file arms the tripwire.
- `scripted-transport.test.ts`:
  - Replay is in order.
  - An unmatched input yields `SCRIPT_UNMATCHED`; exhaustion yields `SCRIPT_EXHAUSTED`.
  - A raw-source scan confirms scripted-transport.ts's import closure contains no produce.ts.
- `scripted-provider.test.ts`: covers the round indexing, a tool step, and a rejected tool call.
- `producer-leg.test.ts`:
  - Invalid-then-valid rounds give outcome eventual with rounds 2.
  - Never-valid rounds give `PRODUCE_HALT`.
  - Every yielded content line follows every meta-line.
- `scripted-mcp.test.ts`:
  - The real `createMcpClient` with the kit's `fetchImpl` completes initialize, listTools across two pages, and callTool in JSON and SSE framing.
  - A hang step with `timeoutMs` 1 rejects with `McpClientError` code `timeout`.
- `scripted-tools.test.ts`:
  - The real `buildToolDispatch` over the scripted manifests validates input and records one call per execute.
  - An invalid input never reaches the executor.
- `integration.test.ts`:
  - `discoverMcpIntegrations` with an injected `createClient` over the scripted server and an injected `register` sink registers the scripted tools.
  - A producer turn whose scripted round calls a tool records the call.
  - `listIntegrations()` returns the same array before and after.
- Two things this step leaves as they are:
  - The dev-proxy boot gate stays covered by `src/live-agent/mcp-boot.test.ts`, which this step does not change.
  - `TOOL_CALL_TIMEOUT_MS` is a non-injectable 30 s constant, so timeouts are proven through the MCP client's `timeoutMs` instead.
### Acceptance criteria
- `for f in scripted-transport scripted-provider producer-leg scripted-mcp scripted-tools; do test -f "packages/agent-ui/a2ui/tools/testkit/$f.ts" || exit 1; done && for f in scripted-transport scripted-provider producer-leg scripted-mcp scripted-tools integration; do test -f "packages/agent-ui/a2ui/src/testkit/$f.test.ts" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/scripted-transport.test.ts packages/agent-ui/a2ui/src/testkit/scripted-provider.test.ts packages/agent-ui/a2ui/src/testkit/producer-leg.test.ts packages/agent-ui/a2ui/src/testkit/scripted-mcp.test.ts packages/agent-ui/a2ui/src/testkit/scripted-tools.test.ts packages/agent-ui/a2ui/src/testkit/integration.test.ts` exits 0
- `grep -q SCRIPT_UNMATCHED packages/agent-ui/a2ui/src/testkit/scripted-transport.test.ts && grep -q SCRIPT_EXHAUSTED packages/agent-ui/a2ui/src/testkit/scripted-transport.test.ts && grep -q PRODUCE_HALT packages/agent-ui/a2ui/src/testkit/producer-leg.test.ts && grep -q timeout packages/agent-ui/a2ui/src/testkit/scripted-mcp.test.ts && grep -q buildToolDispatch packages/agent-ui/a2ui/src/testkit/scripted-tools.test.ts && grep -q discoverMcpIntegrations packages/agent-ui/a2ui/src/testkit/integration.test.ts && grep -q listIntegrations packages/agent-ui/a2ui/src/testkit/integration.test.ts`
- `test -f packages/agent-ui/a2ui/tools/testkit/scripted-transport.ts && ! grep -qE "from '[^']*(produce|producer-leg|system-prompt)\.ts'" packages/agent-ui/a2ui/tools/testkit/scripted-transport.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts` exits 0
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE '^(packages/agent-ui/a2ui/(tools|src)/testkit/|packages/agent-ui/a2ui/src/renderer/validate\.ts$|packages/agent-ui/a2ui/src/agent/(produce|surface-seeds)\.ts$|vitest\.config\.ts$|\.claude/docs/lld/a2ui-validator-finalize\.lld\.md$|\.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield\.md$)'`

## Step 3: Mount fixture, interaction loop and the catalog-generated jsdom matrix
level: L4
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Path shorthand: K = `packages/agent-ui/a2ui/tools/testkit` and L = `packages/agent-ui/a2ui/src/testkit`.

- Decompose leaves: n_mount, n_loop, n_catalogs, n_minimal, n_catalog_gates, n_leg_matrix.
- Interfaces follow `.sdlc/a2ui-test-kit/architect-L1.md` (`## Interfaces`, `## Constraints and assumptions`) except where settled here.
- Depends on: step 1, step 2.

**`mount.ts`.** `createKitMount(opts?: { newId?, now? })` returns `{ host: RendererHost, root: HTMLElement, ingest(lines), finalize(surfaceId?), settle(): Promise<void>, clientMessages(): A2uiClientMessage[], dispose() }`.
- Deterministic by default: `newId` is a counter yielding `kit-action-<n>`, and `now` is fixed at `2026-01-01T00:00:00.000Z`, both through `RendererOptions`.
- No loader option. `createRenderer()` already registers default, a2ui-basic, its alias, and every persona with `builtinControls` (the first describe block of `src/renderer/builtin-controls.test.ts`). This drops the architect's `loader: 'builtin' | 'url'` option. Step 5 proves the same default loader in a real engine.
- When `ElementInternals.prototype.setFormValue` or `setValidity` is not a function (jsdom lacks both), it installs a no-op and restores the original at dispose. Precedent: `beforeAll`/`afterAll` in `src/catalog/default/index.test.ts`.
  - Without this stub, every FACE control throws "setFormValue is not a function". Plan-time probe: 112 unhandled errors.
- `settle()` resolves once both hold:
  - Every surface created on this mount has its `[data-a2ui-surface="<id>"]` root attached.
  - Two consecutive macrotasks pass with no DOM mutation under the mount (MutationObserver).
  - Otherwise it rejects with `RENDER_ERROR` after 5 s.
- Nodes carry no A2UI id in the DOM, so every selector is scoped under `[data-a2ui-surface]` (`#attachRoot` in renderer.ts).
- mount.ts is the only `.ts` file under K or L that names `@agent-ui/components` or `catalog/controls.ts`. This is the fork 6 seam for GH #1814. Comments count, because the check is a raw grep, so mount.test.ts must assemble its scan pattern at run time.

**`interaction.ts`.** `runScenario(scenario, env): Promise<ScenarioResult>`, per the architect. For each turn it:
- Pulls the turn from the scripted transport.
- Runs `orderDefects`, then `judgeVerdict` with cross-turn seeds.
- Ingests into the mount, finalizes, and settles.
- Checks the expectations:
  - `tree`: selector assertions.
  - `bindings`: `BINDING_UNRESOLVED` for a `{path}` binding whose absolute pointer resolves to nothing in the kit's own fold of ingested `updateDataModel` lines. `binding.ts` raises no error for this, and `RendererHost` has no data-model accessor.
  - `clientMessages`.
  - `dataModel`, from the same fold.
- Performs the `act`:
  - click: `el.click()`.
  - setValue: set the slot prop, then dispatch the slot's commit event.
- Frames the emitted action with the real `nextTurn`. When `shouldRunTurn` is false (only an explicit `wantResponse: false`), it runs no turn.

More on interaction.ts:
- Codes: `TREE_MISMATCH`, `BINDING_UNRESOLVED`, `RENDER_ERROR`, `CLIENT_MESSAGE_MISMATCH`, `DATA_MODEL_MISMATCH`.
- `env.produceTurn` is optional and exists in jsdom only. interaction.ts imports neither produce.ts nor producer-leg.ts, so it stays browser-safe.

**`catalogs.ts`.** `allCatalogs(): Catalog[]` returns `defaultCatalog`, `a2uiBasicCatalog`, and every value of `composePersonaCatalogDocs(bases, SHIPPED_PERSONA_CATALOG_MANIFESTS)`.
- It excludes the a2ui-basic canonical-URI alias, which has the same components under a second id.
- Today that is 8 catalogs. Derive the count, never pin it.

**`minimal-node.ts`.** `minimalMessages(catalog, type)` returns `[createSurface, updateComponents]`.
- Required props come from `PropDef.required`, filled by schema type: enum takes its first member, string `'x'`, number or integer `1`, boolean `true`, array `[]`, object `{}`. Any other schema yields `MINIMAL_UNDERIVABLE`.
- A type whose def declares `children` gets one `Text` leaf from the same catalog: `child: 'leaf'` for the `child` kind, otherwise `children: ['leaf']`. A catalog with no `Text` yields `MINIMAL_UNDERIVABLE`.
- Members of `CARD_REGION_TYPES` are wrapped in a `Card` root.
- Evidence from a plan-time probe over all 8 catalogs:
  - 384 cells validate with `atFinalize` and mount in jsdom in about 4 s, with no placeholder, no error message and no unhandled error.
  - Without the Text leaf, Menu, Popover and Tooltip throw "provide a trigger as the first child" (`#ensureParts` in `menu.ts`, `popover.ts`, `tooltip.ts`).

**`catalog-gates.ts`.** Lift `loadDefect`, `missingEntries`, `bijectionDefects`, `renderDefects`, `reciprocityDefects` and `orphanDirs` verbatim out of `src/catalog/selection-guidance.test.ts`.
- That test then imports them in one statement from `'../../tools/testkit/catalog-gates.ts'`.
- `sidecarDirsOnDisk` stays in the test, along with every real-tree leg and every NEGATIVE CONTROL test, unchanged in count.
- It imports `src/agent/selection-guidance.ts`, which uses `node:fs`, so it is for Node and jsdom only and never a browser leg.

**Legs in L.** Each file arms the tripwire.
- `mount.test.ts`:
  - A Button surface settles to a defined `ui-button` with no `a2ui-placeholder`.
  - Dispose leaves `document.body` empty.
  - The seam scan.
- `catalogs.test.ts`:
  - The id set equals the bases plus `derivedCatalogId(base, persona)` for every manifest target.
  - Every `catalog.json` under `src/catalog` belongs to an enumerated catalog.
- `minimal-node.test.ts`:
  - Image gets `alt`.
  - CardHeader is wrapped in a Card root.
  - Menu gets a Text child.
  - A planted required prop with an unsupported schema raises `MINIMAL_UNDERIVABLE`.
- `matrix.test.ts`:
  - One generated cell per type of every catalog. The cell count equals the sum of type counts over `allCatalogs()`.
  - Each cell validates with `atFinalize`. It then mounts with its root present, no `a2ui-placeholder`, no error client message, and every custom-element-named node defined.
  - Negative control: register a catalog copy with a planted type through `host.register`, using a factory tag that no loader defines. It must red the same predicate.
- `interaction.test.ts`:
  - A click yields one action message, and `nextTurn` frames it.
  - The scripted reply's `updateDataModel` changes the bound text.
  - A binding to an unset path yields `BINDING_UNRESOLVED`.
  - An action with `wantResponse: false` runs no turn.
  - An out-of-order meta-line yields `ORDER_CONTENT_BEFORE_META`.
### Acceptance criteria
- `for f in mount interaction catalogs minimal-node catalog-gates; do test -f "packages/agent-ui/a2ui/tools/testkit/$f.ts" || exit 1; done && for f in mount interaction catalogs minimal-node matrix; do test -f "packages/agent-ui/a2ui/src/testkit/$f.test.ts" || exit 1; done`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/mount.test.ts packages/agent-ui/a2ui/src/testkit/catalogs.test.ts packages/agent-ui/a2ui/src/testkit/minimal-node.test.ts packages/agent-ui/a2ui/src/testkit/matrix.test.ts` exits 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/interaction.test.ts` exits 0
- `grep -q BINDING_UNRESOLVED packages/agent-ui/a2ui/src/testkit/interaction.test.ts && grep -q wantResponse packages/agent-ui/a2ui/src/testkit/interaction.test.ts && grep -q nextTurn packages/agent-ui/a2ui/src/testkit/interaction.test.ts && grep -q MINIMAL_UNDERIVABLE packages/agent-ui/a2ui/src/testkit/minimal-node.test.ts && grep -q SHIPPED_PERSONA_CATALOG_MANIFESTS packages/agent-ui/a2ui/src/testkit/catalogs.test.ts`
- `test "$(grep -cF "from '../../tools/testkit/catalog-gates.ts'" packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts)" -eq 1`
- (guard) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts` exits 0
- (guard) `test "$(grep -c 'NEGATIVE CONTROL' packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts)" -eq "$(git show "$SDLC_BASE_SHA":packages/agent-ui/a2ui/src/catalog/selection-guidance.test.ts | grep -c 'NEGATIVE CONTROL')"`
- `test -f packages/agent-ui/a2ui/tools/testkit/mount.ts && test -z "$(grep -rlE --include='*.ts' '@agent-ui/components|catalog/controls\.ts' packages/agent-ui/a2ui/tools/testkit packages/agent-ui/a2ui/src/testkit | grep -v '/tools/testkit/mount\.ts$')"`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts` exits 0
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE '^(packages/agent-ui/a2ui/(tools|src)/testkit/|packages/agent-ui/a2ui/src/renderer/validate\.ts$|packages/agent-ui/a2ui/src/agent/(produce|surface-seeds)\.ts$|packages/agent-ui/a2ui/src/catalog/selection-guidance\.test\.ts$|vitest\.config\.ts$|\.claude/docs/lld/a2ui-validator-finalize\.lld\.md$|\.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield\.md$)'`

## Step 4: Loaders, scenario set, seeded-defect layer, mutation fuzz and the kit CLI
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Path shorthand: K = `packages/agent-ui/a2ui/tools/testkit` and L = `packages/agent-ui/a2ui/src/testkit`.

- Decompose leaves: n_load_vite, n_load_node, n_seeded_run, n_mutate, n_cli, n_scenarios, n_seeded_data, n_leg_scenarios, n_leg_seeded, n_leg_fuzz.
- Depends on: step 1, step 2, step 3.

**Library in K.**
- `load.vite.ts`: `import.meta.glob` over `./scenarios/*.scenario.json` and `./__seeded__/*/*.json` (excluding `pins.json`), with `query: '?raw'` and `eager`. Returns parsed scenarios and seeded documents with their names and raw bytes, for jsdom and the browser.
- `load.node.ts`:
  - Filesystem loaders for the same files.
  - `verifyPins(dir)` per `__seeded__/<layer>/`, from `tools/agent-eval/pins.ts`. It checks only regular files directly in that directory.
  - A lazy catalog resolver by id. Base ids resolve via `loadCatalogById` in `tools/catalog-files.ts`. An id `<base>--<persona>` resolves via `composeCatalog(base, loadCatalogFragment(<parsed src/catalog/personas/<persona>/catalog.json>), persona)`, the `tools/agent-eval/cases.ts` precedent.
  - Plain Node cannot import the catalog modules (`ERR_IMPORT_ATTRIBUTE_MISSING`, per the architect), so this resolver is the Node path.
- `load.test.ts` (tools project, Node environment):
  - The vite and Node loaders return the same names and bytes.
  - For every id in `allCatalogs()`, the Node-resolved catalog deep-equals the module catalog.
- `seeded.ts`:
  - `SeededFixture { name, layer, expectRed: { layer, code }, run(): Promise<KitFinding[]> }`.
  - `runSeeded(fixtures, layers = LAYERS)` compares each fixture's first finding with `expectRed`. A green fixture yields `SEEDED_NOT_RED`, a red fixture with another code yields `SEEDED_WRONG_CODE`, and a LAYERS member with no fixture yields `SEEDED_LAYER_UNCOVERED`.
  - It is pure. Callers build the runners: the DOM-free ones from the loaders, and the renderer runner only in jsdom legs through interaction.ts.
- `mutate.ts`: `mutate(lines, seed)` with a seeded PRNG, no dependency, and a closed operator list. Each operator is tagged:
  - `form` operators are ones heal.ts repairs: `fence`, `trailing-comma`, `single-object-envelope`, `drop-version`.
  - `semantic` operators make the validator reject with a named code: `drop-root` (IDGRAPH), `unknown-type` (CATALOG), `wrong-version` (VERSION_UNSUPPORTED).
- `kit.ts`: a CLI behind the guard `if (process.argv[1]?.endsWith('kit.ts'))` (the `eval-agent-behavior.ts` precedent). It exports `runCli(argv, repoRoot, opts?)`.
  - Exit codes: 0 green, 1 red, 2 usage error or a missing or unparseable file.
  - Its static import closure has no DOM or JSON-module import (no mount.ts, interaction.ts or catalogs.ts), because `node --experimental-strip-types` runs it.
- The three `kit.ts` commands:
  - `selftest [--repo-root <dir>]`:
    - Arms the tripwire, verifies the pins of every `__seeded__/<layer>/`, and parses every scenario and fixture.
    - Checks layer coverage, then runs every DOM-free seeded fixture (every layer except renderer) against its pinned code.
    - Runs its own negative control: a known-green fixture must yield `SEEDED_NOT_RED`. With `opts.skipNegativeControl`, selftest returns 1.
  - `run <file>`:
    - Runs the DOM-free legs on a scenario or seeded fixture.
    - Prints `<file>: red layer=<layer> code=<code>` per finding, and `skip: needs DOM` for mounted expectations.
  - `list`:
    - Prints one line per scenario: `<file>  catalog=<catalogId>  tags=<comma list>`.
    - Tags are derived from content: `lines`, `rounds`, `error`, `act`, `no-response` (an act whose action carries `wantResponse: false`), `persona` (catalogId contains `--`), `a2ui-basic` (catalogId starts with `a2ui-basic`).
- `kit.test.ts` (tools project) drives `runCli` against a temporary copy of the testkit tree under `os.tmpdir()`:
  - selftest returns 0 on the complete tree.
  - It returns 1 after one byte is appended to a pinned fixture.
  - It returns 1 with `skipNegativeControl`.
  - `run` returns 1 on the seeded validator fixture and prints its layer and code.
  - `run` on a missing path returns 2. The exit-2 behavior is proven here only, not by a criterion.

**Data.**
- `K/scenarios/*.scenario.json` is the green set. It covers every tag:
  - A repair turn: rounds that are invalid, then valid.
  - The click loop: click, action, scripted reply with `updateDataModel`, re-render.
  - A `wantResponse: false` act.
  - A derived persona surface, for example an `agent-ui--croupier` PlayingCard.
  - An `a2ui-basic` surface.
- `K/__seeded__/<layer>/` holds one fixture per layer plus a `pins.json` (`{ "algorithm": "sha256", "files": { ... } }`). Update pins by hand with `shasum -a 256`, Kim's 2026-10-05 ruling.
  - `validator/root-recreate.json`: a second lines turn re-sends root without `createSurface` (IDGRAPH, probed).
  - `heal/unhealable-fence.json`: `HEAL_UNPARSEABLE`.
  - `renderer/unresolved-binding.json`: `BINDING_UNRESOLVED`.
  - `catalog/selection-missing-entry.json`: kind `agent-ui-a2ui-seeded-catalog`, a catalogId plus a selection doc missing one entry, judged by `bijectionDefects`. Code `SELECTION_BIJECTION`.
  - `producer/never-corrected.json`: rounds that are never valid. Code `PRODUCE_HALT`.
  - `integration/tool-timeout.json`: kind `agent-ui-a2ui-seeded-mcp`, a scripted MCP hang with a small client `timeoutMs`. Code `MCP_TIMEOUT`, which is `MCP_` plus the `McpClientError` code uppercased.
  - `interop/wrong-dialect-basic.json`: a committed JSON copy of a wrong-dialect a2ui-basic plant on catalogId `a2ui-basic`.
- Record every `expectRed.code` from a real run.
- Never import `planted.ts`; the `layering.test.ts` planted gate forbids non-test importers.

**Legs in L.** Each file arms the tripwire.
- `seeded-run.test.ts`: synthetic fixtures for each of the three `SEEDED_*` codes.
- `seeded.test.ts`: fixtures come from `load.vite.ts`. Every one of the seven layers, renderer included, reds with exactly its pinned code, with at least one test per LAYERS member.
- `scenarios.test.ts`: one test per scenario file. A zero-file glob fails the file.
- `mutate.test.ts`:
  - The same seed yields byte-identical mutants on two runs.
  - Every operator is tagged.
- `fuzz.test.ts`, over a fixed seed list applied to the green scenarios:
  - The validator and renderer never throw.
  - Form mutants heal back, and semantic mutants are rejected with their code.
  - A failing case prints the seed and operator.
### Acceptance criteria
- `for f in load.vite load.node seeded mutate kit; do test -f "packages/agent-ui/a2ui/tools/testkit/$f.ts" || exit 1; done && for f in load kit; do test -f "packages/agent-ui/a2ui/tools/testkit/$f.test.ts" || exit 1; done && for f in seeded-run seeded scenarios mutate fuzz; do test -f "packages/agent-ui/a2ui/src/testkit/$f.test.ts" || exit 1; done`
- `npx vitest run --project tools packages/agent-ui/a2ui/tools/testkit/load.test.ts packages/agent-ui/a2ui/tools/testkit/kit.test.ts` exits 0
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/seeded-run.test.ts packages/agent-ui/a2ui/src/testkit/seeded.test.ts packages/agent-ui/a2ui/src/testkit/scenarios.test.ts packages/agent-ui/a2ui/src/testkit/mutate.test.ts packages/agent-ui/a2ui/src/testkit/fuzz.test.ts` exits 0
- `node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest` exits 0
- `out=$(node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts list) && for t in lines rounds act no-response persona a2ui-basic; do printf "%s\n" "$out" | grep -qE "tags=([a-z0-9-]+,)*$t(,|$)" || exit 1; done`
- `for l in validator heal renderer catalog producer integration interop; do d="packages/agent-ui/a2ui/tools/testkit/__seeded__/$l"; test -f "$d/pins.json" || exit 1; test -n "$(find "$d" -maxdepth 1 -name '*.json' ! -name pins.json)" || exit 1; done`
- `out=$(node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts run packages/agent-ui/a2ui/tools/testkit/__seeded__/validator/root-recreate.json); test $? -eq 1 && printf "%s\n" "$out" | grep -q 'layer=validator code=IDGRAPH'`
- `grep -qF "process.argv[1]?.endsWith('kit.ts')" packages/agent-ui/a2ui/tools/testkit/kit.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts` exits 0
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE '^(packages/agent-ui/a2ui/(tools|src)/testkit/|packages/agent-ui/a2ui/src/renderer/validate\.ts$|packages/agent-ui/a2ui/src/agent/(produce|surface-seeds)\.ts$|packages/agent-ui/a2ui/src/catalog/selection-guidance\.test\.ts$|vitest\.config\.ts$|\.claude/docs/lld/a2ui-validator-finalize\.lld\.md$|\.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield\.md$)'`

## Step 5: Browser legs in the packages-rest shard
level: L3
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Path shorthand: K = `packages/agent-ui/a2ui/tools/testkit` and L = `packages/agent-ui/a2ui/src/testkit`.

- Decompose leaves: n_leg_browser, n_leg_matrix_browser.
- Depends on: step 3, step 4.
- Browser files must sit under `src/` because `packages-rest` globs `packages/agent-ui/*/src/**/*.browser.test.ts` (see the architect file). That project runs the chromium and webkit instances.

**The two files.**
- `L/interaction.browser.test.ts`:
  - Takes every scenario from `load.vite.ts` whose turns all use the `lines` or `error` arm and that has at least one `act`. That is the click, action, scripted response, `updateDataModel`, re-render loop.
  - Runs each through `interaction.ts` and `mount.ts` in a real engine, including the loop's order and verdict checks before ingest.
- `L/matrix.browser.test.ts`:
  - Its first assertion proves a fleet tag (`ui-button`) is undefined before the first mount.
  - It then mounts the cells of the two base catalogs (`agent-ui`, `a2ui-basic`) from `minimal-node.ts` through `mount.ts`.
  - Persona cells are not repeated: they reuse the base controls (see the architect file).

**Rules for both files.**
- Import only browser-safe kit modules: scenario, findings, judge, offline, scripted-transport, mount, interaction, catalogs, minimal-node, load.vite.
- Never import load.node.ts, kit.ts, producer-leg.ts, catalog-gates.ts or the agent-eval pins. Each of those has a `node:` or prompt-file closure.
- Both files arm the tripwire. In a real page, offline.ts throws only for off-origin URLs.
- Acts are programmatic (`click()`, value set plus the commit event) and never rely on focus.
- `vitest.browser.config.ts` and `package.json` stay unchanged: no new project, no heap bump, no worker change.
- If a scenario turns out to need real focus, report blocked instead of appending to `FOCUS_TIMING_FILES`. The guard below forbids that config change in this step.
### Acceptance criteria
- `for f in interaction matrix; do test -f "packages/agent-ui/a2ui/src/testkit/$f.browser.test.ts" || exit 1; done`
- `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/testkit/interaction.browser.test.ts` exits 0
- `npx vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/testkit/matrix.browser.test.ts` exits 0
- `grep -q 'toBeUndefined' packages/agent-ui/a2ui/src/testkit/matrix.browser.test.ts && grep -q 'armOffline' packages/agent-ui/a2ui/src/testkit/matrix.browser.test.ts && grep -q 'armOffline' packages/agent-ui/a2ui/src/testkit/interaction.browser.test.ts`
- `npx vitest run --project packages packages/agent-ui/a2ui/src/testkit/offline-wiring.test.ts` exits 0
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- vitest.browser.config.ts package.json`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ":(exclude).sdlc"; git ls-files --others --exclude-standard -- . ":(exclude).sdlc"; } | grep -vE '^(packages/agent-ui/a2ui/(tools|src)/testkit/|packages/agent-ui/a2ui/src/renderer/validate\.ts$|packages/agent-ui/a2ui/src/agent/(produce|surface-seeds)\.ts$|packages/agent-ui/a2ui/src/catalog/selection-guidance\.test\.ts$|vitest\.config\.ts$|\.claude/docs/lld/a2ui-validator-finalize\.lld\.md$|\.claude/skills/a2ui-jsonl-mcp/references/producer-order-and-yield\.md$)'`

## Step 6: Kit commands, README, scrub list, gates green
level: L3
guard timeout: 600
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
- Decompose leaves: n_package, n_readme, n_scrub.
- Depends on: steps 1 to 5.

**`package.json` scripts.** Change scripts only:
- `"test:a2ui-kit": "vitest run --project packages packages/agent-ui/a2ui/src/testkit && vitest run --project tools packages/agent-ui/a2ui/tools/testkit && node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest"`
- `"test:a2ui-kit:browser": "vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/testkit"`
- Append ` && node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest` to `check:scripts`.
- Change no dependency key and no other script. The kit legs already run in `npm test` (the `packages` and `tools` projects) and in `test:browser:packages:rest`.

**`packages/agent-ui/a2ui/tools/testkit/README.md`.** The one canonical description of the kit:
- The format (`agent-ui-a2ui-scenario` v1).
- The three tiers and their legs.
- Every finding code.
- The `__seeded__/<layer>/` layout and the pin-update procedure.
- The commands.
- A link to `.claude/docs/rubrics/fixtures/a2ui-deceptive-composition` as the earlier seeded-defect precedent.
- No em dashes.

**Scrub list.** Each of the 34 files gains a pointer naming `packages/agent-ui/a2ui/tools/testkit` (its README), never a restatement:
- `CLAUDE.md`: add `npm run test:a2ui-kit` and `npm run test:a2ui-kit:browser` under `## Commands`.
- `AGENTS.md`: add a line under `## Gates`. Both root edits sit outside the sdlc-lite managed blocks.
- `packages/agent-ui/a2ui/AGENTS.md`: a short test-kit section with the layout and commands. Leave `packages/agent-ui/a2ui/CLAUDE.md` alone: it is a managed `@AGENTS.md` include.
- The `SKILL.md` of each of these skills: `a2ui-build`, `a2ui-payload-authoring`, `a2ui-multi-catalog`, `a2ui-jsonl-mcp`, `a2ui-prompt-authoring`, `a2ui-corpus-curation`, `a2ui-catalog-rendering-review`, `component-testing`, `integration-standards`. Also `.claude/skills/component-testing/references/test-craft.md` (shard placement and the page-eval versus per-type-matrix distinction).
- `.claude/agents/a2ui-review-agent.md` and `.claude/agents/a2ui-payload-authoring-agent.md`: body text only. The `tools:` frontmatter stays, so the payload agent's Bash allowlist remains `validate-payload`.
- Rubrics: `.claude/docs/rubrics/a2ui-payload.md`, `a2ui-corpus.md`, `a2ui-catalog.md`.
- Specs: `.claude/docs/spec/a2ui-ecosystem-alignment.spec.md`, `a2ui-live-agent.spec.md`, `a2ui-streaming-pipeline.spec.md`, `a2ui-message-lifecycle.spec.md`, `a2ui-expert-harness.spec.md`, `a2ui-chat.spec.md`.
- LLDs: `.claude/docs/lld/a2ui-live-agent.lld.md`, `a2ui-harness-wiring.lld.md`, `a2ui-renderer.lld.md`, `a2ui-validator-finalize.lld.md`, `a2ui-streaming-pipeline.lld.md`, `a2ui-message-lifecycle.lld.md`, `a2a-a2ui-bridge.lld.md`, `genui-b3-judged-eval.lld.md`.
- References: `.claude/docs/references/wire-tolerances.md` (point at the generated interop cells and the `interop` seeded layer) and `.claude/docs/references/agent-model.md` (kit vocabulary).

**Left untouched on purpose.**
- ADRs. They are append-only and Kim-ratified, and the handoff allows only follow-up bullets, which go in the filer's notes.
- `src/catalog/a2ui-basic/planted.ts`. No helpers were lifted from it, so its comment stays true.

**Gates.**
- Run `npm run check`, `npm test`, `npm run test:browser:packages:rest` and both kit scripts, and fix any red the earlier steps introduced.
- `doc_lint.py` skips this repo's blockquote-dialect documents: with no `doc-type:` frontmatter it prints "not a functional document" and exits 0. It is a structural floor only. The `tools/testkit` grep over the 34 files is the content check.
### Acceptance criteria
- `node -e 'const s=require("./package.json").scripts;const k=" && node --experimental-strip-types packages/agent-ui/a2ui/tools/testkit/kit.ts selftest";process.exit(s["test:a2ui-kit"]==="vitest run --project packages packages/agent-ui/a2ui/src/testkit && vitest run --project tools packages/agent-ui/a2ui/tools/testkit"+k&&s["test:a2ui-kit:browser"]==="vitest run --config vitest.browser.config.ts --project packages-rest packages/agent-ui/a2ui/src/testkit"&&s["check:scripts"].endsWith(k)?0:1)'`
- (guard) `node -e 'const a=JSON.parse(require("child_process").execSync("git show "+process.env.SDLC_BASE_SHA+":package.json"));const b=require("./package.json");delete a.scripts;delete b.scripts;process.exit(JSON.stringify(a)===JSON.stringify(b)?0:1)'`
- `env -u ANTHROPIC_API_KEY npm run test:a2ui-kit` exits 0
- `npm run test:a2ui-kit:browser` exits 0
- `f=packages/agent-ui/a2ui/tools/testkit/README.md; grep -q 'agent-ui-a2ui-scenario' "$f" && grep -q 'a2ui-deceptive-composition' "$f" && ! grep -q "$(printf '\342\200\224')" "$f"`
- `for f in CLAUDE.md AGENTS.md packages/agent-ui/a2ui/AGENTS.md .claude/skills/a2ui-build/SKILL.md .claude/skills/a2ui-payload-authoring/SKILL.md .claude/skills/a2ui-multi-catalog/SKILL.md .claude/skills/a2ui-jsonl-mcp/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/skills/a2ui-corpus-curation/SKILL.md .claude/skills/a2ui-catalog-rendering-review/SKILL.md .claude/skills/component-testing/SKILL.md .claude/skills/component-testing/references/test-craft.md .claude/skills/integration-standards/SKILL.md .claude/agents/a2ui-review-agent.md .claude/agents/a2ui-payload-authoring-agent.md .claude/docs/rubrics/a2ui-payload.md .claude/docs/rubrics/a2ui-corpus.md .claude/docs/rubrics/a2ui-catalog.md .claude/docs/spec/a2ui-ecosystem-alignment.spec.md .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/spec/a2ui-streaming-pipeline.spec.md .claude/docs/spec/a2ui-message-lifecycle.spec.md .claude/docs/spec/a2ui-expert-harness.spec.md .claude/docs/spec/a2ui-chat.spec.md .claude/docs/lld/a2ui-live-agent.lld.md .claude/docs/lld/a2ui-harness-wiring.lld.md .claude/docs/lld/a2ui-renderer.lld.md .claude/docs/lld/a2ui-validator-finalize.lld.md .claude/docs/lld/a2ui-streaming-pipeline.lld.md .claude/docs/lld/a2ui-message-lifecycle.lld.md .claude/docs/lld/a2a-a2ui-bridge.lld.md .claude/docs/lld/genui-b3-judged-eval.lld.md .claude/docs/references/wire-tolerances.md .claude/docs/references/agent-model.md; do grep -q 'tools/testkit' "$f" || exit 1; done`
- (guard) `! { git diff "$SDLC_BASE_SHA" -- . ":(exclude).sdlc" | grep '^+'; git ls-files --others --exclude-standard -z -- . ":(exclude).sdlc" | xargs -0 cat; } | grep -q "$(printf '\342\200\224')"`
- (guard) `DL=$(ls -d "$HOME"/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py | sort -V | tail -1) && for f in $(git diff --name-only "$SDLC_BASE_SHA" -- .claude/docs); do python3 "$DL" "$f" > /dev/null || exit 1; done`
- (guard) `git diff --quiet "$SDLC_BASE_SHA" -- packages/agent-ui/a2ui/src/live-agent/prompt-equivalence.baseline.json vitest.browser.config.ts`
- (guard) `npm run check` exits 0
- (guard) `npm test` exits 0
- (guard) `npm run test:browser:packages:rest` exits 0

## Assumptions
- The build base is a lane cut at or after origin/main `4d90e826` (#1824 merged). The main checkout is 11 commits behind: verified by `git status -sb` and `git log origin/main`. Every probe ran in a detached worktree at `4d90e826`.
- The generated matrix holds 384 cells over 8 catalogs. With required props filled, a Text leaf per container, the Card wrap and the ElementInternals stub, every cell validates with `atFinalize` and mounts in jsdom (about 4 s, exit 0). Verified by a plan-time probe test in a temporary worktree. The first runs without the stub and without the leaf showed 112 unhandled setFormValue errors and 12 trigger-child errors (`menu.ts`, `popover.ts`, `tooltip.ts` `#ensureParts`).
- produce.ts cannot load in a browser page: verified by `src/agent/system-prompt.ts` (`PROMPTS_DIR` built from `process.cwd()`, `readFileSync` at import) and produce.ts importing it.
- Moving `sessionSurfaceSeeds` into `session.ts` would publish it: verified by `src/agent/index.ts` line 20, `export * from './session.ts'`.
- `validate.ts` is only named-re-exported (`src/renderer/index.ts` lines 29 and 30), so exporting `CARD_REGION_TYPES` does not grow the barrel.
- A root resend without `createSurface` under session seeds yields `IDGRAPH` at `s:root`: verified by running `validateA2ui` from a Node script.
- Plain Node runs `produce()`, `selection-guidance.ts` and `verifyPins`: verified by `eval-agent-behavior.ts selftest` exiting 0 (it is already in `check:scripts`).
- `verifyPins` checks only regular files directly in one directory (`tools/agent-eval/pins.ts`), so each `__seeded__/<layer>/` gets its own `pins.json`.
- The `tools` vitest project needs an explicit include line (the GH #112 no-wildcard comment in `vitest.config.ts`). jsdom legs under `src/testkit/` match the `packages` glob, and browser legs match the `packages-rest` glob: verified by reading both configs.
- Test files are exempt from the a2ui import-layering and composition-containment gates (`src/layering.test.ts` filters out `.test.ts`, and `src/agent/gates.test.ts` scans only non-test modules), so legs under `src/testkit/` may import `tools/testkit`.
- doc_lint exits 0 with "not a functional document" on this repo's blockquote-dialect docs and goes red on a fixture carrying `doc-type:` frontmatter: verified by running it on four scrub files and on a temp fixture.
- Gate timings at base, with 4 workers: `npm run check` 29 s, `npm test` 117 s, `test:browser:packages:rest` 5 s, a2ui jsdom suite 22 s. Every guard was green at base, and each guard's command shape was seen red in the temporary worktree.
- "Adding a type reds the gate until covered" means: a new catalog type gets a generated cell and reds when it cannot be derived, validated or mounted, and the cell count is derived. Verified against fork 3 ("never a hand-listed table") and the handoff acceptance line. A hand-kept per-type file would contradict the fork.
- Seeded fixtures live under `tools/testkit/__seeded__/<layer>/` behind the T-0005 pin-file rule, with no visual baselines: verified by the handoff `## Rulings` (Kim, 2026-10-05).
- T-0010 alignment reuses its `inputKind` and `textIncludes` match vocabulary and migrates no T-0005 or T-0010 fixture: verified by `.sdlc/a2ui-test-kit/architect-L1.md` (`## Carry forward`).

## Risks
- If the conductor commits between steps, `SDLC_BASE_SHA` moves and the cumulative scope allowlists are wider than needed. They still hold either way.
- WebKit may flake on the browser legs. The two files are light, but a WebKit-only red would need `flaky-gates` triage, not a config change.
- Selector-based acts couple the interaction scenarios to factory tags, so a catalog `mapsTo` change reds scenarios as well as the matrix.
- The binding check covers absolute pointers and list-template paths. A new binding form would pass unseen until the check is extended.
- GH #1812 (persona manifest) or GH #1811 (catalog split) can move the paths the Node catalog resolver reads. The `load.test.ts` parity leg reds, which is the intended signal.
- T-0004's captured Croupier payload does not exist yet, so its regression scenario is not part of this plan.
- If other lanes push `npm test` past the 600 s guard timeout under load, the final step's guard fails on time rather than on behavior.
- The em-dash guard counts every added line, so any verbatim move of commented code must be de-dashed by the builder.
