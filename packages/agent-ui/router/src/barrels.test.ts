import { describe, it, expect } from 'vitest'
import * as barrel from './index.ts'
// Raw-text fs read — the same reverse-coupling pattern as layering.test.ts / components' barrels.test.ts.
import { readFileSync, existsSync } from 'node:fs'
declare const process: { cwd(): string }

// LLD-C10a — the barrel/subpaths integration slice (SPEC-R1). Two things to prove, mirroring the
// components package's own barrels.test.ts discipline (T4) scaled to this package's SHAPE: router has no
// per-control folder set or family barrel to bijection-check (LLD-C10 is explicit the elements live on
// their OWN named subpaths, not a `./controls/{name}` fan-out) — so the drift surface here is smaller:
//   (a) the exports map's targets all resolve to real files
//   (b) the `.` barrel exports ONLY the headless core + types — NEVER the element classes (SPEC-R1 AC3)
//   (c) each element subpath, imported on its own, self-defines its custom element (the pure-core +
//       subpath pattern actually works end to end, not just "the exports map points somewhere")

const PKG = `${process.cwd()}/packages/agent-ui/router`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8') as string) as { exports: Record<string, string> }
const barrelSrc = readFileSync(`${PKG}/src/index.ts`, 'utf8') as string

describe('package.json exports map — every target resolves to a real file (LLD-C10a)', () => {
  it('anti-vacuous: the exports map has a non-trivial entry set', () => {
    expect(Object.keys(pkg.exports).length).toBeGreaterThanOrEqual(4)
  })

  it('the four documented entries are present with their LLD-C1-pinned targets', () => {
    expect(pkg.exports['.']).toBe('./src/index.ts')
    expect(pkg.exports['./router-outlet']).toBe('./src/controls/router-outlet/router-outlet.ts')
    expect(pkg.exports['./router-link']).toBe('./src/controls/router-link/router-link.ts')
    expect(pkg.exports['./router-link.css']).toBe('./src/controls/router-link/router-link.css')
  })

  it('every export target resolves to a real file', () => {
    for (const target of Object.values(pkg.exports)) {
      expect(existsSync(`${PKG}/${target}`), `missing export target: ${target}`).toBe(true)
    }
  })

  it('a planted export pointing at a non-existent file fails the file-existence check (negative control)', () => {
    const planted = { ...pkg.exports, './phantom': './src/phantom.ts' }
    const missing = Object.values(planted).filter((t) => !existsSync(`${PKG}/${t}`))
    expect(missing).toEqual(['./src/phantom.ts'])
  })
})

describe('the `.` barrel exports the headless core ONLY — never the elements (SPEC-R1 AC3)', () => {
  it('surfaces createRouter and connectUrl', () => {
    expect(typeof barrel.createRouter).toBe('function')
    expect(typeof barrel.connectUrl).toBe('function')
  })

  it('does NOT surface either element class (grep the source text — a type-only import cannot leak a runtime binding, but this catches a future value re-export directly)', () => {
    expect(barrelSrc).not.toMatch(/UIRouterOutletElement/)
    expect(barrelSrc).not.toMatch(/UIRouterLinkElement/)
    expect(barrelSrc).not.toMatch(/controls\/router-outlet/)
    expect(barrelSrc).not.toMatch(/controls\/router-link/)
  })

  it('importing the barrel does NOT register either custom element (the tree-shake contract, functionally)', () => {
    expect(customElements.get('ui-router-outlet')).toBeUndefined()
    expect(customElements.get('ui-router-link')).toBeUndefined()
  })

  it('a planted element re-export would be CAUGHT by the grep above (negative control)', () => {
    const planted = `${barrelSrc}\nexport { UIRouterOutletElement } from './controls/router-outlet/router-outlet.ts'\n`
    expect(planted).toMatch(/UIRouterOutletElement/)
  })
})

describe('each element subpath self-defines its own custom element when imported standalone (LLD-C1)', () => {
  it('./router-outlet registers ui-router-outlet', async () => {
    const mod = await import('./controls/router-outlet/router-outlet.ts')
    expect(customElements.get('ui-router-outlet')).toBe(mod.UIRouterOutletElement)
  })

  it('./router-link registers ui-router-link', async () => {
    const mod = await import('./controls/router-link/router-link.ts')
    expect(customElements.get('ui-router-link')).toBe(mod.UIRouterLinkElement)
  })
})
