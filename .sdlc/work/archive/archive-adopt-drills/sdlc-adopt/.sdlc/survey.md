# Survey: agent-ui

2026-09-20 · kim@sublimeheroics.com

## Languages

| Extension | Count |
|-----------|-------|
| svg       | 9242  |
| ts        | 8309  |
| js        | 3970  |
| md        | 3899  |
| html      | 1887  |
| css       | 1277  |
| json      | 1246  |
| png       | 629   |

## Manifests

| File | Command/Scripts |
|------|-----------------|
| `/package.json` | `dev`: vite · `build`: vite build · `check`: tsc && npm run check:site && npm run check:tools && npm run check:scripts · `check:site`: tsc -p site/tsconfig.json · `check:tools`: tsc -p tsconfig.tools.json · `check:scripts`: python3 scripts/adr_ratify_test.py && python3 scripts/hook_selftests.py && python3 scripts/claude_wiring_check.py && node scripts/reap-branches.mjs selftest && node scripts/reap-worktrees.mjs selftest && node scripts/reap-scratch-clones.mjs selftest && node scripts/bootstrap-scratch-clone.mjs selftest && node scripts/e2e-devtools.mjs selftest && node scripts/import-skill-pack.mjs selftest && node scripts/eval-catalog-gate.mjs selftest · `e2e:devtools`: node scripts/e2e-devtools.mjs · `test`: vitest run · `test:watch`: vitest · `test:browser`: npm run test:browser:packages && npm run test:browser:site && npm run test:browser:focus-timing && npm run test:visual && npm run test:eval-catalog · `test:browser:packages`: npm run test:browser:packages:components && npm run test:browser:packages:app && npm run test:browser:packages:rest · `test:browser:packages:components`: vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components · `test:browser:packages:app`: vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/app · `test:browser:packages:rest`: vitest run --config vitest.browser.config.ts --project packages-rest · `test:browser:site`: vitest run --config vitest.browser.config.ts --project site · `test:browser:focus-timing`: vitest run --config vitest.browser.config.ts --project focus-timing · `test:visual`: vitest run --config vitest.browser.config.ts --project visual · `test:visual:update`: vitest run --config vitest.browser.config.ts --project visual --update · `test:eval-catalog`: node scripts/eval-catalog-gate.mjs · `size`: node scripts/measure-size.mjs · `ops:reap-branches`: node scripts/reap-branches.mjs · `ops:reap-worktrees`: node scripts/reap-worktrees.mjs · `ops:reap-scratch-clones`: node scripts/reap-scratch-clones.mjs · `ops:bootstrap-scratch-clone`: node scripts/bootstrap-scratch-clone.mjs · `publish:packages`: node scripts/publish/publish-packages.mjs · `deploy:docs`: npm run build && wrangler deploy · `eval:catalog`: node scripts/eval-a2ui-catalog.mjs · `regen:theme-provider-fixture`: node --experimental-strip-types scripts/regen-theme-provider-fixture.ts · `regen:dogfood-assets`: node scripts/build-dogfood-assets.mjs · `eval:genui-corpus`: node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts |
| `/vite.config.ts` | Configuration for Vite build with dev proxies for a2ui, a2a feed, and devtools harness; MPA auto-discovery for site/*.html files |
| `/tsconfig.json` | TypeScript config for development with module/lib ES2023/DOM, bundler mode, @agent-ui/* package paths, strict linting (noUnusedLocals, erasableSyntaxOnly, etc) |
| `/tsconfig.build.json` | Extends tsconfig.json; enables real JS/.d.ts emit for publish-packages.mjs with rewriteRelativeImportExtensions |
| `/tsconfig.tools.json` | TypeScript config for tools/ directories with Node types added |
| `/package-lock.json` | npm lock file (135345 bytes) |
| `/site/tsconfig.json` | TypeScript config for site directory |

## Tests

Test runner: vitest

File count: 3656

Test command: npm test (runs `vitest run`)

## CI

| File | Job | Trigger |
|------|-----|---------|
| `.github/workflows/deploy-docs.yml` | `deploy` | Push to main, manual workflow_dispatch |
| `.github/workflows/consumer-smoke.yml` | `smoke` | Workflow completion (Publish packages), manual workflow_dispatch |
| `.github/workflows/publish.yml` | `publish` | Push tag matching v*, manual workflow_dispatch |
| `.github/workflows/theme-provider-fixture-regen.yml` | `regen` | Push to main (specific paths), manual workflow_dispatch |
| `.github/workflows/claude-code-review.yml` | `claude-review` | Pull request (opened, synchronize, ready_for_review, reopened) |
| `.github/workflows/ci.yml` | `check` | Pull request (opened, synchronize, ready_for_review, reopened) |

## Branches

| Branch | Pattern/Notes |
|--------|---------------|
| `main` | Default branch (from git config). Primary remote: `origin/main`. Only remote branch listed. |
| `sdlc/adopt` | Current local working branch. Pattern suggests feature/purpose prefix (SDLC-scoped). |

Findings:
- Default branch: `main` (from `git config init.defaultBranch`)
- Remote state: Minimal — only `origin/main` exists on remote
- Branch protection: No explicit protection rules mentioned in README or visible docs
- Local naming pattern: Prefix-based (`sdlc/…`), inferred from current branch; project CLAUDE.md references a branch-reap operation (`npm run ops:reap-branches`) suggesting active local branch management

## Harnesses

| Path | Size | Last Commit |
|------|------|-------------|
| `/CLAUDE.md` | 7.5K | 2026-08-30 |
| `/AGENTS.md` | not found | — |
| `.cursor*` files | none found | — |
| `.github/copilot*` files | none found | — |
| `./.claude/` | 12,282 files | 2026-09-07 |
| `./.claude/agents/` | 7 files | 2026-08-23 |
| `./.claude/docs/` | 731 files | 2026-09-05 |
| `./.claude/ops/` | 107 files | 2026-09-07 |
| `./.claude/skills/` | 98 files | 2026-08-30 |
| `./.claude/worktrees/` | 11,326 files | tracked, no commit date |
| `./.claude/settings.json` | 665B | 2026-08-21 |
| `./.codex/` | not found | — |
| Hooks (settings.json) | none configured | — |

## Documentation

| Doc Type | Count | Newest Date |
|----------|-------|-------------|
| README | 30 | Jul 17 2026 |
| CHANGELOG | 1 | Jul 12 2026 |
| ADR | 227 | Aug 21 2026 |
| PRD | 1 | Aug 23 2026 |
| RFC | 0 | N/A |
| Docs (all .md in .claude/docs/) | 585 | Sep  5 2026 |
| Wiki Exports | 0 | N/A |

## Authorship

| Signal | Count | % |
|--------|-------|---|
| Kim Granlund (human author, all commits) | 50 | 100% |
| Claude Fable 5 (Co-Authored-By) | 33 | 66% |
| Claude Sonnet 5 (Co-Authored-By) | 14 | 28% |
| Claude Fable 5.1 (Co-Authored-By) | 5 | 10% |
| GitHub squash email (noreply.github.com) | 26 | 52% |
| Personal email (gmail.com) | 24 | 48% |

Merge/Squash Pattern:
- Squash commits (single PR #): 36 commits (72%)
- Merge commits (two PR # in title): 14 commits (28%)

Key observations:
- All commits authored by Kim Granlund; zero dependabot or other bot authors
- Strong agent signal: 52/50 commits carry Co-Authored-By trailers (52% of commits have agent collaboration)
- Email split between GitHub-generated (squash) and personal indicates mixed merge strategy
- Default strategy is squash-to-main (72%) with fallback to merge commits (28%) on specific PRs
- Claude Fable 5 dominates (66% of agent collaborations), with Sonnet 5 as secondary (28%)

## Hygiene

| Issue Type | Found | Details |
|---|---|---|
| .env sample files | No | No `.env.example`, `.env.sample`, or similar template files found |
| Secrets patterns (API keys, passwords, tokens) | No | No tracked credentials found. One test file (`site/lib/plan-runner.test.ts`) contains fake AWS key pattern `AKIAABCDEFGHIJKLMNOP` in a credential sanitization test—this is intentional, not a leak |
| Large committed files (>1MB) | Yes | Two fixture/test asset files: `site/.fixture-scratch/assets/adr-index-iCys3X2H.js` (3.1 MB) and `site/lib/__fixtures__/theme-provider-built.css` (1.5 MB). Both tracked intentionally as test fixtures since 2026-08-17 |
| Generated directories committed | No | No `node_modules`, `dist`, `build`, or other generated folders tracked in git |
| .env file handling | Good | `.env` file exists but is properly listed in `.gitignore` line 32; not tracked in git |
| Untracked files with secrets | No | Working tree is clean; no uncommitted changes |

Summary: Repository hygiene is sound. The two large files are intentional test fixtures supporting the component preview system and design asset verification. All sensitive files are properly ignored.

## Claims to verify

| Claim | Command/Source | Verifier Check |
|-------|---|---|
| `npm check` passes on main | `npm run check` | Run on latest main, verify exit code 0 |
| `npm test` passes on main | `npm test` (vitest run) | Run on latest main, verify exit code 0 |
| `npm run test:browser` passes on main | `npm run test:browser` (six shards) | Run on latest main, verify exit code 0 |
| Build succeeds on main | `npm run build` | Run on latest main, verify exit code 0 |
| CI green on latest PR | `.github/workflows/ci.yml` job `check` | Verify latest PR workflow run status |
| Default branch is `main` | `git config init.defaultBranch` | Verify current branch strategy |
| Test runner is vitest | manifest inspection | Confirm vitest package.json script and config |
| Vite is the dev/build tool | manifest inspection | Confirm vite.config.ts and npm scripts |
| TypeScript strict mode enforced | `/tsconfig.json` | Verify erasableSyntaxOnly, verbatimModuleSyntax, noUnusedLocals |
| 227 ADRs exist | `.claude/docs/adr/` count | Verify all ADRs parse and link correctly |
| No secrets in tracked files | hygiene check (pending) | Verify no .env with values, no API keys, no credentials |
