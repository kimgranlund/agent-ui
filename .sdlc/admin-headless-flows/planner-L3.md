<!-- role=planner level=L3 model=opus effort=xhigh -->
## Goal
Ship `npm run e2e:admin`: a keyless, local-only Node and Playwright runner (Kim's fork 3 ruling) that boots the real agent-admin page on `vite dev`, answers every `/__a2ui/` request in the browser from committed scenario fixtures, and drives 23 named flows across Test Chat, the Builder, Settings, personas, teams and the failure paths. It also ships two negative controls, a record mode, a selftest in `check:scripts`, and the doc scrub.

## Step 1: Shared vite boot and teardown library
level: L2
### Do
Depends on: the no-barrels wave (GH #1814) merged to main. Kim ruled on 2026-10-05 that no build step of this plan starts before then, so the conductor confirms the merge before dispatching this step.

Create `scripts/lib/dev-server.mjs`. It exports `freePort()`, `waitForHttp(url, opts)` and `killTree(child, opts)`, moved with the same behavior from `scripts/e2e-devtools.mjs:45-111`. It also exports a new `assertPortReleased(port)`, the post-teardown connect probe that is inline today at `scripts/e2e-devtools.mjs:204-211`. That function resolves when nothing accepts on 127.0.0.1:port and rejects while something listens.

The module runs its CLI only when it is the main module (`import.meta.url === pathToFileURL(process.argv[1]).href`). Importing it therefore has no side effect. That side effect is the reason the copy at `scripts/eval-catalog-gate.mjs:15-22` exists.

CLI behavior:
- `selftest` runs negative controls and prints `ok - <name>` or `FAIL - <name>` lines.
- Any other argument exits 2.
- The selftest keeps the existing freePort, waitForHttp and killTree checks and the existing name `killTree reaps a detached parent+child tree and verifies it`.
- It adds `assertPortReleased rejects while the port still listens`.

Rewire `scripts/e2e-devtools.mjs` and `scripts/eval-catalog-gate.mjs`:
- Both import the three functions from `./lib/dev-server.mjs`. e2e-devtools also imports `assertPortReleased` in place of its inline probe.
- Delete both local copies.
- Keep both scripts' own selftests and usage contracts. Those selftests now exercise the imported functions, which proves the wiring.
- Rewrite the eval-catalog-gate header paragraph that justifies the copy (lines 15-22) so it names `scripts/lib/dev-server.mjs` as the home.

`package.json`: append `&& node scripts/lib/dev-server.mjs selftest` to `check:scripts`. Check it by membership only, because other lanes edit that line.

Contract dependents (from `git grep` of both script names and the three function names):
- No module imports either script's exports.
- `.claude/skills/component-testing/references/test-craft.md:140-142` describes "e2e-devtools.mjs's freePort/killTree boot-a-server shape". Repoint it to `scripts/lib/dev-server.mjs` in this step.
- ADR-0208:126 and `.claude/skills/a2ui-catalog-rendering-review/references/catalog-pipeline.md:112` stay accurate and are left alone.

Added text carries no em dashes (user rule). Step 5's guard scans the cumulative diff and every untracked file, so rewrite moved comments instead of copying them.

Focused checks: the criteria below, then `npm run check:scripts`.
### Acceptance criteria
- `out=$(node scripts/lib/dev-server.mjs selftest) && printf '%s\n' "$out" | grep -qxF 'ok - killTree reaps a detached parent+child tree and verifies it' && printf '%s\n' "$out" | grep -qxF 'ok - assertPortReleased rejects while the port still listens'`
- `out=$(node --input-type=module -e "const m = await import('./scripts/lib/dev-server.mjs'); for (const k of ['freePort', 'waitForHttp', 'killTree', 'assertPortReleased']) if (typeof m[k] !== 'function') process.exit(1)" 2>&1) && test -z "$out"`
- (guard) `node scripts/e2e-devtools.mjs selftest`
- (guard) `node scripts/eval-catalog-gate.mjs selftest`
- `! grep -qE '^(export )?(async )?function (freePort|waitForHttp|killTree)\(' scripts/e2e-devtools.mjs scripts/eval-catalog-gate.mjs`
- `for f in scripts/e2e-devtools.mjs scripts/eval-catalog-gate.mjs; do grep -qF "from './lib/dev-server.mjs'" "$f" || exit 1; done`
- `! grep -qF 'DELIBERATE, self-contained COPY' scripts/eval-catalog-gate.mjs`
- `grep -qF 'node scripts/lib/dev-server.mjs selftest' package.json`
- `grep -qF 'scripts/lib/dev-server.mjs' .claude/skills/component-testing/references/test-craft.md`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vqE '^(scripts/lib/dev-server\.mjs|scripts/e2e-devtools\.mjs|scripts/eval-catalog-gate\.mjs|package\.json|\.claude/skills/component-testing/references/test-craft\.md)$'`

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

## Step 3: Test Chat and Builder flows with the two negative controls
level: L3
### Do
Depends on: step 2.

Extend `scripts/e2e-admin/flows/test-chat.ts`, `flows/builder.ts`, `flows/index.ts` and `fixtures/`. Add `clickSurfaceButton(label)` and `answerAsk(label)` to `admin-page.ts`, plus any reader these flows need.

Test Chat flows:
- `chat-surface-render`:
  - A produce turn carries createSurface plus updateComponents: a Column root and a Button labelled `Click me`, the `SEED_MESSAGES` shape at `packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts:43`.
  - It asserts that a `ui-button` reading `Click me` renders inside the chat pane's surface host.
- `chat-click-turn`:
  - The first turn is the same.
  - Clicking the button sends a second produce POST with `input.kind: 'client'`, answered by an update-only line (the `VALID_FOLLOWUP_LINE` shape, same file `:59`).
  - It asserts two fulfilled produce entries and that the button label updated in place.
- `chat-ask-answer`:
  - The first turn carries `{"a2uiMeta":{"ask":{"surfaceId":"<id>"}}}` plus that surface with an answer button.
  - Clicking the button sends a `client` turn.
  - It asserts the second POST and that the transcript records the answered round.
- `chat-flowend-chrome`:
  - The turn ends with `{"a2uiMeta":{"flowEnd":true}}`.
  - It asserts that the page's flow chrome row appears in the Test Chat log. The row is `role="group"` with `aria-label="Flow complete"` (`site/lib/flow-chrome.ts:67-69`, wrapped by `withFlowChrome` in `agent-admin-app.ts`).

Builder flows:
- `builder-patch-applies`:
  - An armed Builder turn carries `personaPatch.values.name = "Scripted Draft"`.
  - It asserts that `agent-admin-app.<draftId>.name` holds the JSON string `"Scripted Draft"`. The memory store writes `${persistKey}.${key}` JSON-encoded (`packages/agent-ui/app/src/controls/settings/memory-store.ts:9-11`).
  - It asserts that the produce entry has `builderMission: true`.
  - It asserts that the turn's `context-turn` row carries the patch report (the `patch` member logged at `agent-admin.ts:3793`).
  - Keep the flow to a few turns, because the Dialog Turns ring drops rows past `TURN_LOG_CAP`.
- `builder-plan-renders`:
  - A `plan` meta-line declares two steps.
  - It asserts both step descriptions appear in the last `builderInterviewTranscript()` entry. The plan checklist joins the outgoing note at `agent-admin.ts:3764`.
- `builder-team-declared`:
  - A `team` meta-line declares `{label: "Scripted Crew", members: [two members, each with name, role and routingDescription]}`.
  - It asserts an `agent-ui-agent-teams.<teamId>` key whose record has label `Scripted Crew`, a `gmAgentId` equal to the draft id, and two members whose `agentId` values are in the roster (`handleTeamDeclared`, `site/pages/agent-admin-app.ts:781`).
- `builder-section-routing` (follow-the-change):
  - Before the turn, `settings-nav` selects `agent-content`.
  - The turn patches `values.skillsEnabled = false` (`kindEnabledKey`, `agent-admin-schema.ts:181`; mapped to `capabilities-content` in `field-location.ts:92-93`).
  - It asserts the selection moves to `capabilities-content`.
  - If the apply gate does not admit `skillsEnabled`, patch an entry append to the `skill` kind instead; both map to `capabilities-content`. Name the choice in the builder report.
- `builder-session-isolation`:
  - With the Builder armed, a Test Chat send carries `builderMission: false` and a Builder send carries `true`.
  - The two transcripts stay disjoint (origin routing in `#contextFor`, `agent-admin.ts:2542`).

Negative controls:
- `fixtures/negative/patch-wrong-key.json` is the patch fixture with the key `nmae` in place of `name`, which the gate drops.
- `fixtures/negative/missing-flowend.json` is the flowEnd fixture without the flowEnd line.
- Register both in `NEGATIVE_CONTROLS`, against `builder-patch-applies` and `chat-flowend-chrome`.
- Each must fail its flow with a `FlowAssertion`.

Step 2's discipline applies: no edits under `site/` or `packages/` (stop as blocked on a product defect), one browser lane at a time, no em dashes.

Focused checks: the criteria, plus `npx tsc -p scripts/e2e-admin/tsconfig.json`.
### Acceptance criteria
- `out=$(node scripts/e2e-admin.mjs --only 'chat-*' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 5 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs --only 'builder-*' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 7 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs --only builder-patch-applies --fixture scripts/e2e-admin/fixtures/negative/patch-wrong-key.json 2>&1); test $? -eq 1 && printf '%s\n' "$out" | grep -q '^FAIL builder-patch-applies: '`
- `out=$(node scripts/e2e-admin.mjs --only chat-flowend-chrome --fixture scripts/e2e-admin/fixtures/negative/missing-flowend.json 2>&1); test $? -eq 1 && printf '%s\n' "$out" | grep -q '^FAIL chat-flowend-chrome: '`
- `out=$(node scripts/e2e-admin.mjs list) && for n in chat-surface-render chat-click-turn chat-ask-answer chat-flowend-chrome builder-patch-applies builder-plan-renders builder-team-declared builder-section-routing builder-session-isolation 'negative builder-patch-applies negative/patch-wrong-key.json' 'negative chat-flowend-chrome negative/missing-flowend.json'; do printf '%s\n' "$out" | grep -qxF "$n" || exit 1; done`
- `for f in chat-surface-render chat-click-turn chat-ask-answer chat-flowend-chrome builder-patch-applies builder-plan-renders builder-team-declared builder-section-routing builder-session-isolation negative/patch-wrong-key negative/missing-flowend; do test -f "scripts/e2e-admin/fixtures/$f.json" || exit 1; done && node scripts/e2e-admin.mjs selftest >/dev/null`
- (guard) `test -z "$(git ls-files --others --exclude-standard -- site packages)" && git diff --quiet "$SDLC_BASE_SHA" -- site packages`

## Step 4: Settings, persona, teams and failure-path flows
level: L3
### Do
Depends on: step 2, not step 3. These flows use only the step 2 page object plus the actions added here.

Add `scripts/e2e-admin/flows/settings.ts`, `flows/personas-teams.ts`, `flows/failure-paths.ts`, their fixtures, and their registrations in `flows/index.ts`. Add these actions to `admin-page.ts`: `editAgentName(value)`, `toggleKind(kind)`, `addEntry(kind, label)`, `removeEntry(kind, label)`, `resetAgent()` and `composerSendEnabled(pane)`.

Settings flows:
- `settings-edit-persists`:
  - Edit the Agent section's `name` field, then call `page.reload()`.
  - It asserts that `agent-admin-app.<activeId>.name` and the field both hold the new value. The seed marker keeps the reload from re-seeding.
- `settings-kind-toggle`:
  - Flip the `skill` kind's `kind-enabled` switch.
  - It asserts that `agent-admin-app.<activeId>.skillsEnabled` flips.
- `settings-entry-add-remove`:
  - Add an entry to the `skill` kind's entry list, then remove it.
  - It asserts the persisted list (key from `entriesStoreKey('skill')`) grows by one, then returns to its prior length.
- `settings-persona-picker`:
  - Pick another preset in `agent-select`.
  - It asserts that `agent-admin-app.activePreset` and the Agent section's name field follow the pick.
- `settings-reset-agent`:
  - Edit the name, then click `reset-agent-button`, answering its confirm if one opens.
  - It asserts the name returns to the preset's seed and the edited value is gone from storage.

Persona and teams flows:
- `persona-switch-fresh-session`:
  - Run one Test Chat turn on the default agent, then switch persona.
  - It asserts `liveTurnCount()` is 0 and `testChatTranscript()` is empty.
  - It asserts the next produce POST carries `input.session.turns` of length 0. The page re-arms a fresh runner per persona (`site/pages/agent-admin-app.ts:1659-1674`).
- `teams-validate-incomplete`:
  - An armed Builder turn declares a team whose member has a blank `routingDescription`.
  - It asserts that no `agent-ui-agent-teams.*` key exists and the roster gained no member personas. The page refuses an incomplete roster in `handleTeamDeclared`; if `readMetaLine` drops the arm first, the observable result is the same.

Failure flows:
- `failure-http-error`:
  - Produce answers 503 with `{error}`.
  - It asserts that the last `testChatTranscript()` assistant entry starts with `⚠`, the Test Chat send control is enabled, the `context-turn` row carries the error, and a following scripted turn completes.
- `failure-error-line`:
  - Produce answers 200 with a terminal `{"a2uiMeta":{"error":"..."}}` line (the `formatErrorLine` shape).
  - The assertions are the same as `failure-http-error`.
- `failure-abort`:
  - The produce turn is `{delayMs: 1500, respond: {abort: true}}`.
  - It asserts the send control is disabled while the request is pending, then re-enabled by the fail path, and that a following turn completes.
  - The 120 s client timeout (`TIMEOUT_MS`, `site/lib/admin-live-runner.ts:45`) is a module constant and is not exercised. This flow proves the abort path, not the timeout branch.

Step 2's discipline applies: no edits under `site/` or `packages/`, one browser lane, no em dashes.

Focused checks: the criteria, plus `npx tsc -p scripts/e2e-admin/tsconfig.json`.
### Acceptance criteria
- `out=$(node scripts/e2e-admin.mjs --only 'settings-*' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 5 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs --only 'failure-*' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 3 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs --only 'persona-*,teams-*' 2>&1) && printf '%s\n' "$out" | grep -qx 'e2e-admin: 2 passed, 0 failed'`
- `out=$(node scripts/e2e-admin.mjs list) && for n in settings-edit-persists settings-kind-toggle settings-entry-add-remove settings-persona-picker settings-reset-agent persona-switch-fresh-session teams-validate-incomplete failure-http-error failure-error-line failure-abort; do printf '%s\n' "$out" | grep -qxF "$n" || exit 1; done`
- `for f in settings-edit-persists settings-kind-toggle settings-entry-add-remove settings-persona-picker settings-reset-agent persona-switch-fresh-session teams-validate-incomplete failure-http-error failure-error-line failure-abort; do test -f "scripts/e2e-admin/fixtures/$f.json" || exit 1; done && node scripts/e2e-admin.mjs selftest >/dev/null`
- (guard) `test -z "$(git diff --name-only "$SDLC_BASE_SHA" -- site packages; git ls-files --others --exclude-standard -- site packages)"`

## Step 5: Doc scrub and gates green
level: L2
guard timeout: 150
### Read first
- `packages/agent-ui/a2ui/AGENTS.md`
### Do
Depends on: steps 3 and 4.

Make one short addition per file. Word every addition as local-only with no CI job, per Kim's 2026-10-05 ruling, and use no em dashes.
- `CLAUDE.md` Commands: add three bullets:
  - `npm run e2e:admin`: keyless headless agent-admin flows, outside the six shards, local only.
  - `npm run e2e:admin:record`: manual, needs a key in `.env`, never run in CI.
  - `npm run e2e:devtools`: the bullet that is missing today.
- `AGENTS.md` Gates: one bullet naming `npm run e2e:admin` and `npm run e2e:devtools` as local-only runners outside the shards, not CI gates.
- `.claude/skills/component-testing/SKILL.md` ("The gates") and `references/test-craft.md` (beside the eval-catalog paragraph at `:140`): say that flows run outside the shards, and that a change to `ui-agent-admin`, `site/pages/agent-admin-app.ts` or `site/lib/admin-live-runner.ts` runs `npm run e2e:admin` locally.
- `.claude/skills/a2ui-build/SKILL.md` (the "Devtools work" line, `:33`) and `.claude/skills/a2ui-prompt-authoring/SKILL.md` (`:94-96`): point at `npm run e2e:admin` for keyless agent-admin replays and at `npm run e2e:admin:record` for capturing a fixture.
- `packages/agent-ui/a2ui/AGENTS.md`, trust-boundary line (`:23`): add that `scripts/e2e-admin` answers `/__a2ui/agent` from fixtures through Playwright routes and adds no key path.
- `.claude/docs/spec/devtools-harness.spec.md` §4, under SPEC-N1: add a non-normative note with two parts.
  - A cross-reference to `scripts/e2e-admin` as a consumer-side runner.
  - The known gap: `capturedLineTimelines` replays only `line` events, while `recordTurn` moves meta-lines into `meta` events, so a capture loses note, ask, patch, plan, team and flowEnd lines. Admin fixtures carry raw wire lines instead. Meta replay is a follow-up that would amend R3/R10, not part of this ticket (handoff fork 2; the architect's Rejected alternatives).
- `.claude/docs/spec/a2ui-live-agent.spec.md` §6 Open items, and `.claude/docs/lld/agent-admin-live-model-overlay.lld.md` §5 Gates table: describe the `page.route` seam. `/__a2ui/agent/status`, `/chat` and `/__a2ui/agent` are answered in the browser by `scripts/e2e-admin`, with zero production change.
- `.claude/docs/references/agent-model.md` §3 Glossary: add `- **admin flow**:` and `- **scenario fixture**:` entries. The bare word "flow" already names ask-flows and the guided-authoring flow, so the term keeps its qualifier.
- `.claude/docs/goals.md`, Standing definition of done: one line saying `npm run e2e:admin` is a local agent-admin check, not a DoD item and not in CI.
- `.claude/docs/adr/0200-agent-ui-devtools-package.md`: append a blockquote `> **Note (<date>, T-0010):**`, the form ADR-0040 uses at `:167` (accepted ADRs are append-only per `doc-standards`).
  - The note says the admin flow runner lives in `scripts/e2e-admin`, outside the package, which is consistent with SPEC-N1 (not a test runner).
  - The H1 stays unchanged, so the sitemap indexes need no regeneration.

Left untouched on purpose: `.claude/agents/component-build-agent.md` and `.claude/agents/example-authoring-agent.md`. A grep at plan time found no e2e or devtools mention in either.

Doc checks:
- `doc_lint.py` (the newest `~/.claude/plugins/cache/nonoun-plugins/docs/*/scripts/doc_lint.py`) printed "not a functional document" with exit 0 for every target at plan time, so it is not a gate. Still run it on each changed doc and paste the output.
- Run `npx vitest run site/lib/docs-grammar.test.ts site/lib/adr.test.ts`. Both read the docs corpus and were green at plan time.

Gates: run `npm run check` and `npm run e2e:admin` (one browser lane), and fix any red the earlier steps introduced, within the scope criterion. A gate already red at the build-start HEAD comes back as Status `inherited red`.
### Acceptance criteria
- `for f in CLAUDE.md AGENTS.md .claude/skills/component-testing/SKILL.md .claude/skills/component-testing/references/test-craft.md .claude/skills/a2ui-build/SKILL.md .claude/skills/a2ui-prompt-authoring/SKILL.md .claude/docs/goals.md; do grep -qF 'e2e:admin' "$f" || exit 1; done`
- `for f in CLAUDE.md AGENTS.md; do grep -qF 'e2e:devtools' "$f" || exit 1; done`
- `for f in .claude/docs/spec/devtools-harness.spec.md .claude/docs/spec/a2ui-live-agent.spec.md .claude/docs/lld/agent-admin-live-model-overlay.lld.md .claude/docs/adr/0200-agent-ui-devtools-package.md packages/agent-ui/a2ui/AGENTS.md; do grep -qF 'scripts/e2e-admin' "$f" || exit 1; done`
- `grep -qF -- '- **admin flow**:' .claude/docs/references/agent-model.md && grep -qF -- '- **scenario fixture**:' .claude/docs/references/agent-model.md`
- `grep -qF 'capturedLineTimelines' .claude/docs/spec/devtools-harness.spec.md`
- `out=$(npm run e2e:admin 2>&1); code=$?; port=$(printf '%s\n' "$out" | sed -n 's/.*OS-allocated port \([0-9][0-9]*\).*/\1/p' | head -n 1); test "$code" -eq 0 && printf '%s\n' "$out" | grep -qE '^e2e-admin: [0-9]+ passed, 0 failed$' && printf '%s\n' "$out" | grep -qF 'ok negative builder-patch-applies' && printf '%s\n' "$out" | grep -qF 'ok negative chat-flowend-chrome' && test -n "$port" && ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null && ! pgrep -f -- "--port $port" >/dev/null`
- (guard) `npm run check`
- (guard) `! { git diff --name-only "$SDLC_BASE_SHA" -- . ':(exclude).sdlc'; git ls-files --others --exclude-standard -- . ':(exclude).sdlc'; } | grep -vqE '^(scripts/(lib/dev-server|e2e-devtools|eval-catalog-gate|e2e-admin)\.mjs|scripts/e2e-admin/.+|package\.json|CLAUDE\.md|AGENTS\.md|packages/agent-ui/a2ui/AGENTS\.md|\.claude/skills/(component-testing/SKILL|component-testing/references/test-craft|a2ui-build/SKILL|a2ui-prompt-authoring/SKILL)\.md|\.claude/docs/(goals|references/agent-model|spec/devtools-harness\.spec|spec/a2ui-live-agent\.spec|lld/agent-admin-live-model-overlay\.lld|adr/0200-agent-ui-devtools-package)\.md)$'`
- (guard) `d=$(printf '\342\200\224') && ! { git diff -U0 "$SDLC_BASE_SHA" -- . ':(exclude).sdlc' | grep '^+' | grep -v '^+++ '; git ls-files --others --exclude-standard -z -- . ':(exclude).sdlc' | xargs -0 cat; } | grep -qF "$d"`

## Assumptions
- Kim's rulings settle the open forks:
  - fork 3 is a Node script `scripts/e2e-admin.mjs` with the bundled `playwright`, not `@playwright/test`;
  - there is no CI job and no `e2e-admin.yml`, and the wording is local-only;
  - no build step starts before the no-barrels wave (#1814) merges.
  - Verified by: the handoff's `## Rulings` section.
- Intercept URLs, arming, peel order, public readers, storage keys and `data-part` hooks: verified by `.sdlc/admin-headless-flows/architect-L1.md` `## Carry forward`. Re-read at plan time: `site/pages/agent-admin-app.ts:1659-1674`, `site/lib/admin-live-runner.ts:42-45,85,203-311`, and `agent-admin.ts:4590-4615`.
- A failed fetch, a non-2xx response, or an `a2uiMeta.error` line all reach the component's fail path. Each records a `⚠ <message>` transcript entry and an error `context-turn` row. Verified by `admin-live-runner.ts:252-268` and `agent-admin.ts:3805-3809`.
- Persona store values persist as `agent-admin-app.<id>.<key>`, JSON-encoded. The Builder store has no `persistKey`, and its seed turns the authoring gate on. Verified by `memory-store.ts:9-11,31-38`, `site/pages/agent-admin-presets.ts:655,1024,1038-1041`.
- Patch and team consumption need both the store-identity fence and the authoring gate. The section of the first applied key drives follow-the-change. Verified by `agent-admin.ts:3659-3705` and `field-location.ts:84-93`.
- Team records persist under `agent-ui-agent-teams.<teamId>`. Verified by `agent-team.ts:116,203` and `site/pages/agent-admin-app.ts:781-835`.
- The flow chrome row has role `group` and aria-label `Flow complete`. Verified by `site/lib/flow-chrome.ts:67-69`.
- The page is `/agent-admin-app.html` under vite root `site`. Verified by `vite.config.ts:61` and `ls site/agent-admin-app.html`.
- Node v24.9.0 strips types for `.ts` imported from `.mjs`. Verified by `node --version` and the precedent at `scripts/e2e-devtools.mjs:118`.
- No module imports the helpers moved in step 1. The only doc dependent is `test-craft.md:140-142`. Verified by `git grep` of `e2e-devtools.mjs`, `eval-catalog-gate.mjs`, `freePort` and `killTree`.
- The `check:scripts`/`check:tools` edits break no consumer. Verified by `git grep` (only `ci.yml:37`'s step name, plus `site/pages/testing-guide.ts:178`, which derives `test:*` scripts only).
- At plan time:
  - `npm run check` was green in 39 s, hence the 150 s guard timeout;
  - `npx vitest run site/lib/docs-grammar.test.ts site/lib/adr.test.ts` was green;
  - `doc_lint.py` exited 0 with "not a functional document" on every step 5 target.
  - Verified by running each.
- Every new-behavior criterion is red now for the right reason (missing script, file or text), and every guard is green now. Guards seen red:
  - scope guards and the em dash guard with `SDLC_BASE_SHA` set to HEAD~3;
  - the site/packages guards with HEAD~5;
  - both selftest guards under `env PATH=/var/empty`.
  - `npm run check` was not mutated to red, because it is the standing gate rule 14 requires.
  - The scope guards hold under bash, not zsh, which treats `!` before a brace group differently. Verified by probes in both shells.
- `.claude/agents/component-build-agent.md` and `example-authoring-agent.md` need no edit. Verified by grep (no e2e, playwright or devtools mention).

## Risks
- The no-barrels wave lands first and changes how controls and CSS load, including a renderer loader with deferred apply. Surfaces may therefore render asynchronously. Flows poll with timeouts, and the `data-part` hooks, public readers and storage keys are outside that wave's scope, but `site/` line references in this plan will shift.
- Vite's dependency optimizer can still reload a page the first time a lazily imported dependency (CodeMirror, pdfjs) is reached mid-flow, after the warm-up. Expect flaky first runs if a flow opens such a surface.
- Host load: every e2e run (builder and verifier) is one browser lane under the 2-lane ceiling. A red under load must be checked in isolation (skill `flaky-gates`) before it is called a regression.
- Step 2 is large (L4). If its verifier fails twice, the bump goes to L5.
- Settings flows drive nested fleet controls (`ui-select`, `ui-switch`, `ui-tabs` with an overflow menu). The 1440x900 viewport keeps all five settings tabs visible (from about 1200 px, `agent-admin.ts:1664-1669`); a narrower band changes the click paths.
- `skillsEnabled` may not pass the patch gate's admission. Step 3 names the entry-append fallback.
- Record mode's live leg is never exercised by this plan. A key-bearing manual run may still find defects in the pass-through path.
- T-0005 also edits the `CLAUDE.md`/`AGENTS.md` Commands sections. The membership criteria survive a merge, but a textual conflict needs a resync.
- A future async storage tier would break seed-before-module (the `agent-roster-source.ts` header names that tier).
