// scripts/regen-theme-provider-fixture.ts, regen-on-main mechanism for the LLD-C11 committed fixture
// (GH #1599, Kim ruling 2026-08-23). `theme-provider-build-fixture.test.ts` used to be the freshness
// check itself, redding PR CI on any unrelated `ui-*` CSS change (drifted three times in one weekend:
// #1596 -> #1590/#1597 -> #1598): a fleet-rules §4 "reproducible from source" derived artifact belongs
// to regen-on-main, not to a PR-blocking byte check. This script is that regen: run `buildSiteCssShared`
// (site/lib/build-css.ts, the SAME real-build helper the test and light-dark-minify.test.ts already
// share) and overwrite the committed fixture when it drifted.
//
// CLI run: `node --experimental-strip-types scripts/regen-theme-provider-fixture.ts` (repo root cwd,
// `npm run regen:theme-provider-fixture`). Never set `NODE_ENV` in the invoking shell: `build-css.ts`
// forces `NODE_ENV=production` for its own spawned `vite build` subprocess only; an outer `NODE_ENV`
// leaks into THIS process and (per build-css.ts's own GH #576 banner) breaks module resolution for the
// unrelated tooling that may run alongside it in CI.
//
// Exit code is a crash/no-crash signal only, never a drift signal: 0 on a completed run whether the
// fixture was already fresh or genuinely rewritten, non-zero only when the real build itself throws
// (a broken source tree, not drift). The calling workflow decides whether anything changed by diffing
// the working tree afterward (git status / peter-evans/create-pull-request's own no-op-on-clean-tree
// behavior), never by reading this exit code, so a real build failure still reds the workflow step
// instead of silently masquerading as "nothing to commit".
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { buildSiteCssShared } from '../site/lib/build-css.ts'

const ROOT = process.cwd()
const FIXTURE_PATH = `${ROOT}/site/lib/__fixtures__/theme-provider-built.css`
const SCRATCH_OUT_DIR = `${ROOT}/dist-theme-provider-gate-scratch`

async function main(): Promise<void> {
  try {
    const fresh = await buildSiteCssShared(ROOT, SCRATCH_OUT_DIR)
    const committed = readFileSync(FIXTURE_PATH, 'utf8')
    if (fresh === committed) {
      console.log('regen-theme-provider-fixture: already fresh, no write')
      return
    }
    writeFileSync(FIXTURE_PATH, fresh)
    console.log(`regen-theme-provider-fixture: fixture drifted, wrote ${fresh.length} B to ${FIXTURE_PATH}`)
  } finally {
    rmSync(SCRATCH_OUT_DIR, { recursive: true, force: true })
  }
}

if (process.argv[1]?.endsWith('regen-theme-provider-fixture.ts')) {
  // No .catch(): a real build failure should surface as an unhandled rejection and a non-zero exit,
  // never be swallowed here.
  main()
}
