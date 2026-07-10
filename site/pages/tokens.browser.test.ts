import { describe, it, expect } from 'vitest'

// tokens.browser.test.ts — the runtime-render proof for the re-hosted token page (ADR-0118,
// token-surfaces.lld.md §5 LLD-C12; SPEC-R17 AC1/AC3). tokens-doc.test.ts proves the DATA (the parse layer,
// via node:fs — jsdom/SSR stubs `.css?raw` to '', so a module IMPORT of tokens.ts cannot run under vitest's
// jsdom project, the file's own header comment explains why). This file proves the RENDER: importing the
// REAL page module through the actual browser dev-transform pipeline (Chromium + WebKit, real `.css?raw`
// content, no SSR stub) — the page composes real `ui-swatch`/`ui-ramp`/`ui-ladder` elements, never throws,
// and both color schemes resolve to real, different colors.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './tokens.ts' // mounts itself into document.body (no #app present in this test document — mountPage's own fallback)

const app = document.querySelector('[data-page-content]') as HTMLElement

describe('tokens.ts — the re-hosted page composes the shipped primitives (SPEC-R17 AC1)', () => {
  it('mounted without throwing (the anti-vacuous parse guards did not fire)', () => {
    expect(app).not.toBeNull()
  })

  it('color roles compose real <ui-swatch> elements (never a hand-built div)', () => {
    const swatches = app.querySelectorAll('ui-swatch')
    expect(swatches.length).toBeGreaterThan(100) // > 100 roles × 2 schemes each (tokens-doc.test.ts's own floor)
  })

  it('the tonal-primitives section composes real <ui-ramp> elements, one per family with numbered steps', () => {
    const ramps = app.querySelectorAll('ui-ramp')
    expect(ramps.length).toBeGreaterThan(0)
    // anti-vacuous: at least one ramp actually rendered cells (steps resolved to real DOM, not an empty strip)
    const anyWithCells = [...ramps].some((r) => r.querySelectorAll('[data-part="cell"]').length > 0)
    expect(anyWithCells).toBe(true)
  })

  it('the dimensional section composes real <ui-ladder> elements, retitled "Dimensional ladders" (the F1 rider)', () => {
    const ladders = app.querySelectorAll('ui-ladder')
    expect(ladders.length).toBe(5) // ui-height / ui-font / ui-icon / ui-compact / ui-space
    const headings = [...app.querySelectorAll('h2')].map((h) => h.textContent)
    expect(headings).toContain('Dimensional ladders')
    expect(headings).not.toContain('Dimensional ramps') // the retired name — never reintroduced
  })

  it('no hand-built swatch divs or magnitude tables remain (net-negative display LOC, SPEC-R17 AC1)', () => {
    expect(app.querySelector('.token-swatch')).toBeNull() // the deleted bespoke swatch class
  })
})

describe('tokens.ts — both color schemes render (SPEC-R17 AC3, SPEC-N5)', () => {
  it('a genuinely light-dark()-divergent role resolves DIFFERENT colors under its light vs dark ui-swatch', () => {
    // Find a role row whose Token cell reads a known scheme-divergent role (neutral-surface — the SAME
    // SPEC-N5 pick swatch.browser.test.ts/ramp.browser.test.ts use), then read its two swatch boxes.
    const codes = [...app.querySelectorAll('td code')]
    const row = codes.find((c) => c.textContent === '--md-sys-color-neutral-surface')?.closest('tr')
    expect(row, 'the neutral-surface role row must exist in the rendered table').not.toBeNull()
    const boxes = [...(row as HTMLElement).querySelectorAll('[data-part="box"]')] as HTMLElement[]
    expect(boxes).toHaveLength(2) // light cell + dark cell
    const [lightColor, darkColor] = boxes.map((b) => getComputedStyle(b).backgroundColor)
    expect(lightColor.length).toBeGreaterThan(0)
    expect(lightColor).not.toBe(darkColor)
  })
})
