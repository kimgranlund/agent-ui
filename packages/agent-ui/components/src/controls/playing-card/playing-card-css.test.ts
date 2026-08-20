import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// playing-card-css.test.ts — playing-card.css static structural + token-hygiene probe (ADR-0225). Mirrors
// the pie-chart-css.test.ts precedent: pin the STRUCTURE (the two sectioned blocks, `:where()` declares
// `--ui-playing-card-*`, `@scope` consumes ONLY its own chain ∪ the shared `--md-sys-*` namespace, a
// forced-colors block exists) and the ADR-0225 color forks (the depicted-object pinned-light face, the
// pigment red ink off the danger ladder's FLAT primitive — never wrapped in `light-dark()`, never the
// `danger` intent role). The rendered-px PROOF (aspect ratio, contrast, flip transition, reduced-motion)
// is playing-card.browser.test.ts.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/playing-card/playing-card.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-playing-card) {'), css.indexOf('@scope (ui-playing-card) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-playing-card) {'))

describe('playing-card.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-playing-card\)/)
  })

  it('the :where(ui-playing-card) block declares every --ui-playing-card-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-playing-card-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-playing-card-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('the @scope styles block consumes ONLY --ui-playing-card-* ∪ the shared --md-sys-* namespace — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    for (const v of refs) {
      const allowed = v.startsWith('--ui-playing-card-') || v.startsWith('--md-sys-')
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('no @scope body reads --md-sys-font-*/--md-sys-space-*/--md-sys-shape-corner-base directly (TKT-0066 item 5 — the fleet styling gate this file must ALSO pass on its own)', () => {
    expect(stylesBlock).not.toMatch(/var\(--md-sys-(?:font|space)[a-z0-9-]*\)/)
    expect(stylesBlock).not.toMatch(/var\(--md-sys-shape-corner-base\)/)
  })

  it('the face surface is a FLAT primitive (never light-dark()-wrapped) — pinned light in BOTH schemes by construction (ADR-0225 cl.4)', () => {
    const m = /--ui-playing-card-face-surface:\s*([^;]*);/.exec(tokenBlock)
    expect(m).not.toBeNull()
    expect(m![1]).toMatch(/^var\(--md-sys-color-neutral-050\)$/)
    expect(m![1]).not.toMatch(/light-dark\(/)
  })

  it('--ui-playing-card-ink is a near-black FLAT primitive; --ui-playing-card-ink-red is a danger-ladder FLAT primitive — neither wrapped in light-dark(), neither the `danger` intent role (ADR-0225 cl.3)', () => {
    const ink = /--ui-playing-card-ink:\s*([^;]*);/.exec(tokenBlock)
    const inkRed = /--ui-playing-card-ink-red:\s*([^;]*);/.exec(tokenBlock)
    expect(ink).not.toBeNull()
    expect(inkRed).not.toBeNull()
    expect(ink![1]).toMatch(/^var\(--md-sys-color-neutral-\d{3}\)$/)
    expect(inkRed![1]).toMatch(/^var\(--md-sys-color-danger-\d{3}\)$/)
    expect(ink![1]).not.toMatch(/light-dark\(/)
    expect(inkRed![1]).not.toMatch(/light-dark\(/)
    expect(inkRed![1]).not.toBe('var(--md-sys-color-danger)') // never the intent role — the flat numbered primitive only
  })

  it('the back surface/ink alias the THEMED (light-dark-aware) primary role chain — the back IS table furniture and follows the scheme (ADR-0225 cl.4)', () => {
    const backSurface = /--ui-playing-card-back-surface:\s*([^;]*);/.exec(tokenBlock)
    const backInk = /--ui-playing-card-back-ink:\s*([^;]*);/.exec(tokenBlock)
    expect(backSurface).not.toBeNull()
    expect(backInk).not.toBeNull()
    expect(backSurface![1].trim()).toBe('var(--md-sys-color-primary)')
    expect(backInk![1].trim()).toBe('var(--md-sys-color-primary-on-primary)')
  })

  it('[suit=hearts]/[suit=diamonds] repoint --ui-playing-card-ink to the red pigment token', () => {
    expect(tokenBlock).toMatch(/\[suit='hearts'\][\s\S]{0,80}\[suit='diamonds'\][\s\S]{0,120}--ui-playing-card-ink:\s*var\(--ui-playing-card-ink-red\)/)
  })

  it('[size=sm]/[size=lg] repoint --ui-playing-card-inline-size off the em-keyed chain (never the compact ramp)', () => {
    expect(tokenBlock).toMatch(/\[size='sm'\][\s\S]{0,60}--ui-playing-card-inline-size:\s*3\.5em/)
    expect(tokenBlock).toMatch(/\[size='lg'\][\s\S]{0,60}--ui-playing-card-inline-size:\s*7em/)
    // strip comments first — the token block's own rationale prose MENTIONS --md-sys-compact-* (documenting
    // the deliberate non-reuse), which is not a live declaration/consumption (the css-comment pitfall class)
    const noComments = tokenBlock.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/--md-sys-compact-/)
  })

  it('the host declares aspect-ratio 9/14 and a perspective (the flip rotor\'s 3D depth, ADR-0225 cl.6)', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/aspect-ratio:\s*9\s*\/\s*14/)
    expect(baseRule).toMatch(/perspective:/)
  })

  it('the flipper carries transform-style: preserve-3d and both faces carry backface-visibility: hidden', () => {
    expect(stylesBlock).toMatch(/\[data-part='flipper'\][^}]*transform-style:\s*preserve-3d/)
    expect(stylesBlock).toMatch(/\[data-part='face'\],\s*\n?\s*\[data-part='back'\][^}]*backface-visibility:\s*hidden/)
  })

  it('the flip transition is gated behind :scope:state(ready) — never unconditional on the flipper', () => {
    expect(stylesBlock).toMatch(/:scope:state\(ready\)\s*\[data-part='flipper'\][^}]*transition:/)
  })

  it('a reduced-motion arm exists for BOTH the deal entrance and the flip transition', () => {
    const reducedBlocks = [...stylesBlock.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n  \}\n/g)]
    expect(reducedBlocks.length).toBeGreaterThanOrEqual(2)
  })

  it('a @starting-style deal entrance exists on the host, unconditional (no :state(ready) gate)', () => {
    const startingStyleBlock = /@starting-style\s*\{\s*:scope\s*\{([^}]*)\}/.exec(stylesBlock)
    expect(startingStyleBlock).not.toBeNull()
    expect(startingStyleBlock![1]).toMatch(/opacity:\s*0/)
  })

  it('a forced-colors block flattens face/back to Canvas/CanvasText', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/CanvasText/)
    expect(whcm).toMatch(/background:\s*Canvas\s*;/)
  })

  it('no [size]/[scale] selector styles [data-part] geometry off a control-height lever — no --md-sys-height-* anywhere (Display class has no control-height)', () => {
    expect(css).not.toMatch(/--md-sys-height-/)
  })

  it('no control-frame law (padding-block on the host) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
