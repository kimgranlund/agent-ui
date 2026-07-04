import { globSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
// The live-agent dev proxy (LLD-C6): a DEV-ONLY (`apply: 'serve'`) middleware holding the provider key
// server-side. `vite build` never runs it (SPEC-R3/N2) — the static site ships the recorded backbone alone.
import { a2uiDevProxyPlugin } from './packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts'

// The /site app dev/build entry (slice A1) — Vite 8 is Rolldown-based, so bundler behaviour follows
// Rolldown-Vite. `root: 'site'` makes site/*.html the served/built HTML shells; the build emits to the
// repo-root `dist/` (gitignored).
//
// Deliberately NO `resolve.alias`: the `@agent-ui/*` workspace packages are symlinked under node_modules
// with `exports` maps, so Vite/Rolldown resolves every bare specifier — `@agent-ui/components/components`,
// the `*-styles.css` barrels, and the barrels' inner `@import '@agent-ui/shared/...'` — through those
// `exports` maps, exactly as `vitest.browser.config.ts` already proves. The index.ts aliases in
// `vitest.config.ts` map a bare name to a single `src/index.ts` file and would, under prefix-matching,
// rewrite the CSS/`./components` SUBPATHS into `.../src/index.ts/<subpath>` and break the build — so they
// are intentionally not mirrored here. This config stays zero-runtime-dep (Vite is the only build tool).
//
// MPA auto-discovery (wave-2 prep): every `site/**/*.html` becomes a Rollup build input, so a later page
// slice only adds its own `site/<name>.html` and never edits THIS file — keeping the A2/A3/A4 page builders
// file-disjoint (no multi-writer collision on the config). Vite's dev server already serves any html under
// `root` as its own MPA entry; this `input` map is what makes `vite build` emit every page too. The map
// keys become chunk names; each html's OUTPUT path mirrors its location under `root`, so `site/index.html`
// -> `dist/index.html` and `site/permutations.html` -> `dist/permutations.html`. The page set is derived
// purely from the filesystem — no `Date.now()`/`Math.random()` (unavailable in some config contexts).
const siteDir = fileURLToPath(new URL('./site', import.meta.url))
const input = Object.fromEntries(
  globSync('**/*.html', { cwd: siteDir }).map((page) => [
    page.replace(/\.html$/, '').replaceAll('/', '-'),
    resolve(siteDir, page),
  ]),
)

export default defineConfig({
  root: 'site',
  plugins: [a2uiDevProxyPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: { input },
  },
})
