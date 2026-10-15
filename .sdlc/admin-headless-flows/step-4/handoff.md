## Task goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

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
