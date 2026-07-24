import { describe, it, expect } from 'vitest'
import { buildCsp } from './csp.ts'

// csp.test.ts — genui-surface.spec.md SPEC-R4 AC1 (the pure builder unit): an empty config yields the
// v1 default floor verbatim; a resourceDomains entry joins ONLY img-src/font-src; an http:/bare-host
// entry rejects the WHOLE config (fail-closed, never a partial policy).

describe('buildCsp — the v1 default-closed floor (SPEC-R4)', () => {
  it('an empty config composes every default row verbatim', () => {
    const policy = buildCsp({})
    expect(policy).toBeDefined()
    const p = policy!
    expect(p).toContain("default-src 'none'")
    expect(p).toContain("script-src 'unsafe-inline'")
    expect(p).toContain("style-src 'unsafe-inline'")
    expect(p).toContain('img-src data: blob:')
    expect(p).toContain('font-src data:')
    expect(p).toContain("connect-src 'none'")
    expect(p).toContain("frame-src 'none'")
    expect(p).toContain("child-src 'none'")
    expect(p).toContain("base-uri 'none'")
    expect(p).toContain("form-action 'none'")
  })

  it('resourceDomains joins ONLY img-src/font-src, https-only', () => {
    const p = buildCsp({ resourceDomains: ['https://img.example.com'] })!
    expect(p).toContain('img-src data: blob: https://img.example.com')
    expect(p).toContain('font-src data: https://img.example.com')
    expect(p).toContain("connect-src 'none'") // untouched
    expect(p).toContain("frame-src 'none'") // untouched
  })

  it('connectDomains joins ONLY connect-src', () => {
    const p = buildCsp({ connectDomains: ['https://api.example.com'] })!
    expect(p).toContain('connect-src https://api.example.com')
    expect(p).toContain('img-src data: blob:') // untouched (no resourceDomains)
  })

  it('frameDomains joins BOTH frame-src and child-src', () => {
    const p = buildCsp({ frameDomains: ['https://embed.example.com'] })!
    expect(p).toContain('frame-src https://embed.example.com')
    expect(p).toContain('child-src https://embed.example.com')
  })

  it('baseUriDomains joins ONLY base-uri', () => {
    const p = buildCsp({ baseUriDomains: ['https://base.example.com'] })!
    expect(p).toContain('base-uri https://base.example.com')
  })

  it('a *.example.com single-label wildcard is accepted', () => {
    expect(buildCsp({ resourceDomains: ['https://*.example.com'] })).toBeDefined()
  })

  it('an http: entry rejects the WHOLE config (fail-closed)', () => {
    expect(buildCsp({ resourceDomains: ['http://img.example.com'] })).toBeUndefined()
  })

  it('a bare-host entry (no scheme) rejects the WHOLE config', () => {
    expect(buildCsp({ connectDomains: ['api.example.com'] })).toBeUndefined()
  })

  it('a mix of one valid + one invalid entry rejects the WHOLE category (no partial policy)', () => {
    expect(buildCsp({ resourceDomains: ['https://good.example.com', 'ftp://bad.example.com'] })).toBeUndefined()
  })

  it('never emits frame-ancestors or the CSP sandbox directive (SPEC-R4 — both ignored in meta CSP)', () => {
    const p = buildCsp({})!
    expect(p).not.toContain('frame-ancestors')
    expect(p).not.toMatch(/(^|;\s*)sandbox\b/)
  })
})
