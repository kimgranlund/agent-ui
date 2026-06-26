import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Vitest is the behaviour runner; `tsc` (npm run check) stays the type gate.
// jsdom is the fast inner loop. The browser-truth layer (@vitest/browser + Playwright,
// for @scope / light-dark() / real focus / computed geometry / the AX tree) is added
// when FACE controls land (G5). Workspace packages resolve via the aliases below.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/agent-ui/*/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@agent-ui/components': r('./packages/agent-ui/components/src/index.ts'),
      '@agent-ui/shared': r('./packages/agent-ui/shared/src/index.ts'),
    },
  },
})
