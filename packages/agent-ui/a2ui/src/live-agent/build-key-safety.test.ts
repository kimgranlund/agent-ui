// build-key-safety.test.ts — LLD-C8c / SPEC-N2: the standing SOURCE-LEVEL gate closing the `VITE_`
// footgun. It asserts (1) the page reaches the live overlay ONLY via a dev-only dynamic import
// (`import.meta.env.DEV`), never a static top-level import, so `vite build` tree-shakes it out; (2) no
// `import.meta.env.VITE_*` reference sits in the site import graph (the proxy path is process.env-side;
// the deferred browser-direct arm is the only VITE_ consumer and is not built); and (3) no key literal
// appears in any committed live-agent source file. The build-LEVEL leg (grep `dist/` for keys) is MANUAL
// (the `npm run size` precedent) — run after touching the overlay wiring; NOT in CI (no build gate).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

declare const process: { cwd(): string }
const ROOT = process.cwd()
const read = (rel: string): string => readFileSync(`${ROOT}/${rel}`, 'utf8') as string

// Strip comments so a doc-comment that DISCUSSES `import.meta.env.VITE_*` (the design deliberately does)
// is not mistaken for a real VITE_ key READ in code. (Safe for these files — none embed `//` in a string.)
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const PAGE = 'site/pages/a2ui-live.ts'
const OVERLAY_FILES = ['site/lib/live-proxy-transport.ts', 'site/lib/provider-switcher.ts']
const LIVE_AGENT_SOURCE = [
  PAGE,
  'site/lib/agent-runtime.ts',
  ...OVERLAY_FILES,
  'packages/agent-ui/a2ui/tools/agent/providers.json',
  'packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts',
  'packages/agent-ui/a2ui/src/agent/providers/anthropic.ts',
]

describe('build-key-safety (LLD-C8c / SPEC-N2)', () => {
  it('the page reaches the live overlay ONLY via a dev-only dynamic import (tree-shaken from the build)', () => {
    const page = read(PAGE)
    // No STATIC top-level import of the overlay modules.
    expect(page).not.toMatch(/^\s*import[^\n]*live-proxy-transport/m)
    expect(page).not.toMatch(/^\s*import[^\n]*provider-switcher/m)
    // The overlay is dynamically imported, behind an import.meta.env.DEV guard.
    expect(page).toContain("import('../lib/live-proxy-transport.ts')")
    expect(page).toContain('import.meta.env.DEV')
  })

  it('no import.meta.env.VITE_* reference sits in the site import graph', () => {
    // The proxy default is process.env-side; the deferred browser-direct arm (the only VITE_ consumer) is
    // not built. If a future arm adds one, it MUST be dev-only-guarded and this gate tightens to check that.
    for (const f of [PAGE, 'site/lib/agent-runtime.ts', ...OVERLAY_FILES]) {
      expect(stripComments(read(f))).not.toContain('import.meta.env.VITE_')
    }
  })

  it('no key literal appears in any committed live-agent source file', () => {
    for (const f of LIVE_AGENT_SOURCE) {
      const text = read(f)
      expect(text).not.toMatch(/sk-[A-Za-z0-9]{16,}/) // OpenAI / Anthropic secret-key prefix
      expect(text).not.toMatch(/AIza[A-Za-z0-9]{16,}/) // Google API-key prefix
    }
  })
})
