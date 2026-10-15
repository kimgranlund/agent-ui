<!-- role=architect level=L1 model=fable effort=high -->
## Approach

The seam is the browser's network edge, not the component. `ui-agent-admin` only ever learns about a model through `probeLive()` (GET `/__a2ui/agent/status`) and the two fetches inside `admin-live-runner.ts` (POST `/__a2ui/agent/chat`, POST `/__a2ui/agent`). Intercepting those three URLs with Playwright `context.route` on a real `vite dev` exercises the shipped page, the shipped runner (NDJSON reader, meta-line peel, session bookkeeping, fail path) and the shipped component with zero production change and zero key: `/status` is answered `{available:true}` so the page arms `createAdminSurfaceTurn()`; produce POSTs are answered from a fixture's raw wire lines (meta-lines included, so note/ask/patch/plan/team/flowEnd all travel the real peel); every request that leaves the vite origin is aborted, which is the networkless guarantee regardless of what `.env` holds locally.

The runner is a Node script in the `e2e-devtools.mjs` shape (ruling on fork 3 recommended: Node + bundled `playwright`, outside the six shards, selftest in `check:scripts`), because the two alternatives fail on mechanics: vitest browser mode runs inside the page and cannot route, reload or seed storage across a navigation; `@playwright/test` is a second runner and a new dependency. A serial prep slice extracts `freePort`/`waitForHttp`/`killTree` into `scripts/lib/dev-server.mjs`, since `e2e-devtools.mjs` runs its argv branch on import (the reason `eval-catalog-gate.mjs` already carries a copy) and a third copy is a defect by the repo's own standard. Typed modules live in `scripts/e2e-admin/*.ts`, imported by the `.mjs` entry through Node's native type stripping (the precedent is the entry's import of `devtools/src/playwright/index.ts`); they are type-checked by adding `scripts/e2e-admin` to `tsconfig.tools.json`, which already carries Node types. They import nothing at runtime from the packages (type-only), so stripping never loads a DOM module.

Fixtures are data, flows are code. An `AdminScenario` JSON carries a storage seed, the status answer and an ordered turn queue of raw NDJSON lines (or an error, delay, or abort); it is deliberately not a `DevtoolsCapture` (that format's `backend` is pinned to `a2a|proxy|replay`, its replay law is `line`-only, and the admin app never calls `recordTurn`). Flows are small TypeScript functions over a page object (`openAdmin` seeds via `addInitScript`, waits for `admin.agentSurfaceTurn` to be set; composer drivers; `waitForTurn` polls the public `liveTurnCount()`; readers for `testChatTranscript()`, `builderInterviewTranscript()`, localStorage keys, the Dialog Turns rows). The Node-side route layer keeps a wire log (every intercepted body, which turn answered it, outcome), which is the timeline flows assert on for facts the DOM cannot show (`builderMission`, `session`, `catalogId`, history length). Each flow runs in a fresh browser context against one vite per run; a negative-control group runs the two wrong-behavior fixtures against their named flows and reds the run if they do not fail. Record mode is the same runner with pass-through routes (`route.fetch()` tee) against a key-bearing `vite dev`; the key stays server-side by construction and the scrub refuses to write a key-shaped value.

## Interfaces

- `scripts/lib/dev-server.mjs` (new): `freePort()`, `waitForHttp(url, opts)`, `killTree(child)`, own `selftest`; `scripts/e2e-devtools.mjs` and `scripts/eval-catalog-gate.mjs` re-import instead of defining.
- `scripts/e2e-admin.mjs` (new): modes `run` (default, `--only <glob>`), `list`, `record --flow <name> --out <path>`, `selftest`; exit 0 pass, 1 red, 2 usage/setup.
- `scripts/e2e-admin/scenario.ts` (new): `AdminScenario { kind:'agent-ui-admin-scenario', version:1, name, seed?: { localStorage: Record<string,string> }, status?: { available, providers }, turns: ScriptedTurn[] }`; `ScriptedTurn { endpoint:'produce'|'chat', match?: { session?, kind?, textIncludes? }, respond: { lines: string[] } | { text } | { status, error } | { abort: true }, delayMs? }`; `parseScenario(text)` (field-naming errors), `scrubScenario(s, env)`.
- `scripts/e2e-admin/intercept.ts` (new): `installIntercept(context, scenario, origin): WireLog`; `WireEntry { seq, at, endpoint, request, outcome: 'fulfilled'|'aborted'|'unmatched'|'exhausted', turnIndex? }`.
- `scripts/e2e-admin/admin-page.ts` (new): `ADMIN_SELECTORS` (the component's `data-part` hooks: `admin-header`, `agent-select`, `new-agent-narrow`/`new-agent-wide`, `overflow-menu`, `pane-pills`/`pane-segments`, `chat-pane`, `copilot-pane`, `settings-pane`, `settings-nav`, `kind-enabled`, `reset-agent-button`, `context-turn`, composer `[data-part="editor"]`/`[data-part="send"]`), `openAdmin(page, base, scenario)`, `sendTestChat`, `sendBuilderChat`, `waitForTurn(since)`, `clickSurfaceButton`, `answerAsk`, `switchPersona`, `newAgent`, `openSettingsTab`, `toggleKind`, `addEntry`/`removeEntry`, `resetAgent`, `readTestTranscript`, `readBuilderTranscript`, `readStorage(key)`, `readDialogTurns`.
- `scripts/e2e-admin/runner.ts` (new): `AdminFlow { name, fixture, viewport?, run(ctx: FlowContext) }`, `FlowContext { page, admin, wire, scenario }`, `runFlows(flows, opts)`, the negative pairs `[{ flow, fixture }]`.
- `scripts/e2e-admin/flows/{test-chat,builder,settings,personas-teams,failure-paths}.ts`, `scripts/e2e-admin/fixtures/*.json`, `fixtures/negative/{patch-wrong-key,missing-flowend}.json`, `scripts/e2e-admin/record.ts`.
- `package.json`: `e2e:admin`, `e2e:admin:record`, `check:scripts` gains `node scripts/lib/dev-server.mjs selftest && node scripts/e2e-admin.mjs selftest`; `tsconfig.tools.json` include gains `scripts/e2e-admin`.
- `.github/workflows/e2e-admin.yml` (Kim-gated): separate job, `npx playwright install --with-deps chromium`, `npm run e2e:admin`.
- No change to `@agent-ui/devtools`, `admin-live-runner.ts`, `agent-admin.ts`, or `agent-admin-app.ts`.

## Constraints and assumptions

- The page arms the surface runner solely on `probeLive().available === true` and never needs a key client-side: verified by `site/pages/agent-admin-app.ts:1659-1674` and `site/lib/live-proxy-transport.ts:40-49`.
- All model traffic goes through exactly three URLs under `/__a2ui/agent` (`/status`, `/chat`, `/`) plus the DEV-only GET `/integrations`: verified by `admin-live-runner.ts:42,52,85,110,160,203` and `live-proxy-transport.ts:31,42`.
- `agentSurfaceTurn` takes precedence over `agentTurn`, so flows script `/` (produce) and `/chat` is only a degrade path: verified by `agent-admin.ts:311-319` and the page assigning both at `:1664-1671`.
- The runner's peel yields `progress|note|ask|patch|plan|flowEnd|team|target` from raw meta-lines and the page wrapper consumes `flowEnd` on the `test` session only: verified by `admin-live-runner.ts:258-311` and `agent-admin-app.ts:392-411`.
- A fulfilled whole-body NDJSON response is read line by line by the real reader: verified by `readNdjsonLines` over `res.body` at `admin-live-runner.ts:257` (`@agent-ui/data/stream`).
- The 120 s client timeout is a module constant, so a real timeout cannot be exercised in CI time; the abort path is `route.abort()` plus a terminal `a2uiMeta.error` line: verified by `admin-live-runner.ts:45,250,266-268,335-337`.
- `liveTurnCount()`, `testChatTranscript()`, `builderInterviewTranscript()` are public and `liveTurnCount` increments on every arm including failures: verified by `agent-admin.ts:4590-4615` and `#logTurn` call sites `:3401,3428,3437,3793,3809`.
- Storage seeding must precede the page module (it resolves the active persona at import): verified by `agent-admin-app.browser.test.ts:33-37` and `agent-roster-source.ts:32-45`; Playwright `addInitScript` runs before any page script | unverified against this exact page (the planner's first flow proves it).
- Persisted keys: personas `agent-admin-app.<id>`, roster `agent-admin-app.importedPersonas`/`.rosterOrder`/`.activePreset`, teams namespace `agent-ui-agent-teams`, Builder store unpersisted: verified by `agent-roster-source.ts:32-45`, `agent-admin-presets.ts:654-655,911`, `agent-team.ts:116`.
- Builder entry is `onNewAgentRequest` → `createGeneratedAgent` → `admin.authoringStore = builderStore()`; the only clear is `applyPersona` (persona switch): verified by `agent-admin-app.ts:480,510,585,733`.
- `vite dev` boots without a key and without network: the committed `mcp-servers.json` is `{"servers":{}}` and `/status` only round-trips when a key is present (`dev-proxy-plugin.ts:240,265-279`); the browser never reaches it under the route anyway. `eval-catalog-gate.mjs` already boots vite in a gate: verified.
- `e2e-devtools.mjs` cannot be imported for its helpers (argv branch runs on import): verified by `eval-catalog-gate.mjs:15-22` header and `e2e-devtools.mjs:273-288`.
- Node's native type stripping runs `.ts` modules from an `.mjs` entry under this repo's `erasableSyntaxOnly`: verified by `e2e-devtools.mjs:120` importing `devtools/src/playwright/index.ts`; `tsconfig.tools.json` carries Node types and can take a second include path: verified by its contents.
- `ci.yml` runs no browser (its header pins browser gates local-only), so CI coverage needs a separate workflow with a Chromium install (precedent `consumer-smoke.yml:50`): verified | whether Kim wants that job: unverified, NEEDS KIM.
- The concurrency ceiling now reads 5 lanes × `--maxWorkers=4`, 2 browser lanes at once (PR #1818 merged 2026-10-05): verified by `gh pr view 1818`; an `e2e:admin` run counts as one browser lane.
- `compactMeta` only drops `undefined` members, so a future devtools meta replay is lossless: verified by `events.ts:83-89`; it is out of this ticket's scope.

## Rejected alternatives

- Vitest browser project for the flows: test code runs inside the page; no `route`, no cross-navigation storage seeding, and it would be a seventh shard, which the ticket forbids.
- `@playwright/test` as the runner: a second runner and a new devDependency with its own config, reporters and fixture model; needs a Kim ruling and buys nothing the Node script lacks at ~20 flows.
- A replay or mock mode inside `dev-proxy-plugin.ts` or the Worker: production-adjacent code gains a test branch behind the ADR-0073 boundary; the route layer gets the same coverage with zero production change.
- Injecting a scripted `agentSurfaceTurn` from the test (the `mountWithScript` precedent) on the booted page: bypasses `probeLive`, the fetch, the NDJSON reader and the meta-line peel, which are exactly the shipped code the ticket wants under test.
- `DevtoolsCapture` as the fixture format: `backend` is pinned to three ids, replay is `line`-only by SPEC-R3/R10 law, and the admin app never writes captures; the fixture needs raw meta-lines first-class.
- A JSON step/expect DSL inside the fixture: a second interpreter to maintain and to debug; code flows over a page object give agents the same reach with the type checker behind them.
- Meta replay in `capturedLineTimelines` (handoff slice 2): not load-bearing for these flows and it amends a ratified spec law; a follow-up ticket with a spec amendment.
- A third copy of `freePort`/`killTree`: the repo already names the copy a workaround; extraction is a small serial prep slice.
- Flow modules under `site/` or `packages/agent-ui/app/tools/`: `site/tsconfig.json` has no Node types and its `**/*.ts` include would swallow them; `app/tools` would couple package tooling to site persona ids and page URLs.

## Risks

- The settings-pane affordances (entry add/remove, persona picker, kind toggles) are reached through nested fleet controls (`ui-tabs`, `ui-select`, `ui-switch`) whose click paths differ at the 414 px band versus desktop; flows must pin a desktop viewport and the page object must drive the `[data-part]` hooks only, or they drift with CSS band swaps.
- Playwright `route.fulfill` delivers the body whole; a flow cannot observe a mid-stream state (composer busy during a long stream) except through `delayMs` before fulfilment.
- `addInitScript` seeding races nothing today, but a future async storage tier (`agent-roster-source.ts` header names it) would break seed-before-import.
- If a flow asserts on `#turnLog` only through the Dialog Turns DOM, the `TURN_LOG_CAP` ring drops old rows; long flows should assert on the wire log instead.
- The CI job is a Kim ruling; without it the ticket's "CI" claim holds only for agents running locally, and the acceptance wording must say so.
- Record mode writes `personaSystem` prompt text into fixtures; that is committed prose, so a persona with private content must not be recorded.

## Carry forward

- Three intercept URLs: GET `/__a2ui/agent/status` (`site/lib/live-proxy-transport.ts:42`), POST `/__a2ui/agent/chat` (`site/lib/admin-live-runner.ts:42,52`), POST `/__a2ui/agent` (`:85,203`); DEV-only GET `/__a2ui/agent/integrations` (`:110,160`).
- Runner arming: `site/pages/agent-admin-app.ts:1659-1674` sets `admin.agentTurn` and `admin.agentSurfaceTurn = withFlowChrome(...)` when `probe.available`; wait on `agentSurfaceTurn !== undefined`.
- Meta-line peel arms and order: `site/lib/admin-live-runner.ts:258-311` (`error` throws, then progress, note, ask, patch, plan, flowEnd, team, target); genui lines `:318-322`; `builderMission: sessionKey === 'authoring'` at `:248`.
- Public readers: `testChatTranscript()` `agent-admin.ts:4590`, `builderInterviewTranscript()` `:4603`, `liveTurnCount()` `:4613`; `#logTurn` fires at `:3401,3428,3437,3793,3809`.
- Builder entry `agent-admin-app.ts:480` (`onNewAgentRequest`) and `:733` (`authoringStore = builderStore(...)`); the only clear is `applyPersona` `:585`.
- Storage keys: `agent-admin-app.<id>` (`agent-admin-presets.ts:654-655`), `agent-admin-app.importedPersonas|rosterOrder|activePreset` (`agent-roster-source.ts:32-45`), `agent-ui-agent-teams` (`agent-team.ts:116`), Builder store has no `persistKey` (`agent-admin-presets.ts:911`).
- Component `data-part` hooks: `grep -o "setAttribute('data-part', '[a-z-]*')" packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts | sort -u` (50 names; composer parts are `editor`/`send` inside `ui-conversation-composer`, see `agent-admin-click-turn.browser.test.ts:128-131`).
- Boot machinery to extract: `scripts/e2e-devtools.mjs:45-110` (`freePort`, `waitForHttp`, `killTree`); the copy and its reason: `scripts/eval-catalog-gate.mjs:15-22,52-60`.
- `check:scripts` chain and `e2e:devtools` wiring: `package.json:15-16`; CI runs only `check` + `test` with no browser: `.github/workflows/ci.yml:7-12,38-41`; Chromium-in-CI precedent `.github/workflows/consumer-smoke.yml:50`.
- `tsconfig.tools.json` include is `packages/agent-ui/*/tools` with `types: ["vite/client","node"]`; `site/tsconfig.json` includes `**/*.ts` with no Node types.
- `DevtoolsCapture.backend` is pinned to `BACKEND_IDS` (`devtools/src/capture/format.ts:94-100`); replay is `line`-only (`transports/replay.ts:50-60`); `compactMeta` is lossless (`timeline/events.ts:83-89`).
- Client timeout constant `TIMEOUT_MS = 120_000` at `site/lib/admin-live-runner.ts:45`, not injectable.
- Concurrency ceiling after PR #1818 (merged 2026-10-05): 5 lanes × `--maxWorkers=4`, at most 2 browser lanes; one `e2e:admin` run is one browser lane.
- Decomposition: `.sdlc/admin-headless-flows/decompose/manifest-v1.json` (16 leaves, 30 actions, clean, plan mode) and `decompose/report.md`; the handoff's Context line `Decomposition: decompose/report.md` still needs adding (this role writes nothing outside `decompose/`).
- Kim rulings outstanding: fork 3 (recommended Node script, bundled `playwright`), and whether a separate `e2e-admin.yml` CI job with a Chromium install is wanted.
