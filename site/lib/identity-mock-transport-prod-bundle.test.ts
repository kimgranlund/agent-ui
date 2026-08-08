// site/lib/identity-mock-transport-prod-bundle.test.ts — SPEC-R9 AC2's prod-bundle probe
// (.claude/docs/spec/identity-mock-transport.spec.md, GH #576). Today the DEV fence (a type-only import of
// identity-mock-transport.ts's TYPES plus a `import.meta.env.DEV`-gated dynamic `import()` of its VALUES,
// see credentials.ts/magic-link.ts/otp-signin.ts's own `wireIdentityDemo`) holds by construction — nothing
// reddens if a future edit breaks it. This gate makes that fence mechanically checkable: a REAL `vite build`
// (production mode, the same one `light-dark-minify.test.ts`/`theme-provider-build-fixture.test.ts` already
// trigger) followed by a page-agnostic grep for the mock transport's own symbols over EVERY emitted
// `assets/*.js` chunk — never a per-page probe, so a FUTURE identity slice's docs-site page (S3-f/S5-e-f)
// inherits this same coverage with no edit here (the GH #576 Scope note).
//
// Mechanism (reuse, not a second build): `buildSiteJsAssetsShared` (build-css.ts) — the SAME single-flight,
// source-mtime-freshness-cached real build `buildSiteCssShared` already triggers for the other two site
// tests, widened (GH #576) to also cache the built JS chunks. Calling it here does NOT cost a second real
// `vite build` per `npm test` run: whichever of the three test files' calls happens to run first performs
// the one real build and populates BOTH the CSS and JS caches; the other two find a fresh cache waiting
// (measured: suite duration is unchanged within the shared build's own noise — see the PR description).
// Own scratch --outDir, same as the other two callers (each caller owns its own scratch dir name so parallel
// callers cannot collide) — and, like every other real caller of this module, an ABSOLUTE path: Vite resolves
// a RELATIVE `--outDir` against its OWN configured `root` (`site/`, vite.config.ts), not the invoking
// process's cwd — a relative scratch dir here would land nested under `site/` instead of at the repo root
// this test expects, and a stale prior run's mismatched output can even fail the build outright (reproduced
// manually while building this gate). `ROOT`/`SCRATCH_OUT_DIR` below are both absolute for exactly this
// reason, mirroring build-css.ts's own `root`-must-be-absolute guard.
//
// Symbols picked — IN identity-mock-transport.ts and UNIQUE to it (verified: neither string appears in any
// OTHER site source file, including the three consuming pages' own DEV-gated call sites, which reach them
// only via property access / type-only import, never re-declare them):
//   - `createIdentityMockTransport` — the module's sole factory export; each consuming page's DEV branch
//     calls it as `overlay.createIdentityMockTransport()` on the dynamic import's namespace object, a
//     property-access identifier minifiers don't mangle by default — so if the DEV branch ever stopped being
//     eliminated, this exact identifier would survive into the bundle text unmangled.
//   - `IdentityMockError` — the closed error class (SPEC-R8); every consuming page reads a rejection's `.code`
//     structurally (`errorCodeOf`, an `instanceof Error` + `'code' in err` narrow) specifically so it never
//     has to import this class as a runtime value (each page's own comment: "WITHOUT importing the
//     `IdentityMockError` class as a runtime value") — so this symbol has NO legitimate reason to appear
//     anywhere outside identity-mock-transport.ts itself.
// Deliberately NOT used: `demo@agent-ui.dev`/`'account-exists'`/`'code-rate-limited'` and the other SPEC-R8
// error-code string literals — each is ALSO a literal the consuming pages' own source re-declares (comparing
// `code === 'account-exists'`, etc.) for their user-facing messaging, so grepping for them would find a hit
// in the production bundle regardless of whether identity-mock-transport.ts itself got tree-shaken — a
// vacuous probe that can never go green. Verified empirically (repo-wide grep) before picking the two above.
import { describe, expect, it } from 'vitest'
import { buildSiteJsAssetsShared } from './build-css.ts'
// @ts-expect-error - node:fs is typed via @types/node; vitest/node resolves it at runtime (site/tsconfig.json
// deliberately has no "node" in its `types` array — build-css.ts / light-dark-minify.test.ts's own banner).
import { readFileSync, rmSync } from 'node:fs'

declare const process: { cwd(): string }

const ROOT = process.cwd()
// Distinct from the other two buildSiteCss(Shared)/buildSiteJsAssetsShared callers' own scratch dirs — each
// CALL still owns its own scratch --outDir (only the CACHED RESULT is shared, never the scratch directory).
const SCRATCH_OUT_DIR = `${ROOT}/dist-identity-prod-bundle-gate-scratch`
const TRANSPORT_SOURCE_PATH = `${ROOT}/site/lib/identity-mock-transport.ts`

// The two symbols this gate polices — see the file banner for why these two, and why not the error-code
// string literals.
const TRANSPORT_SYMBOLS = ['createIdentityMockTransport', 'IdentityMockError'] as const

describe("identity-mock-transport's DEV fence — absent from every production JS chunk (SPEC-R9 AC2, GH #576)", () => {
  it('anti-vacuous: the dev-served module (its own source — Vite dev serves TS near-verbatim, unbundled/unminified) DOES carry both symbols', () => {
    const source = readFileSync(TRANSPORT_SOURCE_PATH, 'utf8') as string
    for (const symbol of TRANSPORT_SYMBOLS) {
      expect(source, `expected the dev-served module to contain ${symbol}`).toContain(symbol)
    }
  })

  it('a real production `vite build` emits ZERO chunks containing either symbol', async () => {
    try {
      const jsAssets = await buildSiteJsAssetsShared(ROOT, SCRATCH_OUT_DIR)
      const jsFiles = Object.keys(jsAssets)
      // Anti-vacuous half two: prove the grep is actually scanning something real, not an empty build.
      expect(jsFiles.length).toBeGreaterThan(0)

      const hits: { file: string; symbol: string }[] = []
      for (const file of jsFiles) {
        const text = jsAssets[file]
        for (const symbol of TRANSPORT_SYMBOLS) {
          if (text.includes(symbol)) hits.push({ file, symbol })
        }
      }
      expect(hits, 'the DEV fence leaked — identity-mock-transport symbols reached a production chunk').toEqual([])
    } finally {
      rmSync(SCRATCH_OUT_DIR, { recursive: true, force: true })
    }
  }, 30_000)
})
