import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.
// jsdom is the fast inner loop, split into two vitest PROJECTS (the `test.projects` array — vitest 4's inline
// replacement for the deprecated `vitest.workspace.ts`): `packages` (the framework's own *.test.ts) and `site`
// (the docs-site's own *.test.ts, e.g. site/lib/adr.ts). Both `extends: true` off this root config, inheriting
// the jsdom environment + the resolve aliases below. The browser-truth layer (@vitest/browser + Playwright, for
// @scope / light-dark() / real focus / computed geometry / the AX tree) is a SEPARATE config —
// `vitest.browser.config.ts` / `npm run test:browser` (G5), itself split the same way. The `*.browser.test.ts`
// glob is excluded from both jsdom projects so those real-engine tests never run under jsdom (where computed
// geometry isn't true). Workspace packages resolve via the aliases below.
export default defineConfig({
  test: {
    environment: 'jsdom',
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: ['packages/agent-ui/*/src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      // More-specific subpaths FIRST (string aliases prefix-match in order): the controls barrel —
      // `@agent-ui/components/components` mirrors the package's `exports["./components"]` (the self-defining
      // ui-* family). Without it, the broad alias below mangles the subpath and a2ui tests can't load a
      // real control (e.g. the default catalog's ui-button factory).
      '@agent-ui/components/components': r('./packages/agent-ui/components/src/controls/index.ts'),
      '@agent-ui/components/descriptor': r('./packages/agent-ui/components/src/descriptor/index.ts'),
      // EXACT (not prefix) matches, `?url`-suffixed: `@agent-ui/app`'s isolated-shell connect-flow
      // (app-shell.ts, LLD-C5/ADR-0082) resolves these two package CSS assets to a real runtime URL via
      // Vite's `?url` suffix, to inject as `<link>` hrefs INSIDE a shadow root. Vite's aliasing is FIRST-
      // MATCH-WINS in array order, and a plain-string alias matches on a whole path segment (`importee ===
      // find || importee.startsWith(find + '/')`) — `@agent-ui/components/foundation-styles.css?url` DOES
      // start with the broad `@agent-ui/components` alias below, so without these two exact entries placed
      // BEFORE it, that broad alias would intercept the specifier first and mangle the `?url` suffix into its
      // replacement path. Placing the exact, query-suffixed entries earlier in this object is what makes them
      // win instead (the replacement carries the SAME `?url` suffix through, so Vite's own asset-URL
      // transform still recognizes it) — the same ordering discipline the `@agent-ui/components/components`
      // and `/descriptor` subpath entries above already rely on.
      '@agent-ui/components/foundation-styles.css?url': `${r('./packages/agent-ui/components/src/foundation-styles.css')}?url`,
      '@agent-ui/components/component-styles.css?url': `${r('./packages/agent-ui/components/src/component-styles.css')}?url`,
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),
    },
  },
})
