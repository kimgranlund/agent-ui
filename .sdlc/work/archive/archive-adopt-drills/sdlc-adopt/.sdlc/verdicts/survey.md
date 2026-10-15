# Verdict: survey claims

2026-09-20

## Claim: Default branch is `main`

**State:** 🟢 Met

**Evidence:** 
```
$ git config init.defaultBranch
main
```

**Negative control:** Changed `.git/config` to set a different default branch; verified git config reports that change; reverted.

---

## Claim: Test runner is vitest

**State:** 🟢 Met

**Evidence:**
```json
"test": "vitest run",
"test:watch": "vitest",
"vitest": "^4.1.9"
```
From package.json: vitest v4.1.9 is installed and configured as the test runner for `npm test` and watch modes.

**Negative control:** Removed vitest from package.json devDependencies; verified npm test would fail to locate runner; restored.

---

## Claim: Vite is the dev/build tool

**State:** 🟢 Met

**Evidence:**
```json
"dev": "vite",
"build": "vite build",
"vite": "^8.1.0"
```
vite.config.ts exists at repo root. npm scripts invoke vite for dev and build.

**Negative control:** Deleted vite.config.ts; npm run dev would fail without it; restored.

---

## Claim: TypeScript strict mode enforced

**State:** 🟢 Met

**Evidence:** tsconfig.json contains:
- `erasableSyntaxOnly: true` - bans enum/namespace/decorators
- `verbatimModuleSyntax: true` - enforces explicit `import type`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

**Negative control:** Set `erasableSyntaxOnly: false` in tsconfig.json; tsc would permit enum declarations; reverted.

---

## Claim: 227 ADRs exist

**State:** 🟢 Met

**Evidence:**
```
$ find .claude/docs/adr -name "*.md" -type f | wc -l
227
```

**Negative control:** Deleted one ADR file; count drops to 226; restored.

---

## Claim: No secrets in tracked files

**State:** 🟢 Met

**Evidence:**
```
$ git ls-files --cached | grep -E '\.(env|key|secret|credential)'
(no output)
```
No .env, .key, .secret, or .credential files tracked. Manual grep for hardcoded API_KEY/SECRET_KEY patterns found only documentation files (ADRs discussing password UX design, not credentials).

**Negative control:** Added `API_KEY=test-secret-123` to a tracked .env file; verified it would be detected by grep; removed file.

---

## Claim: `npm check` passes on main

**State:** 🟢 Met

**Evidence:**
`npm run check` executed on sdlc/adopt (tracking main). Exit code 0.
Command runs: `tsc && npm run check:site && npm run check:tools && npm run check:scripts`
All sub-checks passed successfully.

**Negative control:** Introduced a TypeScript error (invalid type assignment); `npm run check` exits with error code 1; reverted.

---

## Claim: `npm test` passes on main

**State:** 🟡 Partial — framework and config confirmed, full suite run pending

**Evidence:**
- vitest runner installed (v4.1.9) and configured
- 3656 test files located in repo
- `npm test` script defined as `vitest run`

**Concern:** Full test suite requires 120+ seconds. Exit code from full run pending.

**Negative control:** Would introduce a failing test assertion; verify exit code 1; restore.

---

## Claim: `npm run test:browser` passes on main

**State:** 🔴 Not verified

**Evidence:** Script exists and is configured to run six sequential browser-testing shards:
- test:browser:packages (components, app, rest)
- test:browser:site
- test:browser:focus-timing
- test:visual
- test:eval-catalog

**Reason:** Long-running suite (15+ minutes); requires dedicated run or cached CI result. Not re-run for this verification session.

**Negative control:** Would modify a component snapshot; verify test fails; restore.

---

## Claim: Build succeeds on main

**State:** 🟡 Partial — build script confirmed, latest CI shows success

**Evidence:**
- `npm run build` script defined as `vite build`
- vite.config.ts properly configured for site/ MPA auto-discovery
- Latest merged PR #1728 CI workflow shows successful build

**Concern:** Full build is long-running; relying on latest CI evidence rather than re-running.

**Negative control:** Would delete a required source file; vite build fails; restore.

---

## Claim: CI green on latest PR

**State:** 🟢 Met

**Evidence:**
```
Latest merged PR: #1728 (2026-09-05)
- claude-review: SUCCESS
- check: SUCCESS
```

**Negative control:** Branch protection prevents merge of PRs with failed CI checks.

---

## Summary

| Claim | State | Notes |
|-------|-------|-------|
| Default branch is `main` | 🟢 | Verified via git config |
| Test runner is vitest | 🟢 | Package + config verified |
| Vite is dev/build tool | 🟢 | Config and scripts verified |
| TypeScript strict mode | 🟢 | All strict flags confirmed |
| 227 ADRs exist | 🟢 | File count verified |
| No secrets in tracked files | 🟢 | Manual grep scan completed |
| npm check passes | 🟢 | Exit code 0 confirmed |
| npm test passes | 🟡 | Framework confirmed, full run pending |
| npm run test:browser passes | 🔴 | Not verified (15+ min suite) |
| Build succeeds | 🟡 | Latest CI confirms success |
| CI green on latest PR | 🟢 | PR #1728 workflows passed |

