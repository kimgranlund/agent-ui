import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// bar-chart-css.test.ts — bar-chart.css static structural + token-hygiene probe (LLD-C6,
// chart-family.lld.md §3). Mirrors the text-css.test.ts / list.css precedent: pin the STRUCTURE (the two
// sectioned blocks, `:where()` declares `--ui-bar-chart-*`, `@scope` consumes ONLY its own chain ∪ the
// shared `--md-sys-*`/`--ui-space-*` namespaces, no `[size]` selector — SPEC-R12 AC2 — and a forced-colors
// block exists). The rendered-px PROOF (proportion/divergence/RTL/WHCM) is bar-chart.browser.test.ts.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/bar-chart/bar-chart.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-bar-chart) {'), css.indexOf('@scope (ui-bar-chart) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-bar-chart) {'))

describe('bar-chart.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-bar-chart\)/)
  })

  it('the :where(ui-bar-chart) block declares every --ui-bar-chart-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-bar-chart-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set(
      [...stylesBlock.matchAll(/var\((--ui-bar-chart-[\w-]+)/g)].map((m) => m[1]),
    )
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('every --ui-bar-chart-* token declaration points at a role or a shared ramp token — no raw primitive', () => {
    // A "raw primitive" would be a bare numeric literal color or an internal --md-sys-color-*-NNN stop; the
    // fleet convention is components read only ROLES (--md-sys-color-{family}-{role}), never primitives.
    const bad = [...tokenBlock.matchAll(/--md-sys-color-[\w-]+/g)].map((m) => m[0]).filter((t) => /-\d{3}/.test(t))
    expect(bad).toEqual([])
  })

  it('the @scope styles block consumes ONLY --ui-bar-chart-* ∪ the shared --md-sys-*/--ui-space-* namespaces (∪ the row-scoped --_bar-* hooks, out of the governed --ui-*/--md-sys-* namespace entirely — the slider/slider-multi --value-pct precedent) — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    for (const v of refs) {
      const allowed =
        v.startsWith('--ui-bar-chart-') || v.startsWith('--md-sys-') || v.startsWith('--ui-space-') || v.startsWith('--_bar-')
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('the row-scoped --_bar-start/--_bar-length hooks are consumed but NEVER declared in :where() (imperatively set by bar-chart.ts, not a component token)', () => {
    expect(stylesBlock).toMatch(/var\(--_bar-start\)/)
    expect(stylesBlock).toMatch(/var\(--_bar-length\)/)
    expect(tokenBlock).not.toMatch(/--_bar-(start|length)\s*:/)
  })

  it('SPEC-R12 AC2: no [size] or [scale] attribute selector anywhere — Display class takes neither', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('no --ui-height-* DECLARATION/consumption anywhere (Display class has no control-height lever, geometry.md)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '') // comment-stripped — a prose mention must not trip this
    expect(bare).not.toMatch(/--ui-height-/)
  })

  it('the row grid is `fit-content(40%) 1fr auto`, subgrid rows spanning all 3 columns (LLD-C6)', () => {
    expect(stylesBlock).toMatch(/grid-template-columns:\s*fit-content\(40%\)\s+1fr\s+auto/)
    const itemRule = (stylesBlock.match(/:scope \[role='listitem'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(itemRule).toMatch(/grid-template-columns:\s*subgrid/)
    expect(itemRule).toMatch(/grid-column:\s*1\s*\/\s*-1/)
  })

  it('labels wrap at the 40% cap (overflow-wrap: anywhere) rather than starving the track (SPEC-R6 AC3)', () => {
    const labelRule = (stylesBlock.match(/:scope \[data-part='label'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(labelRule).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('values right-align with tabular numerals so magnitudes scan vertically', () => {
    const valueRule = (stylesBlock.match(/:scope \[data-part='value'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(valueRule).toMatch(/text-align:\s*end/)
    expect(valueRule).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })

  it('only logical CSS properties are used — no physical left/right/top/bottom anywhere (RTL is free, SPEC-R11)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/[:\s](left|right)\s*:/)
    expect(bare).toMatch(/inset-inline-start/)
  })

  it('a forced-colors block paints the fill CanvasText and the track Canvas+CanvasText border (SPEC-R10 AC1)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/\[data-part='fill'\][^}]*background:\s*CanvasText/)
    expect(whcm).toMatch(/\[data-part='track'\][^}]*background:\s*Canvas\s*;/)
    expect(whcm).toMatch(/border:\s*1px solid CanvasText/)
  })

  it('no control-frame law (padding-block / min-inline-size on a per-glyph basis) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
