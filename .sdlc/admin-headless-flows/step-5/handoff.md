## Task goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

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
