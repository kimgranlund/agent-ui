import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// column-chart-css.test.ts — column-chart.css static structural + token-hygiene probe (ADR-0228/
// ADR-0229). Mirrors the pie-chart-css.test.ts precedent: pin the STRUCTURE (the two sectioned blocks,
// `:where()` declares `--ui-column-chart-*` (aliasing the shared `_chart/chart-axis.css` chain), `@scope`
// consumes ONLY its own chain ∪ the shared `--md-sys-*` namespaces ∪ the row/segment-scoped `--_seg-*`/
// `--_tick-pct`/`--_cat-pct` hooks, no `[size]`/`[scale]` selector, a forced-colors block exists). The
// rendered-px PROOF (whole-shape/percent math) is column-chart.browser.test.ts.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/column-chart/column-chart.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-column-chart) {'), css.indexOf('@scope (ui-column-chart) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-column-chart) {'))

describe('column-chart.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-column-chart\)/)
  })

  it('the :where(ui-column-chart) block declares every --ui-column-chart-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-column-chart-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-column-chart-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('aliases the shared six-step series ramp from _chart/chart-axis.css by name (the family-tunnel pattern)', () => {
    for (let i = 1; i <= 6; i++) {
      const m = tokenBlock.match(new RegExp(`--ui-column-chart-series-${i}-ink:\\s*var\\(--ui-chart-series-${i}-ink\\)`))
      expect(m, `series-${i}-ink must alias var(--ui-chart-series-${i}-ink)`).not.toBeNull()
    }
  })

  it('aliases the shared chrome-inset, chip, grid, projected, and now-marker tokens from _chart/chart-axis.css', () => {
    const aliasPairs: [string, string][] = [
      ['--ui-column-chart-chrome-inset', '--ui-chart-chrome-inset'],
      ['--ui-column-chart-chip-bg', '--ui-chart-chip-bg'],
      ['--ui-column-chart-chip-fg', '--ui-chart-chip-fg'],
      ['--ui-column-chart-chip-radius', '--ui-chart-chip-radius'],
      ['--ui-column-chart-grid-ink', '--ui-chart-grid-ink'],
      ['--ui-column-chart-now-ink', '--ui-chart-now-ink'],
      ['--ui-column-chart-projected-ink', '--ui-chart-projected-ink'],
    ]
    for (const [own, shared] of aliasPairs) {
      const m = tokenBlock.match(new RegExp(`${own}:\\s*var\\(${shared}\\)`))
      expect(m, `${own} must alias var(${shared})`).not.toBeNull()
    }
  })

  it('no --ui-column-chart-* token declaration reads a raw --md-sys-color-*-NNN tone primitive directly (the ramp lives in _chart/chart-axis.css now)', () => {
    const decls = [...tokenBlock.matchAll(/(--ui-column-chart-[\w-]+)\s*:([^;]*);/g)]
    expect(decls.length).toBeGreaterThan(0) // anti-vacuous
    const offenders = decls.filter((m) => /--md-sys-color-[\w-]*\d{3}/.test(m[2])).map((m) => m[1])
    expect(offenders).toEqual([])
  })

  it('the @scope styles block consumes ONLY --ui-column-chart-* ∪ the shared --md-sys-* namespaces ∪ the row/segment-scoped hooks — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    const localHooks = new Set(['--_seg-start', '--_seg-length', '--_seg-ink', '--_tick-pct', '--_cat-pct', '--_tick-shift', '--_cat-shift'])
    for (const v of refs) {
      const allowed = v.startsWith('--ui-column-chart-') || v.startsWith('--md-sys-') || localHooks.has(v)
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('the row/segment-scoped hooks are consumed but NEVER declared in :where() (imperatively set by column-chart.ts)', () => {
    for (const hook of ['--_seg-start', '--_seg-length', '--_seg-ink', '--_tick-pct', '--_cat-pct', '--_tick-shift', '--_cat-shift']) {
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

  it('every layer child full-overlays one grid cell (the two-layer/three-child stacking technique)', () => {
    expect(stylesBlock).toMatch(/:scope > \*\s*\{[^}]*grid-area:\s*1\s*\/\s*1/)
  })

  it('only the topmost (:last-child) segment rounds its block-start corners — no interior notch', () => {
    expect(stylesBlock).toMatch(/\[data-part='segment'\]:last-child\s*\{[^}]*border-start-start-radius/)
  })

  it('a projected segment is hollow + dashed, never filled', () => {
    const rule = (stylesBlock.match(/\[data-part='segment'\]\[data-projected\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(rule).toMatch(/background:\s*transparent/)
    expect(rule).toMatch(/dashed/)
  })

  it('a forced-colors block flattens segments/gridlines/chips to system inks (ADR-0057 — identity never hue alone)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/\[data-part='segment'\][^}]*background:\s*CanvasText/)
    expect(whcm).toMatch(/\[data-part='grid-line'\][^,]*,[^{]*\{[^}]*stroke:\s*CanvasText/)
  })

  it('no control-frame law (padding-block on the host) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
