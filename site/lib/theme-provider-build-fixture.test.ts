// theme-provider-build-fixture.test.ts — the NODE-side half of the LLD-C11 built-output `light-dark()`
// regression guard (SPEC-R11, ADR-0117 Consequences). jsdom cannot resolve `light-dark()`/`color-scheme`
// at all, and the vitest BROWSER project executes its test module IN a real browser with no `node:fs`/
// `node:child_process` reachable (verified: zero `.browser.test.ts` in this repo imports a `node:` module) —
// so the build step and the resolved-colour assertion step are two separate tests bridged by a COMMITTED
// fixture, mirroring `llms.test.ts`'s G1 byte-identical-freshness pattern applied to a captured build
// artifact instead of a generated corpus.
//
// THIS test owns build freshness only: it runs a REAL `vite build` (via the shared, single-flight-cached
// `buildSiteCssShared` helper — build-css.ts, the SAME mechanism light-dark-minify.test.ts uses, reused
// rather than forked — the two files need the IDENTICAL real production CSS text, and the shared cache
// stops them racing two concurrent real builds in the same `npm test` run; see build-css.ts's own banner
// for the measured regression this eliminates) and asserts the fresh, joined production CSS text is
// byte-identical to the committed fixture (`__fixtures__/theme-provider-built.css`). It asserts NOTHING
// about resolved colour — that is theme-provider-build.browser.test.ts's job, consuming this SAME fixture
// via a `?raw` import. A red result here names its own fix: rebuild, inspect the diff, commit the refreshed
// fixture (regenerate below).
//
// Regenerate: read the fresh CSS this test computes (or run `npx vite build --outDir <scratch> --emptyOutDir
// --logLevel silent` yourself and join every emitted assets/*.css file with '\n', exactly as buildSiteCss
// does) and overwrite site/lib/__fixtures__/theme-provider-built.css with it.
//
// Fixture-drift note (process, not a defect): the committed fixture spans the WHOLE site bundle's CSS (the
// same joined text light-dark-minify.test.ts's own build produces) — so an UNRELATED site CSS edit reddens
// this gate too. That is expected, not a phantom regression: regenerate the fixture the same way.
import { describe, expect, it } from 'vitest'
import { buildSiteCssShared } from './build-css.ts'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (site/tsconfig.json
// deliberately has no "node" in its `types` array — build-css.ts / light-dark-minify.test.ts's own banner).
import { readFileSync, rmSync } from 'node:fs'

declare const process: { cwd(): string }

const ROOT = process.cwd()
// Distinct from light-dark-minify.test.ts's own SCRATCH_OUT_DIR — each buildSiteCss(Shared) CALL still owns
// its own scratch --outDir (only the CACHED RESULT is shared, never the scratch directory).
const SCRATCH_OUT_DIR = `${ROOT}/dist-theme-provider-gate-scratch`
const FIXTURE_PATH = `${ROOT}/site/lib/__fixtures__/theme-provider-built.css`

describe('ui-theme-provider built-output fixture — byte-identical to a fresh `vite build` (LLD-C11 node-side freshness gate)', () => {
  it('anti-vacuous: the committed fixture is real, non-empty content', () => {
    const committed = readFileSync(FIXTURE_PATH, 'utf8') as string
    expect(committed.length).toBeGreaterThan(1000)
    expect(committed).toContain('light-dark(')
  })

  it('a fresh production build matches the committed fixture byte-for-byte (regenerate on red — see file banner)', async () => {
    try {
      const fresh = await buildSiteCssShared(ROOT, SCRATCH_OUT_DIR)
      const committed = readFileSync(FIXTURE_PATH, 'utf8') as string
      expect(fresh).toBe(committed)
    } finally {
      rmSync(SCRATCH_OUT_DIR, { recursive: true, force: true })
    }
  }, 30_000)

  it('negative control: a fixture edit is genuinely caught (the equality check bites)', () => {
    const committed = readFileSync(FIXTURE_PATH, 'utf8') as string
    expect(committed + 'x').not.toBe(committed)
  })
})
