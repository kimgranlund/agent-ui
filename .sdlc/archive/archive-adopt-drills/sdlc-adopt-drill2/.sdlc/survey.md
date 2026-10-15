# A1: Repository Survey

Survey date: 2026-09-20

## Languages

| Extension | Count |
|-----------|-------|
| svg       | 9242  |
| ts        | 8309  |
| js        | 3964  |
| md        | 3899  |
| html      | 1882  |
| css       | 1275  |
| json      | 1246  |
| png       | 629   |

## Manifests

| File | Path | Key Scripts/Commands |
|------|------|---------------------|
| **package.json** | `/packages/agent-ui/` | `dev`, `build`, `check` (tsc + check:site + check:tools + check:scripts), `test`, `test:watch`, `test:browser` (6 sequential vitest shards), `test:eval-catalog`, `e2e:devtools`, `ops:reap-worktrees`, `ops:reap-branches`, `ops:reap-scratch-clones`, `ops:bootstrap-scratch-clone`, `publish:packages`, `deploy:docs` (build + wrangler deploy), `eval:catalog`, `regen:theme-provider-fixture`, `regen:dogfood-assets` |
| **vite.config.ts** | `./vite.config.ts` | **Build config**: `root: 'site'`, `outDir: '../dist'`, `plugins: [a2uiDevProxyPlugin, a2aDevProxyPlugin, a2aFeedDevProxyPlugin, devtoolsHarnessPlugin]`, MPA auto-discovery via glob, rollupOptions with dynamic input map, CSS minification via LightningCSS with `light-dark()` excluded |
| **vitest.config.ts** | `./vitest.config.ts` | **Test config**: `environment: 'jsdom'`, `projects: [packages, site]`, worktree-aware worker cap (4 workers in `.claude/worktrees/`, default otherwise), resolve aliases for `@agent-ui/*` packages, excludes `*.browser.test.ts` from jsdom projects |
| **vitest.browser.config.ts** | `./vitest.browser.config.ts` | **Browser test config**: Real-engine testing via @vitest/browser + Playwright, split projects for packages, app, rest, site, focus-timing, visual |
| **tsconfig.json** | `./tsconfig.json` | **Type checking**: target `es2023`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit: true`, strict flags (erasableSyntaxOnly, noUnusedLocals, noFallthroughCasesInSwitch), `paths` aliases for `@agent-ui/*` workspace packages |
| **site/tsconfig.json** | `./site/tsconfig.json` | **Site type gate**: Extends root tsconfig, `lib: [\"ESNext\", \"DOM\", \"DOM.Iterable\"]`, `include: [\"**/*.ts\"]` for all site code and modules |
| **tsconfig.tools.json** | `./tsconfig.tools.json` | **Tools type gate**: Extends root tsconfig, adds `types: [\"node\"]` for CLI tools, `include: [\"packages/agent-ui/*/tools\"]` for Node-side CLIs and dev harnesses |
| **package-lock.json** | `./package-lock.json` | Lock file version 3 (npm v9+), pins exact versions of dependencies: typescript ~6.0.2, vite ^8.1.0, vitest ^4.1.9, playwright ^1.61.1, wrangler ^4.112.0, lightningcss ^1.32.0, and dev dependencies |

## Tests

Test runner: Vitest
Test file count: 3447
Test command: npm test

## CI

| File | Job | Trigger |
|------|-----|---------|
| `.github/workflows/ci.yml` | check, claude-review | PR: opened, synchronize, ready_for_review, reopened |
| `.github/workflows/deploy.yml` | deploy | Main branch push |
| `.github/workflows/regen.yml` | regen | Main branch push |
| `.github/workflows/publish.yml` | publish | Tag push |
| `.github/workflows/smoke.yml` | smoke | After publish succeeds |
| All workflows | All jobs | Manual dispatch (workflow_dispatch) |

## Branches

| Branch | Pattern | Protection hints |
|--------|---------|------------------|
| **main** | `origin/main` | **Required checks:** `npm run check` (tsc + check:site + check:tools + check:scripts) + `npm test` (jsdom). **PR triggers:** opened, synchronize, ready_for_review, reopened. **Local gate:** `npm run test:browser` (six-shard real-engine) runs locally only, not in CI. **Docs-only carve-out:** gate on `doc_lint` + `npm run check`. **Gate-verdicts:** Vitest reports by exit code; CI workflow at `.github/workflows/ci.yml` is the mechanical backstop. No dismissal requests configured. |

**Summary:** Repository has one default branch (`main`). CI workflow requires deterministic passing of standing gate (`check` + `test`) on every PR. The six-shard browser test suite is deliberately kept local per CLAUDE.md architecture decision (no `test:browser` in CI). Docs-only diffs bypass `npm test` locally but remain gated in CI.

## Harnesses

| File | Size | Last Commit Date |
|------|------|------------------|
| CLAUDE.md | 7.5 KB | 2026-08-30 |
| .claude/settings.json | - | (tracked) |
| .claude/doctrine/ | - | 2026-08-20 to 2026-08-21 |
| .claude/agents/ | 6 files | 2026-08-20 to 2026-08-23 |
| .claude/docs/ | 15 MB | 2026-09-05 (newest SPEC) |
| AGENTS.md | Absent | - |
| .cursor* | Absent | - |
| .github/copilot* | Absent | - |
| .codex/ | Absent | - |
| hooks.json | Absent | - |

## Documentation

| Category | Count | Newest Date |
|----------|-------|-------------|
| ADR | 227 | 2026-08-30 |
| SPEC | 50 | 2026-09-05 |
| PRD | 15 | 2026-09-04 |
| RDD | 1 | - |
| Total | 585 | 2026-09-05 |

## Authorship (Last 50 Commits)

| Type | Count | Ratio |
|------|-------|-------|
| Agent-authored | 37 | 74% (Fable 5/5.1 early, then Sonnet 5 later) |
| Human-authored | 13 | 26% |
| Merge commits | 14 | 28% |
| Squash commits | 36 | 72% |

## Hygiene

| Category | Finding | Status |
|----------|---------|--------|
| Environment files | `.env` present in repo root | 🟢 Properly ignored in .gitignore, not tracked by git |
| Environment samples | No `.env.example` or `.env.sample` files | 🟢 No sample files needed; `.env` is excluded |
| Secrets/passwords | Grep patterns (secret, password, key, token) in tracked files | 🟢 All matches are design-token artifacts, not credentials |
| Large files | Files >10MB (excluding node_modules, .git) | 🟢 None found |
| Generated directories | `node_modules` (415M) | 🟢 Ignored in .gitignore |
| Generated directories | `dist` (14M) | 🟢 Ignored in .gitignore |
| Generated directories | `.publish` (10M) | 🟢 Ignored in .gitignore |
| Generated directories | `.vitest-attachments` (2.6M) | 🟢 Ignored in .gitignore |
| Generated directories | `screenshots` (296K) | 🟢 Ignored in .gitignore |
| Generated directories | `.sdlc/runtime` (8.0K) | 🟢 Ignored in .gitignore |

**Summary:** Repository hygiene is clean. The `.env` file exists with restricted permissions and is properly gitignored. All generated build artifacts and test output directories are present and correctly ignored. No environment sample files are needed, and no secrets are tracked.

## Claims to Verify

The following commands and statements will be relied upon by later adoption steps:

| Claim | Source | Verification needed |
|-------|--------|---------------------|
| `npm run check` passes deterministically | package.json, CLAUDE.md | Run on main three times (A4 baseline) |
| `npm test` passes deterministically | package.json, CLAUDE.md | Run on main three times (A4 baseline) |
| `npm run test:browser` runs locally only | CLAUDE.md, CI config | Confirm no `test:browser` in CI workflows |
| TypeScript strict mode enabled | tsconfig.json | Verify `tsc` passes with noEmit on all source |
| 3447 test files present with Vitest runner | Scout report | Confirm test file count and runner in package.json |
| Vite build succeeds for site/ MPA | vite.config.ts, package.json build script | Run `npm run build` on main |
| All generated directories ignored | .gitignore, scout report | Verify node_modules, dist, .publish, etc. are not tracked |
| No secrets tracked | Scout hygiene report | Grep verified; no .env.* files tracked |
| CI requires `check` + `test` on PRs | .github/workflows/ci.yml | Confirm PR check runs both gates |
| Main branch is protected | Branch protection hints | Verify branch rules in GitHub settings |
| 585 documentation files current | Scout report | Newest SPEC Sep 5; verify freshness against git log |
| 37 of 50 recent commits agent-authored | Authorship scout | Identify trailers and bot signals in git log |

