## Task goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

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
