// site/lib/light-dark-minify.test.ts — the standing gate for TKT-0002 (a production-minifier-only defect:
// `vite dev` and every existing test run un-minified, so nothing caught it). LightningCSS (`build.cssMinify`'s
// default) downlevels `light-dark()` into a `var(--lightningcss-light,…) var(--lightningcss-dark,…)` pair
// whenever its resolved browser targets predate native support — which Vite's own default `build.cssTarget`
// (Baseline Widely Available, ~chrome111) does. That pair resolves off `prefers-color-scheme` ONLY, silently
// discarding `<theme-provider scheme>`'s per-element `color-scheme` override (site/lib/theme-provider.ts).
// vite.config.ts now sets `css.lightningcss.exclude = Features.LightDark` so the minifier never touches it,
// regardless of `cssTarget`.
//
// Two-part gate, mirroring the repo's "deterministic check + negative control" convention:
//   1. REAL build (below): shells out to the real `vite build` CLI (against the repo's real vite.config.ts,
//      into a scratch --outDir, never the real `dist/`) and asserts the shipped CSS carries native
//      `light-dark(` and zero `--lightningcss-` rewrites — the literal acceptance criterion, not a proxy for
//      it. Shelled out (spawnSync) rather than imported as `vite`'s Node API: importing `vite`'s own .d.ts
//      pulls @types/node's AMBIENT module declarations into this whole project's type-check — site/tsconfig.json
//      deliberately excludes `"node"` from its `types` array (site is a browser-app project; see the
//      `@ts-expect-error` precedent on the node:fs imports below and in tokens-doc.test.ts) — and ambient
//      declarations are global, so that one import silently flips OTHER files' now-unnecessary
//      `@ts-expect-error` node:fs suppressions into `TS2578` errors project-wide (verified empirically:
//      importing `{ build } from 'vite'` here alone reproduced it in 7 unrelated site test files).
//   2. Negative control: calls lightningcss's OWN `transform()` directly, on a minimal `light-dark()` snippet,
//      under the same old-browser targets Vite's default `cssTarget` resolves to, but WITHOUT the `exclude`
//      flag — proving the downlevel is real and would fire by default, so part 1 passing is meaningful and
//      not vacuously true (e.g. because this lightningcss version never downlevels light-dark() at all).
//
// Real build cost ~1-3s (measured); acceptable once per `npm test` run for a defect this class of silent.
import { describe, expect, it } from 'vitest'
import { transform, Features } from 'lightningcss'
// @ts-expect-error - node:fs/node:child_process are typed via @types/node; vitest/node resolves them at
// runtime (tokens-doc.test.ts precedent for node:fs under this same jsdom project — site/tsconfig.json
// deliberately has no "node" in its `types` array, see the file banner above).
import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs'
// @ts-expect-error - see above
import { spawnSync } from 'node:child_process'

declare const process: { cwd(): string; platform: string }

const ROOT = process.cwd()
// os.tmpdir()/path.join() would need their own node: imports (same suppression, no functional problem) —
// avoided here only to keep this file's node: import surface minimal; a fixed scratch dir under the repo's
// own (gitignored) dist/ sibling is just as safe and easier to reason about for cleanup.
const SCRATCH_OUT_DIR = `${ROOT}/dist-tkt0002-gate-scratch`

describe('production CSS minification preserves light-dark() (TKT-0002)', () => {
  it('the real `vite build` output carries native light-dark() and zero --lightningcss- rewrites', () => {
    rmSync(SCRATCH_OUT_DIR, { recursive: true, force: true })
    try {
      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['vite', 'build', '--outDir', SCRATCH_OUT_DIR, '--emptyOutDir', '--logLevel', 'silent'],
        { cwd: ROOT, encoding: 'utf8' },
      )
      expect(result.status, `vite build failed:\n${result.stdout}\n${result.stderr}`).toBe(0)

      const assetsDir = `${SCRATCH_OUT_DIR}/assets`
      const cssFiles = readdirSync(assetsDir).filter((f: string) => f.endsWith('.css'))
      expect(cssFiles.length).toBeGreaterThan(0)

      const allCss = cssFiles.map((f: string) => readFileSync(`${assetsDir}/${f}`, 'utf8')).join('\n')
      expect(allCss).toContain('light-dark(')
      expect(allCss).not.toContain('--lightningcss-')
    } finally {
      rmSync(SCRATCH_OUT_DIR, { recursive: true, force: true })
    }
  }, 30_000)

  it('negative control: lightningcss DOES downlevel light-dark() under old targets when NOT excluded', () => {
    const code = new TextEncoder().encode(':root { --x: light-dark(#fff, #000); }')
    // chrome 111 — the version Vite's default (Baseline Widely Available) `cssTarget` resolves to; predates
    // light-dark() (needs chrome123+). Encoding per lightningcss's own browserslistToTargets.js: major<<16.
    const targets = { chrome: 111 << 16 }

    const withoutExclude = transform({ filename: 'control.css', code, targets, minify: true })
    expect(withoutExclude.code.toString()).toContain('--lightningcss-')

    const withExclude = transform({ filename: 'control.css', code, targets, minify: true, exclude: Features.LightDark })
    expect(withExclude.code.toString()).toContain('light-dark(')
    expect(withExclude.code.toString()).not.toContain('--lightningcss-')
  })
})
