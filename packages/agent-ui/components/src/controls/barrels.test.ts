import { describe, it, expect } from 'vitest'
import * as componentsBarrel from './index.ts'
import { UIButtonElement } from './button/button.ts'
// Read package.json + the CSS barrels as text (vite strips `.css?raw`; no `@types/node` devDep — same
// approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync, existsSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s17 — the three barrels (ADR-0003) exist and are wired into the package exports:
//   • components        — the self-defining JS module barrel (controls/index.ts → `./components`)
//   • component-styles  — the per-component CSS barrel (component-styles.css → `./component-styles.css`)
//   • foundation-styles — the foundation CSS barrel (foundation-styles.css → `./foundation-styles.css`)
// The host page itself is Phase 2; here we prove the barrels + their wiring + the load-bearing CSS order.

const PKG = `${process.cwd()}/packages/agent-ui/components`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const read = (rel: string) => readFileSync(`${PKG}/${rel}`, 'utf8') as string

describe('components barrel — self-defines the ui-* family (s17)', () => {
  it('importing the barrel registers ui-button and re-exports its element class', () => {
    expect(customElements.get('ui-button')).toBe(UIButtonElement) // the self-define side effect ran on import
    expect(componentsBarrel.UIButtonElement).toBe(UIButtonElement) // the class is surfaced for typed references
  })

  it('is exported as `./components` and points at controls/index.ts', () => {
    expect(pkg.exports['./components']).toBe('./src/controls/index.ts')
    expect(existsSync(`${PKG}/${pkg.exports['./components']}`)).toBe(true)
  })
})

describe('CSS barrels — wired into exports + the load-bearing order (s17)', () => {
  it('`./component-styles.css` aggregates each control stylesheet (today: button.css)', () => {
    expect(pkg.exports['./component-styles.css']).toBe('./src/component-styles.css')
    const css = read('src/component-styles.css')
    expect(css).toContain("@import './controls/button/button.css'")
  })

  it('`./foundation-styles.css` aggregates @agent-ui/shared tokens FIRST, then dimensions', () => {
    expect(pkg.exports['./foundation-styles.css']).toBe('./src/foundation-styles.css')
    const css = read('src/foundation-styles.css')
    const tokensAt = css.indexOf("@import '@agent-ui/shared/tokens.css'")
    const dimsAt = css.indexOf("@import '@agent-ui/shared/dimensions.css'")
    expect(tokensAt).toBeGreaterThanOrEqual(0)
    expect(dimsAt).toBeGreaterThan(tokensAt) // tokens (colour) load before the dimensional ramp — ADR-0003
  })

  it('every export target resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })
})
