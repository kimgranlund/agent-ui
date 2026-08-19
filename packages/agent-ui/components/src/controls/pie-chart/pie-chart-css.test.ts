import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// pie-chart-css.test.ts — pie-chart.css static structural + token-hygiene probe (ADR-0219). Mirrors the
// bar-chart-css.test.ts precedent: pin the STRUCTURE (the two sectioned blocks, `:where()` declares
// `--ui-pie-chart-*`, `@scope` consumes ONLY its own chain ∪ the shared `--md-sys-*` namespaces ∪ the
// row-scoped `--_slice-ink` hook, no `[size]`/`[scale]` selector, a forced-colors block exists, the
// SIX-token lightness ramp is declared). The rendered-px PROOF (whole-shape/donut-hole) is
// pie-chart.browser.test.ts.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/pie-chart/pie-chart.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-pie-chart) {'), css.indexOf('@scope (ui-pie-chart) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-pie-chart) {'))

describe('pie-chart.css — structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-pie-chart\)/)
  })

  it('the :where(ui-pie-chart) block declares every --ui-pie-chart-* token this file consumes', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-pie-chart-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-pie-chart-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0) // anti-vacuous
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('declares the SIX-step single-family lightness ramp — pairwise-distinct, strictly monotone primary TONE primitives per scheme via light-dark(), slice 1 brightest (ADR-0219 cl.4 + Amendment)', () => {
    // The originally-named emphasis-role chain (-bright/-high/base/-dim/-low/-muted) resolves to only
    // FOUR distinct colors and a lightness zigzag in the shipped estate (ADR-0219 Amendment) — the
    // defaults must read tone primitives, split per scheme. Higher tone step = darker in this estate,
    // so a strictly INCREASING step sequence = strictly monotone darker = slice 1 brightest.
    const steps = Array.from({ length: 6 }, (_, i) => {
      const m = tokenBlock.match(
        new RegExp(
          `--ui-pie-chart-slice-${i + 1}-ink:\\s*light-dark\\(var\\(--md-sys-color-primary-(\\d{3})\\),\\s*var\\(--md-sys-color-primary-(\\d{3})\\)\\)`,
        ),
      )
      expect(m, `slice-${i + 1}-ink must be light-dark(primary tone primitive, primary tone primitive)`).not.toBeNull()
      return { light: Number(m![1]), dark: Number(m![2]) }
    })
    for (const scheme of ['light', 'dark'] as const) {
      const ladder = steps.map((s) => s[scheme])
      expect(new Set(ladder).size, `${scheme}: the six steps must be pairwise distinct (${ladder.join(', ')})`).toBe(6)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i], `${scheme}: the ladder must be strictly monotone darker 1→6 (${ladder.join(', ')})`).toBeGreaterThan(ladder[i - 1])
      }
    }
    // dark rides exactly one 100-step brighter than light (the estate's base-role convention, 550→450).
    for (const s of steps) expect(s.light - s.dark).toBe(100)
  })

  it('every --ui-pie-chart-* token declaration points at a role or a shared ramp token — the ONE ruled exception: the six slice inks read primary TONE primitives inside light-dark() (ADR-0219 cl.4 Amendment)', () => {
    const decls = [...tokenBlock.matchAll(/(--ui-pie-chart-[\w-]+)\s*:([^;]*);/g)]
    expect(decls.length).toBeGreaterThan(0) // anti-vacuous
    const offenders = decls
      .filter((m) => !/^--ui-pie-chart-slice-[1-6]-ink$/.test(m[1]) && /--md-sys-color-[\w-]*\d{3}/.test(m[2]))
      .map((m) => m[1])
    expect(offenders, 'raw tone primitives are legal ONLY in the six slice-ink defaults').toEqual([])
    // and the slice inks never read a primitive OUTSIDE a light-dark() scheme split (no mode-blind default).
    for (const m of decls) {
      if (!/^--ui-pie-chart-slice-[1-6]-ink$/.test(m[1])) continue
      expect(m[2].trim(), `${m[1]} must wrap its primitives in light-dark()`).toMatch(/^light-dark\(/)
    }
  })

  it('the @scope styles block consumes ONLY --ui-pie-chart-* ∪ the shared --md-sys-* namespaces ∪ the row-scoped --_slice-ink hook — no cross-control reach', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous
    for (const v of refs) {
      const allowed = v.startsWith('--ui-pie-chart-') || v.startsWith('--md-sys-') || v === '--_slice-ink'
      expect(allowed, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('the --_slice-ink hook is consumed but NEVER declared in :where() (imperatively set by pie-chart.ts, not a component token)', () => {
    expect(stylesBlock).toMatch(/var\(--_slice-ink\)/)
    expect(tokenBlock).not.toMatch(/--_slice-ink\s*:/)
  })

  it('SPEC-R12-class AC: no [size] or [scale] attribute selector anywhere — Display class takes neither', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/\[size\b/)
    expect(bare).not.toMatch(/\[scale\b/)
  })

  it('no --md-sys-height-* DECLARATION/consumption anywhere (Display class has no control-height lever, geometry.md)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--md-sys-height-/)
  })

  it('the layout is a two-column grid — the ring spans every row (column 1), key rows auto-flow into column 2', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).toMatch(/grid-template-columns:\s*auto\s+1fr/)
    const ringRule = (stylesBlock.match(/:scope svg\[data-part='ring'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(ringRule).toMatch(/grid-column:\s*1/)
    expect(ringRule).toMatch(/grid-row:\s*1\s*\/\s*-1/)
  })

  it('a forced-colors block flattens slices/swatch to CanvasText and separators/track to Canvas (ADR-0219 cl.7)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/\[data-part='slice'\][^}]*fill:\s*CanvasText/)
    expect(whcm).toMatch(/\[data-part='track'\][^}]*fill:\s*Canvas\s*;/)
    expect(whcm).toMatch(/\[data-part='key-swatch'\][^}]*background:\s*CanvasText/)
  })

  it('no control-frame law (padding-block on the host) — this is Display, not Control', () => {
    const baseRule = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(baseRule).not.toMatch(/padding-block:/)
  })
})
