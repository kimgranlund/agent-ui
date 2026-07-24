import { describe, it, expect } from 'vitest'
import { collectDeclaredTokenNames, readTokenMap } from './token-bridge.ts'

// token-bridge.test.ts — genui-surface.spec.md SPEC-R6, the jsdom leg. Names are discovered from the
// REAL CSSOM at runtime (document.styleSheets) — never bundled at build time (see token-bridge.ts's own
// banner for the earlier `?raw` design this replaced, and why). jsdom parses `<style>` text into real
// CSSOM, so a stylesheet actually present in the jsdom document IS discoverable here; the full
// cross-engine proof against the real foundation stylesheet + a live theme flip is a browser-gate-only
// leg (sandbox-frame.browser.test.ts).

describe('token-bridge — CSSOM name discovery (SPEC-R6)', () => {
  it('collectDeclaredTokenNames never throws on an empty document', () => {
    expect(() => collectDeclaredTokenNames()).not.toThrow()
  })

  it('discovers a --md-sys-* custom property declared in a real <style> tag', () => {
    const style = document.createElement('style')
    style.textContent = ':root { --md-sys-color-primary: #123456; --not-a-token: red; }'
    document.head.append(style)
    const names = collectDeclaredTokenNames()
    expect(names.has('--md-sys-color-primary')).toBe(true)
    expect(names.has('--not-a-token')).toBe(false)
    style.remove()
  })

  it('readTokenMap never throws against a real element, degrading to {} when nothing is declared', () => {
    const host = document.createElement('div')
    document.body.append(host)
    expect(() => readTokenMap(host)).not.toThrow()
    expect(typeof readTokenMap(host)).toBe('object')
    host.remove()
  })

  it('readTokenMap resolves a declared token to its live computed value', () => {
    const style = document.createElement('style')
    style.textContent = ':root { --md-sys-color-primary: rgb(1, 2, 3); }'
    document.head.append(style)
    const host = document.createElement('div')
    document.body.append(host)
    const map = readTokenMap(host)
    // jsdom's getComputedStyle prints an rgb() without spaces (`rgb(1,2,3)`); a real engine prints
    // `rgb(1, 2, 3)` (proven in the browser leg) — assert the RESOLVED CHANNELS, not the exact string.
    expect(map['--md-sys-color-primary']?.replace(/\s+/g, '')).toBe('rgb(1,2,3)')
    host.remove()
    style.remove()
  })
})
