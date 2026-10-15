## Task goal
A keyless, deterministic way for agents and CI to boot the real agent-admin app in headless Chromium and drive Test Chat, the Builder (Co-pilot) chat, Settings, personas, teams and the error and abort paths from scripted fixtures, asserting on the DOM, A2UI surfaces, the turn timeline and persisted config. The live-model leg stays a separate manual, key-bearing run. Kim's request (2026-10-05): "closed loop testing flows for Test Chat, Builder Chat, Settings Pane, etc. so you can load them in chrome via Playwright and do whatever testing scenarios you need entirely headlessly". The A2UI system itself (renderer, catalogs, interaction, integration) is the sibling ticket T-0011.

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
