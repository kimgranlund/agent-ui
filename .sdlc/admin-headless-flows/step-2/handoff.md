## Task goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

## Step 2: Runner core, intercept, page object, record mode and four seed flows
level: L4
### Do
Depends on: step 1.

Design source: `.sdlc/admin-headless-flows/architect-L1.md` (Approach and Interfaces). Its `## Carry forward` already answers these, so do not re-derive them:
- the three intercept URLs plus the DEV-only `/integrations` GET
- the arming wait (`agentSurfaceTurn` set)
- the meta-line peel order
- the public readers `testChatTranscript()`, `builderInterviewTranscript()` and `liveTurnCount()`
- the storage keys
- the `data-part` grep

Files:
- New: `scripts/e2e-admin.mjs`.
- New under `scripts/e2e-admin/`: `scenario.ts`, `intercept.ts`, `admin-page.ts`, `runner.ts`, `record.ts`, `selftest.ts`, `flows/index.ts`, `flows/infra.ts`, `flows/test-chat.ts`, `flows/builder.ts`, `fixtures/<flow>.json` (one per flow) and `tsconfig.json`.
- Edited: `package.json`.

Do not create `*.test.*` files here, because vitest collects `scripts/**/*.test.mjs`. The selftest is the unit layer.

Settled interfaces:

1. CLI.
   - Commands: `node scripts/e2e-admin.mjs [run] [--only <glob>[,<glob>...]] [--fixture <path>]`, `list`, `record --flow <name> --out <path>`, `selftest`.
   - Globbing: `*` is the only wildcard.
   - Exit 0: pass.
   - Exit 1: red. That means a flow failed, a negative control was wrongly green, teardown was unverified, or the scrub refused.
   - Exit 2: usage or setup. That means an unknown mode or flag, `--only` matching no flow, `--fixture` without exactly one matched flow, `record` without both `--flow` and `--out`, a vite boot or warm-up failure, or `record` against an unavailable live status.
   - Arguments are validated before vite boots.
   - npm scripts: `"e2e:admin": "node scripts/e2e-admin.mjs"` and `"e2e:admin:record": "node scripts/e2e-admin.mjs record"`.

2. Output.
   - Boot: `[e2e-admin] vite dev on OS-allocated port <port>`.
   - Per flow: `ok <flow> (<ms> ms)` or `FAIL <flow>: <message>`.
   - Per negative control: `ok negative <flow> <- <fixture> (red as expected)` or `FAIL negative <flow> <- <fixture>: passed against a wrong-behavior fixture`.
   - Teardown: `[e2e-admin] teardown verified: process tree dead, port released`.
   - The last line is `e2e-admin: <p> passed, <f> failed`, counting every row.
   - `list` prints one flow name per line, then one `negative <flow> <fixture>` line per negative control, and nothing else on stdout.

3. Scenario format v1 (`scenario.ts`). This is deliberately not a `DevtoolsCapture`, per the architect's Rejected alternatives. `parseScenario(text)` throws an error that names the JSON path of the first bad field, for example `turns[0].respond`.
```ts
interface AdminScenario {
  kind: 'agent-ui-admin-scenario'; version: 1; name: string
  seed?: { localStorage: Record<string, string> }
  status?: { available: boolean; providers: number } // default { available: true, providers: 1 }
  turns: ScriptedTurn[]
}
interface ScriptedTurn {
  endpoint: 'produce' | 'chat'
  match?: { mission?: boolean; inputKind?: 'intent' | 'client'; textIncludes?: string }
  respond: { lines: string[] } | { text: string } | { status: number; error: string } | { abort: true }
  delayMs?: number
}
```

4. Intercept: `installIntercept(context, scenario, origin): WireLog`, installed on the browser context.
   - Any request whose origin differs from the vite origin is aborted and logged as `external`.
   - Every same-origin path that starts with `/__a2ui/` is answered by the route and never continued to vite. This is the keyless guarantee: the dev proxy never sees a request, even when `.env` holds a key.
   - `GET /__a2ui/agent/status` answers `scenario.status`.
   - `GET /__a2ui/agent/integrations` answers 404, so the page keeps its static packs (the degrade in `fetchLiveIntegrations`, `site/lib/admin-live-runner.ts:108`).
   - `POST /__a2ui/agent` (produce) and `POST /__a2ui/agent/chat` take the next unconsumed turn for that endpoint, in array order.
   - A `match` miss answers 500, is logged as `unmatched`, and does not consume the turn. When no turn is left, the response is 500 and the log says `exhausted`.
   - Any other `/__a2ui/` path answers 404 and is logged as `other-a2ui`.
   - Response shapes:
     - `lines`: 200 `application/x-ndjson`, one line per entry.
     - `text`: 200 JSON `{text}`.
     - `{status, error}`: that status with JSON `{error}`.
     - `abort`: calls `route.abort()`.
     - `delayMs`: waits before answering.
   - Matching:
     - `match.mission` compares the produce body's `builderMission`.
     - `match.inputKind` compares `input.kind`.
     - `match.textIncludes` searches the intent text.
   - Wire entry shape: `{seq, at, endpoint, method, url, request?, outcome: 'fulfilled'|'aborted'|'unmatched'|'exhausted', turnIndex?}`, where `request` is the parsed JSON body.

5. Runner (`runner.ts`).
   - One vite per run, spawned detached with `--port <port> --strictPort --host 127.0.0.1` on `freePort()`. Readiness is `waitForHttp(<base>/agent-admin-app.html)`.
   - One Chromium for the run, with a fresh context per flow at a 1440x900 viewport.
   - Before the first flow, a warm-up navigation in a throwaway context waits for the armed runner, so vite's dependency optimizer cannot reload a page mid-flow. A warm-up failure exits 2.
   - Flows run sequentially with a 60 s per-flow timeout.
   - Teardown closes the browser, calls `killTree` on vite, then calls `assertPortReleased`. A failure in any of these exits 1.
   - A flow is red when any of these happens. Each raises `FlowAssertion`, as does every page-object wait on its own 15 s default timeout:
     - it throws
     - its wire log holds an `unmatched` or `exhausted` entry
     - a scripted turn stays unconsumed
   - Types: `AdminFlow {name, fixture, run(ctx)}` and `FlowContext {page, wire, scenario, base}`. `fixture` is `<flow>.json` under `scripts/e2e-admin/fixtures/`.
   - `NEGATIVE_CONTROLS: {flow, fixture}[]` lives in `flows/index.ts` and is empty in this step.
   - Negative controls run only in a full run without `--only`. A negative row is green only when its flow fails with a `FlowAssertion`; a crash or the per-flow timeout does not count as the expected red.
   - `--fixture <path>` is cwd-relative and replaces the matched flow's fixture.

6. Page object (`admin-page.ts`).
   - `ADMIN_SELECTORS` comes from the component's `data-part` hooks plus the composer's `[data-part="editor"]` and `[data-part="send"]`.
   - `openAdmin(page, base, scenario)`:
     - seeds `scenario.seed.localStorage` through `context.addInitScript`, guarded by a sessionStorage marker so a reload keeps edits made since;
     - navigates to `/agent-admin-app.html` (the vite root is `site`, `vite.config.ts:61`);
     - waits until `ui-agent-admin`'s `agentSurfaceTurn` is set.
   - `sendTestChat(text)` and `sendBuilderChat(text)` type into the chat-pane or copilot-pane composer and click send.
   - `waitForTurn(since)` polls `liveTurnCount()`.
   - `newAgent()` clicks `new-agent-wide`.
   - `switchPersona(id)` uses `agent-select`.
   - `isAuthoringArmed()` reports whether the Builder is armed.
   - `openSettingsTab(role)` clicks the `settings-nav` `ui-tab` whose key is the section `data-role`: `agent-content`, `capabilities-content`, `surface-content`, `context-system-content` or `context-dialog-content` (`agent-admin.ts:1166-1634`).
   - `readDialogTurns()` reads the `context-turn` rows.
   - Readers: `readTestTranscript()`, `readBuilderTranscript()`, `liveTurnCount()`, `readStorage(key)`.
   - DOM state is read with `page.evaluate` and structural casts.
   - Steps 3 and 4 add only the actions they alone use.

7. Imports.
   - Nothing under `scripts/e2e-admin/`, and not the entry, imports from `packages/`, `site/` or `@agent-ui/*`, type-only imports included. This keeps the barrel churn out of the flows and keeps Node type stripping away from DOM modules.
   - Allowed imports are `playwright` (types, plus `chromium` loaded inside the run path, never at selftest import) and local `.ts` files with explicit extensions.
   - `erasableSyntaxOnly` holds.

8. Record mode (`record.ts`).
   - It boots vite the same way a run does.
   - `/status` and `/integrations` pass through to the real dev proxy.
   - Produce and chat requests go out with `route.fetch()`. Each response is fulfilled to the page and teed into `turns` as `{endpoint, match: {mission, inputKind}, respond: {lines} | {text}}`.
   - Request bodies are never stored, so `personaSystem` never lands in a fixture.
   - A live status that is not available exits 2 before the flow runs.
   - The named flow runs with its assertions reported but not gating. The scenario (the flow fixture's `seed` and `status` plus the recorded `turns`) passes through `scrubScenario(scenario, process.env)` and is written to `--out`.
   - A scrub refusal writes nothing and exits 1.
   - `scrubScenario` refuses, naming the JSON path, any string that matches one of:
     - `sk-ant-[A-Za-z0-9_-]{16,}`
     - `sk-[A-Za-z0-9]{32,}`
     - `AIza[0-9A-Za-z_-]{35}`
     - the value of any env var named `*_KEY`, `*_TOKEN` or `*_SECRET` that is at least 12 characters long.
   - The live leg needs a key and is never run by this plan or by CI. The selftest proves the tee and the scrub.

9. Selftest (`selftest.ts`, run by `node scripts/e2e-admin.mjs selftest`).
   - No browser is launched; fake route objects drive the intercept and the recorder.
   - It prints `ok - <name>` or `FAIL - <name>` and exits 1 on any failure.
   - Criterion 1 pins these check names:
     - `parseScenario names the missing field`
     - `scrubScenario refuses a key-shaped value`
     - `intercept aborts a non-origin request`
     - `intercept never passes an /__a2ui/ request through`
     - `intercept records unmatched and exhausted turns`
     - `negative control reds a flow that passes its wrong-behavior fixture`
     - `negative control rejects a crash as the expected red`
     - `record tee builds turns from observed responses`
     - `every committed fixture parses`
     - `every registered flow names an existing fixture`

10. Type gate.
    - `scripts/e2e-admin/tsconfig.json` extends `../../tsconfig.tools.json` and sets `"include": ["./**/*.ts"]`.
    - `check:tools` becomes `tsc -p tsconfig.tools.json && tsc -p scripts/e2e-admin/tsconfig.json`.
    - This deliberately deviates from the architect's "add to the `tsconfig.tools.json` include". The reason: this step's verifier gets a type check scoped to this tree, while whole-repo gates stay on step 5. The standing `check` still covers the tree.
    - `check:scripts` appends `&& node scripts/e2e-admin.mjs selftest`.
    - Contract dependents of these two scripts: `.github/workflows/ci.yml:37` (a step name, still accurate) and `site/pages/testing-guide.ts:178`, which derives only `test`/`test:*` scripts and is unaffected.

Flows in this step, each with its fixture:
- `chat-greeting-note`:
  - The seed sets `agent-admin-app.activePreset` to `quant`, encoded the way `agent-roster-source.ts`'s storage adapter writes it.
  - It asserts the active agent is quant. This proves seeding runs before the page module, which the architect left unverified.
  - It sends `hello` in Test Chat against a note-only produce turn.
  - It asserts that `testChatTranscript()` holds the user turn plus an assistant turn containing the note.
  - It asserts that the wire log holds one fulfilled produce entry with `builderMission: false`.
  - It asserts that `openSettingsTab('context-dialog-content')` then shows one `context-turn` row.
- `infra-network-blocked`:
  - It has zero turns.
  - An in-page `fetch('https://example.com/e2e-admin-probe')` rejects, and the wire log holds that URL as `external` with outcome `aborted`.
  - The `/status` entry was answered by the intercept.
- `builder-arm-new-agent`:
  - `newAgent()` arms the Builder: `authoringStore` is set and `agent-admin-app.activePreset` names the new draft.
  - One Builder turn is answered by a note.
  - `builderInterviewTranscript()` then has one exchange, `testChatTranscript()` stays empty, and the produce entry carries `builderMission: true`.
- `builder-exit-clears`:
  - The flow arms the Builder, then calls `switchPersona('quant')`.
  - It asserts `authoringStore` is unset, `builderInterviewTranscript()` is empty and `liveTurnCount()` is 0. The only place that clears `authoringStore` is `applyPersona` (`site/pages/agent-admin-app.ts:585`).

Product code under `site/` and `packages/` stays untouched. If a flow exposes a product defect, stop with Status blocked and name it.

Run one e2e run at a time; each run counts as one browser lane under the ceiling (2 browser lanes, PR #1818). Added text carries no em dashes.

Focused checks: the criteria below, then `npm run check:scripts` and `npm run check:tools`.
### Acceptance criteria
- `out=$(node scripts/e2e-admin.mjs selftest) && for n in 'parseScenario names the missing field' 'scrubScenario refuses a key-shaped value' 'intercept aborts a non-origin request' 'intercept never passes an /__a2ui/ request through' 'intercept records unmatched and exhausted turns' 'negative control reds a flow that passes its wrong-behavior fixture' 'negative control rejects a crash as the expected red' 'record tee builds turns from observed responses' 'every committed fixture parses' 'every registered flow names an existing fixture'; do printf '%s\n' "$out" | grep -qxF "ok - $n" || exit 1; done`
- `node scripts/e2e-admin.mjs bogus; a=$?; node scripts/e2e-admin.mjs --only zz-no-such-flow; b=$?; node scripts/e2e-admin.mjs --only '*' --fixture scripts/e2e-admin/fixtures/chat-greeting-note.json; c=$?; node scripts/e2e-admin.mjs record; d=$?; test "$a" -eq 2 && test "$b" -eq 2 && test "$c" -eq 2 && test "$d" -eq 2`
- `out=$(node scripts/e2e-admin.mjs list) && for n in chat-greeting-note infra-network-blocked builder-arm-new-agent builder-exit-clears; do printf '%s\n' "$out" | grep -qx "$n" || exit 1; done`
- `out=$(node scripts/e2e-admin.mjs --only chat-greeting-note 2>&1); code=$?; port=$(printf '%s\n' "$out" | sed -n 's/.*OS-allocated port \([0-9][0-9]*\).*/\1/p' | head -n 1); test "$code" -eq 0 && printf '%s\n' "$out" | grep -qx 'e2e-admin: 1 passed, 0 failed' && test -n "$port" && ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null && ! pgrep -f -- "--port $port" >/dev/null`
- `out=$(node scripts/e2e-admin.mjs --only infra-network-blocked 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 1 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs --only 'builder-arm-new-agent,builder-exit-clears' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 2 passed, 0 failed'`
- `npx tsc -p scripts/e2e-admin/tsconfig.json`
- `node -e "const s = require('./package.json').scripts; const ok = [s['e2e:admin'] === 'node scripts/e2e-admin.mjs', s['e2e:admin:record'] === 'node scripts/e2e-admin.mjs record', s['check:scripts'].includes('node scripts/e2e-admin.mjs selftest'), s['check:tools'].includes('tsc -p scripts/e2e-admin/tsconfig.json')].every(Boolean); process.exit(ok ? 0 : 1)"`
- `test -d scripts/e2e-admin && ! grep -rnE "(from |import\()['\"]((\.\./)+(packages|site)/|@agent-ui/)" scripts/e2e-admin scripts/e2e-admin.mjs`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vqE '^(scripts/lib/dev-server\.mjs|scripts/e2e-devtools\.mjs|scripts/eval-catalog-gate\.mjs|scripts/e2e-admin\.mjs|scripts/e2e-admin/.+|package\.json|\.claude/skills/component-testing/references/test-craft\.md)$'`
