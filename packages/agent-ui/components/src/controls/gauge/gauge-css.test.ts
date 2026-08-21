import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// gauge-css.test.ts — gauge.css static structural + token-hygiene probe (ADR-0228/ADR-0229 cl.4).
// Mirrors the pie-chart-css.test.ts/column-chart-css.test.ts precedent: pin the STRUCTURE (the two
// sectioned blocks, `:where()` declares `--ui-gauge-*` (aliasing the shared `_chart/chart-axis.css`
// chain), `@scope` consumes ONLY its own chain ∪ the shared `--md-sys-*` namespaces ∪ the ring-scoped
// `--_ring-*` hooks, no `[size]`/`[scale]` selector, a forced-colors block exists) AND the two
// Kim-reinforced load-bearing criteria: (1) the inset system — the rings layer bleeds edge-to-edge at
// zero inset while the legend layer's clearance comes from ONE `--ui-gauge-chrome-inset` knob, never
// from shrinking the rings layer; (2) the SVG fill/stroke ramp — the shared series ramp actually lands
// on a real `stroke`/`fill` property, not merely a declared-but-unconsumed custom property. The
// rendered-px PROOF (the whole-shape/inset geometry) is gauge.browser.test.ts.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/gauge/gauge.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-gauge) {'), css.indexOf('@scope (ui-gauge) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-gauge) {'))

describe('gauge.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-gauge\)/)
  })

  it('the :where(ui-gauge) block declares every --ui-gauge-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-gauge-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-gauge-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('aliases the shared six-step series ramp from _chart/chart-axis.css by name (the family-tunnel pattern)', () => {
    for (let i = 1; i <= 6; i++) {
      const m = tokenBlock.match(new RegExp(`--ui-gauge-series-${i}-ink:\\s*var\\(--ui-chart-series-${i}-ink\\)`))
      expect(m, `series-${i}-ink must alias var(--ui-chart-series-${i}-ink)`).not.toBeNull()
    }
  })

  it('aliases the shared chrome-inset knob from _chart/chart-axis.css (Kim reinforcement 1 — the inset system)', () => {
    const m = tokenBlock.match(/--ui-gauge-chrome-inset:\s*var\(--ui-chart-chrome-inset\)/)
    expect(m, '--ui-gauge-chrome-inset must alias var(--ui-chart-chrome-inset)').not.toBeNull()
  })

  it('no --ui-gauge-* token declaration reads a raw --md-sys-color-*-NNN tone primitive directly (the ramp lives in _chart/chart-axis.css now)', () => {
    const decls = [...tokenBlock.matchAll(/(--ui-gauge-[\w-]+)\s*:([^;]*);/g)]
    expect(decls.length).toBeGreaterThan(0) // anti-vacuous
    const offenders = decls.filter((m) => /--md-sys-color-[\w-]*\d{3}/.test(m[2])).map((m) => m[1])
    expect(offenders).toEqual([])
  })

  it('the @scope styles block consumes ONLY --ui-gauge-* ∪ the shared --md-sys-* namespaces ∪ the ring-scoped hooks — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    const localHooks = new Set(['--_ring-ink', '--_ring-circumference', '--_ring-dashoffset'])
    for (const v of refs) {
      const allowed = v.startsWith('--ui-gauge-') || v.startsWith('--md-sys-') || localHooks.has(v)
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('the ring-scoped hooks are consumed but NEVER declared in :where() (imperatively set by gauge.ts)', () => {
    for (const hook of ['--_ring-ink', '--_ring-circumference', '--_ring-dashoffset']) {
      expect(stylesBlock).toMatch(new RegExp(`var\\(${hook}`))
      expect(tokenBlock).not.toMatch(new RegExp(`${hook}\\s*:`))
    }
  })

  it('SPEC-R12-class AC: no [size] or [scale] attribute selector anywhere — Display class takes neither', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('no --md-sys-height-* DECLARATION/consumption anywhere (Display class has no control-height lever)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--md-sys-height-/)
  })

  it('every layer child full-overlays one grid cell (the rings/legend two-layer stacking technique)', () => {
    expect(stylesBlock).toMatch(/:scope > \*\s*\{[^}]*grid-area:\s*1\s*\/\s*1/)
  })

  it('the rings svg layer has NO padding/inset of its own — it bleeds edge-to-edge (Kim reinforcement 1)', () => {
    const rule = (stylesBlock.match(/svg\[data-part='rings'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(rule.length).toBeGreaterThan(0)
    expect(rule).not.toMatch(/padding/)
    expect(rule).toMatch(/inline-size:\s*100%/)
    expect(rule).toMatch(/block-size:\s*100%/)
  })

  it('the legend layer gets its clearance from EXACTLY the chrome-inset token, not a bespoke padding value (Kim reinforcement 1)', () => {
    const rule = (stylesBlock.match(/\[data-part='legend'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(rule).toMatch(/padding:\s*var\(--ui-gauge-chrome-inset\)/)
  })

  it('the shared series ramp resolves onto a real SVG `stroke` (progress ring) AND `background` (legend swatch) — never a declared-but-unconsumed custom property (Kim reinforcement 2)', () => {
    const strokeRule = (stylesBlock.match(/\[data-part='progress'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(strokeRule).toMatch(/stroke:\s*var\(--_ring-ink/)
    const swatchRule = (stylesBlock.match(/\[data-part='key-swatch'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(swatchRule).toMatch(/background:\s*var\(--_ring-ink/)
  })

  it('grep-verifiable: fill:/stroke: lines exist and the ramp tokens land on them (Kim reinforcement 2, literal check)', () => {
    const fillStrokeLines = css.split('\n').filter((l) => /\b(fill|stroke)\s*:/.test(l) && !l.trim().startsWith('*'))
    expect(fillStrokeLines.length).toBeGreaterThan(0)
    const ringInkConsumingLine = fillStrokeLines.find((l) => l.includes('--_ring-ink'))
    expect(ringInkConsumingLine, 'no fill:/stroke: line consumes --_ring-ink (the series-ramp alias chain)').toBeTruthy()
  })

  it('the progress ring reads rounded caps + the dasharray/dashoffset hooks (the SVG radial-gauge technique)', () => {
    const rule = (stylesBlock.match(/\[data-part='progress'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(rule).toMatch(/stroke-linecap:\s*round/)
    expect(rule).toMatch(/stroke-dasharray:\s*var\(--_ring-circumference/)
    expect(rule).toMatch(/stroke-dashoffset:\s*var\(--_ring-dashoffset/)
  })

  it('a forced-colors block flattens the track/progress/swatch to system inks (ADR-0057 — identity never hue alone)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/\[data-part='progress'\][^}]*stroke:\s*CanvasText/)
    expect(whcm).toMatch(/\[data-part='track'\][^}]*stroke:\s*Canvas/)
  })

  it('no control-frame law (padding-block on the host) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
