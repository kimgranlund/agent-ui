import { describe, it, expect } from 'vitest'
import { BOOTSTRAP_SCRIPT, buildSrcdoc } from './bootstrap.ts'

// bootstrap.test.ts — genui-surface.spec.md SPEC-R5 "build" ordering (jsdom-testable: DOMParser exists
// in both jsdom and every real engine — the LIVE bootstrap/postMessage behavior is a browser-gate-only
// proof, sandbox-frame.browser.test.ts).

describe('buildSrcdoc — the composed document ordering (SPEC-R5 build)', () => {
  const html = '<!DOCTYPE html><html><head><script>window.modelRan = true</script></head><body>hi</body></html>'
  const tokens = { '--md-sys-color-primary': '#123456' }

  it('composes a document carrying the CSP meta, the token style, and the bootstrap script', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light')!
    expect(srcdoc).toBeDefined()
    expect(srcdoc.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(srcdoc).toContain('http-equiv="Content-Security-Policy"')
    expect(srcdoc).toContain("default-src 'none'")
    expect(srcdoc).toContain('--md-sys-color-primary: #123456')
    expect(srcdoc).toContain('color-scheme: light')
    expect(srcdoc).toContain('window.genui')
  })

  it('inserts CSP meta BEFORE the token style, which is BEFORE the bootstrap script, which is BEFORE the model script (SPEC-R5 ordering guarantee)', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light')!
    const cspAt = srcdoc.indexOf('Content-Security-Policy')
    const styleAt = srcdoc.indexOf('--md-sys-color-primary')
    const bootstrapAt = srcdoc.indexOf('window.genui')
    const modelAt = srcdoc.indexOf('window.modelRan')
    expect(cspAt).toBeGreaterThan(-1)
    expect(styleAt).toBeGreaterThan(cspAt)
    expect(bootstrapAt).toBeGreaterThan(styleAt)
    expect(modelAt).toBeGreaterThan(bootstrapAt)
  })

  it('handles a model document with NO explicit <head> (DOMParser synthesizes one)', () => {
    const bare = '<body><p>no head at all</p></body>'
    const srcdoc = buildSrcdoc(bare, "default-src 'none'", {}, 'dark')!
    expect(srcdoc).toContain('http-equiv="Content-Security-Policy"')
    expect(srcdoc).toContain('window.genui')
    expect(srcdoc).toContain('no head at all')
  })

  it('handles a model document with NO <html>/<head> wrapper at all (a bare fragment)', () => {
    const fragment = '<h1>Just a fragment</h1>'
    const srcdoc = buildSrcdoc(fragment, "default-src 'none'", {}, 'light')!
    expect(srcdoc).toContain('Just a fragment')
    expect(srcdoc).toContain('window.genui')
  })

  it('composes an empty token map to a bare color-scheme-only style block (no throw)', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", {}, 'light')!
    expect(srcdoc).toContain('color-scheme: light')
  })
})

describe('buildSrcdoc — SPEC-R12 dogfood asset injection (GH #316/ADR-0162, LLD-C2)', () => {
  const html = '<!DOCTYPE html><html><head><script>window.modelRan = true</script></head><body>hi</body></html>'
  const tokens = { '--md-sys-color-primary': '#123456' }

  it('an absent `assets` argument composes a srcdoc BYTE-IDENTICAL to omitting it entirely (regression pin)', () => {
    const withoutArg = buildSrcdoc(html, "default-src 'none'", tokens, 'light')!
    const withUndefined = buildSrcdoc(html, "default-src 'none'", tokens, 'light', undefined)!
    expect(withUndefined).toBe(withoutArg)
  })

  it('`{}` (both fields absent) composes a srcdoc BYTE-IDENTICAL to the no-assets path (mode-off law)', () => {
    const baseline = buildSrcdoc(html, "default-src 'none'", tokens, 'light')!
    const withEmptyAssets = buildSrcdoc(html, "default-src 'none'", tokens, 'light', {})!
    expect(withEmptyAssets).toBe(baseline)
  })

  it('both css and js present: inserts the five-node order CSP meta -> token style -> asset style -> bootstrap -> asset script -> model', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light', { css: '.dogfood{color:red}', js: 'window.__dogfood = 1;' })!
    const cspAt = srcdoc.indexOf('Content-Security-Policy')
    const tokenStyleAt = srcdoc.indexOf('--md-sys-color-primary')
    const assetStyleAt = srcdoc.indexOf('.dogfood{color:red}')
    const bootstrapAt = srcdoc.indexOf('window.genui')
    const assetScriptAt = srcdoc.indexOf('window.__dogfood = 1;')
    const modelAt = srcdoc.indexOf('window.modelRan')
    expect(cspAt).toBeGreaterThan(-1)
    expect(tokenStyleAt).toBeGreaterThan(cspAt)
    expect(assetStyleAt).toBeGreaterThan(tokenStyleAt)
    expect(bootstrapAt).toBeGreaterThan(assetStyleAt)
    expect(assetScriptAt).toBeGreaterThan(bootstrapAt)
    expect(modelAt).toBeGreaterThan(assetScriptAt)
  })

  it('css only (no js): asset style lands between token style and bootstrap; NO extra script node', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light', { css: '.dogfood{color:red}' })!
    expect(srcdoc).toContain('.dogfood{color:red}')
    const assetStyleAt = srcdoc.indexOf('.dogfood{color:red}')
    const bootstrapAt = srcdoc.indexOf('window.genui')
    expect(assetStyleAt).toBeLessThan(bootstrapAt)
    // exactly two <style> tags (token + asset) — no third, no asset <script> at all
    expect((srcdoc.match(/<style>/g) ?? []).length).toBe(2)
    expect((srcdoc.match(/<script>/g) ?? []).length).toBe(2) // bootstrap + the model's own head script — no asset script
  })

  it('js only (no css): asset script lands after bootstrap; NO extra style node', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light', { js: 'window.__dogfood = 1;' })!
    expect(srcdoc).toContain('window.__dogfood = 1;')
    const bootstrapAt = srcdoc.indexOf('window.genui')
    const assetScriptAt = srcdoc.indexOf('window.__dogfood = 1;')
    expect(assetScriptAt).toBeGreaterThan(bootstrapAt)
    expect((srcdoc.match(/<style>/g) ?? []).length).toBe(1) // the token style only
    // the bootstrap <script> plus the model's own head <script> plus the asset <script> — three total, none merged
    expect((srcdoc.match(/<script>/g) ?? []).length).toBe(3)
  })

  it('an empty-string css/js field is treated as ABSENT (falsy), not an empty asset node', () => {
    const srcdoc = buildSrcdoc(html, "default-src 'none'", tokens, 'light', { css: '', js: '' })!
    const baseline = buildSrcdoc(html, "default-src 'none'", tokens, 'light')!
    expect(srcdoc).toBe(baseline)
  })
})

describe('BOOTSTRAP_SCRIPT — the frame-side bridge home (SPEC §2 Bootstrap)', () => {
  it('exposes the ONE model-facing API and posts the handshake/size/action members', () => {
    expect(BOOTSTRAP_SCRIPT).toContain('window.genui')
    expect(BOOTSTRAP_SCRIPT).toContain("type: 'initialize'")
    expect(BOOTSTRAP_SCRIPT).toContain("type: 'size-changed'")
    expect(BOOTSTRAP_SCRIPT).toContain("type: 'action'")
    expect(BOOTSTRAP_SCRIPT).toContain('ResizeObserver')
  })

  it('posts with targetOrigin "*" — the only legal target for an opaque origin (SPEC-R7)', () => {
    expect(BOOTSTRAP_SCRIPT).toContain("postMessage(msg, '*')")
  })

  it('never references a raw eval/tools-call-shaped channel', () => {
    expect(BOOTSTRAP_SCRIPT).not.toContain('eval(')
    expect(BOOTSTRAP_SCRIPT).not.toContain('tools/call')
  })
})
