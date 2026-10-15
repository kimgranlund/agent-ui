---
id: T-0010
title: "Closed-loop headless flows for the agent-admin app: Test Chat, Builder chat, Settings, personas, teams"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L
priority: P2
depends: []
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---
## Goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

## Intent
- Do: `npm run e2e:admin` (keyless, network blocked), a scenario fixture format, a Playwright fixture with seeding helpers, flows per surface, a manual record script, a runner selftest in `check:scripts`, the scrub list.
- Non-goals: a new shard or heap bump in the six browser shards; `@playwright/test` without a Kim ruling; any key, provider or `produce()` inside `@agent-ui/devtools`.
- Done when: the acceptance outline passes, including a seeded wrong-behavior fixture that fails a named flow with a nonzero exit.

## Context (read-only agent verified 2026-10-05; re-verify what you rely on)
- The seam is NOT `AgentTransport`: `ui-agent-admin` takes two injected props, `agentTurn` (prose runner, `Promise<string>`, `agent-admin.ts:314`) and `agentSurfaceTurn` (streaming typed events, takes precedence, `agent-admin.ts:319`, types `agent-admin-schema.ts:942,947`); neither set means the stub arm (`:311`).
- Panes: `chat | settings | copilot` (`agent-admin.ts:274-286`); Test Chat is `chat`; the Builder is `copilot`, active while `authoringStore` is set (`:344`, minted at `agent-admin-app.ts:733`); Settings has a `ui-tabs` sub-nav (`:1674-1705`). Transcripts: `testChatTranscript()` and `builderInterviewTranscript()` (`:4590,4603`); `#turnLog` (`:819`) is element-lifetime, public readability unverified.
- The page arms a runner at `agent-admin-app.ts:1661-1673`: `probeLive()` (`live-proxy-transport.ts:40-47`, GET `/__a2ui/agent/status`); if `available:true` it assigns `createAdminAgentTurn()` and `withFlowChrome(createAdminSurfaceTurn())`.
- Network surface: `admin-live-runner.ts:42,52` POSTs `/__a2ui/agent/chat` (JSON `{text}`); `:85,203` POSTs `/__a2ui/agent` (NDJSON; body carries `builderMission: sessionKey==='authoring'`, `personaSystem`, `catalogId`, `authoring`; meta-lines peeled into `progress|note|ask|patch|plan|flowEnd|team|target`). `dev-proxy-plugin.ts:265` serves `/status`; `vite.config.ts:62` mounts the plugins. No replay or mock mode exists in the dev proxy or the Worker.
- Existing browser tests: `site/pages/agent-admin-app.browser.test.ts` (in-process page: roster, import and export, drawer, reset), `agent-admin-app-scroll`, `-mobile-overflow`, `agent-admin.browser.test.ts`, `agent-admin-click-turn.browser.test.ts` (scripted-runner precedent: `mountWithScript`, `:102-125`), `agent-team-pane.browser.test.ts`, `agent-admin-lazy.browser.test.ts`, `dogfood-lazy.browser.test.ts`. No navigation-level test against a booted server; no page object.
- Gates: `vitest.browser.config.ts` projects `packages`, `packages-rest`, `site`, `focus-timing` (explicit file list), `visual`; `package.json:19-28` chains six sequential shards then `test:eval-catalog`. `scripts/e2e-devtools.mjs` runs outside the shards (`freePort`, `waitForHttp`, detached vite group, verified `killTree`, `HARNESS_SELECTORS` from `playwright/index.ts:26-50`); its `selftest` runs in `check:scripts` (`package.json:15`). Playwright 1.61 is a devDependency (`:47`); `@playwright/test` is not.
- Devtools: `scriptTransport` and `replayTransport` (`replay.ts:28-70`), `recordTurn` (`events.ts:114`), capture `{kind, version:1, createdAt, backend, session, timeline}` (`format.ts:19-31`, `parseCapture` `:94`). Verified gap: `capturedLineTimelines` replays only `line` events (`replay.ts:50-60`) while `recordTurn` moves meta-lines into `meta` events (`events.ts:129-137`), so a capture replay loses note, ask, patch, plan, team and flowEnd lines the admin runner needs. The admin app does not use `recordTurn` today.
- Persistence: personas `agent-admin-app.<id>` (`agent-roster-source.ts:32`, `agent-admin-presets.ts:654-655`); imported personas and roster order `IMPORTED_PERSONAS_KEY`, `ROSTER_ORDER_KEY` (`agent-roster-source.ts:44-45`); teams namespace `agent-ui-agent-teams` (`agent-team.ts:116`); the Builder store has no `persistKey` (`agent-admin-presets.ts:911`). The `ui-agent-admin` key named in the config is unverified.

## Design forks (Kim decides fork 3)
1. Keyless injection: Playwright `page.route` on `/__a2ui/agent/status`, `/chat` and `/__a2ui/agent` returning scripted JSON or NDJSON; it exercises the real runner (peel, abort, timeout) with zero production change. No Kim decision.
2. Fixture format: scenario JSON `{persona, seed (localStorage), steps[{act, expect}], turns[{match, ndjson|error|delayMs}]}` carrying raw wire lines including meta-lines, not `DevtoolsCapture`; adding meta replay to `capturedLineTimelines` is a separate small devtools slice. No Kim decision.
3. Runner: recommended a Node script plus helper module in the `e2e-devtools.mjs` style (`npm run e2e:admin`, selftest in `check:scripts`, reuse `freePort` and `killTree`). Vitest browser mode would join the six shards and cannot navigate, reload or seed storage across a page load; `@playwright/test` is a new dependency and a second runner and needs a Kim ruling. NEEDS KIM.
4. Recording: a separate manual `npm run e2e:admin:record` against `vite dev` with the key in `.env`, teeing `/__a2ui/agent` responses into a fixture; the key never reaches the browser or fixture (ADR-0073); fixtures scrubbed of secrets and PII and committed; CI never runs it. This is also the key-free path for the Croupier Haiku capture (T-0004). No Kim decision.

## Constraints
Keyless and networkless in CI; one Chromium and one vite at a time on an OS-allocated port (never 5173); outside the six shards (no new shard, no heap bump); respect the concurrency ceiling (GH #1816, PR #1818); teardown proves no zombie process; `erasableSyntaxOnly`; no key, provider adapter or `produce()` in `@agent-ui/devtools` (ADR-0200, ADR-0073); the `./playwright` helper stays structurally typed; no em dashes.

## Scrub and upsert list
`CLAUDE.md` and `AGENTS.md` (add `e2e:admin` under Commands and Checks; note `e2e:devtools` is not listed today); `.claude/skills/component-testing/SKILL.md` and `references/test-craft.md` ("flows run outside the shards"; `test-craft.md` is also edited by PR #1818); `.claude/skills/a2ui-build/SKILL.md`, `a2ui-prompt-authoring/SKILL.md`, `packages/agent-ui/a2ui/AGENTS.md` (the e2e or devtools mentions); `.claude/docs/spec/devtools-harness.spec.md` (meta-replay requirement, flow-runner cross-reference); `.claude/docs/spec/a2ui-live-agent.spec.md` and the agent-admin live-model overlay LLD (the `page.route` seam); `.claude/docs/references/agent-model.md` (a glossary term for flow and fixture); `.claude/docs/goals.md` (test gates line); ADR-0200 (a note, not a rewrite); not yet checked: `.claude/agents/component-build-agent.md`, `example-authoring-agent.md`.

## Dependencies and conflicts
Land PR #1818 (ceiling) first, then rebase. Queue behind T-0005 (agent-behavior evals) on the `CLAUDE.md` and `AGENTS.md` Commands edit, and behind T-0003 on the a2ui specs, or coordinate. Land BEFORE the barrel wave (GH #1814): pin imports through the page only, or the flows churn. T-0004 (Croupier Haiku) can become a seeded regression flow. Keep error and abort scenarios separate from the retry and abort work (GH #1797).

## Size and lane
L, planner L3, no architect needed, only the fork 3 ruling. Slices: 1 fixture, scenario format and `page.route` fixture plus one Test Chat flow; 2 meta replay in devtools; 3 Builder and Settings flows; 4 personas, teams, error and abort paths; 5 record script plus the doc scrub.

## Acceptance outline
`npm run e2e:admin` exits 0 keyless with the network blocked, boots vite on a free port, leaves no process or port behind. Test Chat (5 or more): greeting turn, surface render, click-through client turn, ask and answer, flowEnd chrome. Builder (5 or more): arm via "+" new agent, patch applies to the store, plan, team declared, section routing, flow exit clears `authoringStore`. Settings (5 or more): edit persists, kinds toggle, entry-list add and remove, persona picker, Reset Agent. Plus persona switching (fresh session per persona), teams create and validate, an error turn, a timeout or abort leaving the composer re-enabled. Assertions read the DOM, `testChatTranscript()`, the persisted keys and the timeline. A seeded wrong-behavior fixture (a patch to the wrong key, a missing flowEnd) fails a named flow with a nonzero exit; a runner selftest with a negative control is in `check:scripts`; scrub list applied; `doc_lint` plus `check` green.

## Rulings
- Kim ruled 2026-10-05: fork 3 = Node script `scripts/e2e-admin.mjs` in the e2e-devtools shape with bundled playwright (not @playwright/test); NO CI job yet (no `e2e-admin.yml`); acceptance wording says local-only. Architect: `architect-L1.md`.
- Plan is design-only until the no-barrels wave (#1814) merges: a build step must not start before then; record that as a `Depends on` line in step 1.

## Closed

2026-10-06: Merged to main in #1826
