import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// The browser-truth runner (decomp s12) — a SEPARATE vitest config from the jsdom inner loop
// (`vitest.config.ts`). Real engines (Playwright-driven Chromium + WebKit) are where @scope, the
// dimensional ramp, real computed geometry and the AX tree are actually true; jsdom can't resolve them.
// Run with `npm run test:browser`. Split into two vitest PROJECTS (the `test.projects` array — vitest 4's
// inline replacement for `vitest.workspace.ts`): `packages` (the framework's own *.browser.test.ts) and
// `site` (the docs-site's own *.browser.test.ts, e.g. site/lib/component-preview.browser.test.ts). Both
// `extends: true` off this root config, inheriting the browser instances below (the jsdom config excludes
// the `*.browser.test.ts` glob entirely, so the two suites never collide). No resolve aliases: the workspace
// packages are symlinked under node_modules and Vite resolves the bare `@agent-ui/*` specifiers (incl. the
// `./components` + CSS subpaths, and the barrels' inner `@import '@agent-ui/shared/...'`) through their
// package `exports` map. vitest 4.1 takes the provider as a factory from `@vitest/browser-playwright`
// (no longer a string).
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'packages',
          include: ['packages/agent-ui/*/src/**/*.browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'site',
          include: ['site/**/*.browser.test.ts'],
        },
      },
    ],
  },
})
