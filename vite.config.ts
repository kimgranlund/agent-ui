import { defineConfig } from 'vite'

// The /site app dev/build entry (slice A1) — Vite 8 is Rolldown-based, so bundler behaviour follows
// Rolldown-Vite. `root: 'site'` makes site/index.html the served/built HTML shell; the build emits to the
// repo-root `dist/` (gitignored).
//
// Deliberately NO `resolve.alias`: the `@agent-ui/*` workspace packages are symlinked under node_modules
// with `exports` maps, so Vite/Rolldown resolves every bare specifier — `@agent-ui/components/components`,
// the `*-styles.css` barrels, and the barrels' inner `@import '@agent-ui/shared/...'` — through those
// `exports` maps, exactly as `vitest.browser.config.ts` already proves. The index.ts aliases in
// `vitest.config.ts` map a bare name to a single `src/index.ts` file and would, under prefix-matching,
// rewrite the CSS/`./components` SUBPATHS into `.../src/index.ts/<subpath>` and break the build — so they
// are intentionally not mirrored here. This config stays zero-runtime-dep (Vite is the only build tool).
export default defineConfig({
  root: 'site',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
