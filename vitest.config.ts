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
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),
    },
  },
})
