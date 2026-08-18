import { describe, it, expect } from 'vitest'

// highlight-doc.browser.test.ts — GH #1264, the real-engine proof for the guide page's PROSE treatment and its
// read-only ui-code specimens. Imports the REAL page module through the browser dev-transform pipeline (real
// CSS, no jsdom stub), then measures computed styles — the same pattern tokens.browser.test.ts uses.
//
// Before the fix (measured 2026-08-18, chromium + webkit): paragraph ink resolved to `-on-surface` (the
// theme-provider ADR-0148 re-root shadowed _page.css's GH #628 body rule), leading 1.429, UA <p>/<h2> margins,
// ui-code background == body background (no panel), and NO `[data-token]` spans (the page wrote
// `.textContent`, never `projectHighlight`).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './highlight-doc.ts'

const app = document.querySelector('[data-page-content]') as HTMLElement

/** Resolve a `--md-sys-color-*` role to the SAME computed form `getComputedStyle().color` reports, via a probe
 *  element inside the page (so light-dark() resolves under the page's own scheme). */
function resolveRole(role: string): string {
  const probe = document.createElement('span')
  probe.style.color = `var(${role})`
  app.append(probe)
  const c = getComputedStyle(probe).color
  probe.remove()
  return c
}

const prose = [...app.querySelectorAll('p')].find((x) => x.textContent?.startsWith('Dispatch is by language')) as HTMLElement
const fidelity = [...app.querySelectorAll('h2')].find((x) => x.textContent === 'The fidelity floor') as HTMLElement
const tsSample = app.querySelector('ui-code[language="ts"]') as HTMLElement

describe('highlight-doc — guide prose reads at the site prose treatment (GH #1264)', () => {
  it('a guide paragraph carries -on-surface-variant ink (GH #628 restored below the theme-provider re-root)', () => {
    expect(prose).toBeDefined()
    const ink = getComputedStyle(prose).color
    expect(ink).toBe(resolveRole('--md-sys-color-neutral-on-surface-variant'))
    expect(ink).not.toBe(resolveRole('--md-sys-color-neutral-on-surface'))
  })

  it('a section heading keeps the stronger -on-surface ink (hierarchy)', () => {
    expect(getComputedStyle(fidelity).color).toBe(resolveRole('--md-sys-color-neutral-on-surface'))
  })

  it('prose leading is the body-large row (>= 1.5), not the ambient 1.429', () => {
    const cs = getComputedStyle(prose)
    const ratio = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)
    expect(ratio).toBeGreaterThanOrEqual(1.5 - 0.005)
  })

  it('heading -> paragraph rhythm rides the doc-body scale (2xl above a heading, lg under a paragraph, 72ch measure)', () => {
    const h = getComputedStyle(fidelity)
    const p = getComputedStyle(prose)
    expect(parseFloat(h.marginBlockStart)).toBeGreaterThanOrEqual(parseFloat(p.marginBlockEnd)) // heading gap > paragraph gap
    expect(parseFloat(h.marginBlockStart)).toBeGreaterThan(24) // 2xl (32px at density 1) — never the UA 0.83em
    expect(parseFloat(p.marginBlockStart)).toBe(0)
    expect(p.maxInlineSize).toMatch(/px$/) // 72ch resolved to a real length, not `none`
  })
})

describe('highlight-doc — read-only ui-code specimens carry the editor-like panel + token tints (GH #1264)', () => {
  it('a specimen renders on a panel distinct from the page ground', () => {
    const bg = getComputedStyle(tsSample).backgroundColor
    expect(bg).not.toBe(getComputedStyle(document.body).backgroundColor)
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('a specimen has real padding + a radius (the panel chrome)', () => {
    const cs = getComputedStyle(tsSample)
    expect(parseFloat(cs.paddingInlineStart)).toBeGreaterThan(0)
    expect(parseFloat(cs.paddingBlockStart)).toBeGreaterThan(0)
    expect(parseFloat(cs.borderTopLeftRadius)).toBeGreaterThan(0)
  })

  it('specimens are PROJECTED (real [data-token] spans) and a keyword reads a different ink than the plain run', () => {
    const kw = tsSample.querySelector('[data-token="keyword"]') as HTMLElement | null
    expect(kw, 'the ts specimen must carry a keyword token span (projectHighlight ran)').not.toBeNull()
    expect(getComputedStyle(kw as HTMLElement).color).not.toBe(getComputedStyle(tsSample).color)
    // and every one of the six specimens is projected, not a bare textContent write
    const samples = [...app.querySelectorAll('ui-code[language]')].filter((c) => !c.closest('ui-markdown'))
    expect(samples.length).toBeGreaterThanOrEqual(6)
    for (const s of samples) expect(s.querySelector('[data-token]'), `${s.getAttribute('language')} specimen`).not.toBeNull()
  })

  it('specimen mono size rides the body step (never larger than the surrounding prose)', () => {
    expect(parseFloat(getComputedStyle(tsSample).fontSize)).toBeLessThanOrEqual(parseFloat(getComputedStyle(prose).fontSize))
  })
})
