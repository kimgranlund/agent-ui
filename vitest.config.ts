import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.
// jsdom is the fast inner loop. The browser-truth layer (@vitest/browser + Playwright,
// for @scope / light-dark() / real focus / computed geometry / the AX tree) is a SEPARATE
// project — `vitest.browser.config.ts` / `npm run test:browser` (G5). The `*.browser.test.ts`
// glob is excluded here so those real-engine tests never run under jsdom (where computed
// geometry isn't true). Workspace packages resolve via the aliases below.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/agent-ui/*/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
  },
  resolve: {
    alias: {
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
      '@agent-ui/a2ui': r('./packages/agent-ui/a2ui/src/index.ts'),
    },
  },
})
