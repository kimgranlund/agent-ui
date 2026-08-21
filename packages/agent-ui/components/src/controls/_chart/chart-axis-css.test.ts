import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// chart-axis-css.test.ts — chart-axis.css structural + token-hygiene probe (ADR-0228). Mirrors the
// pie-chart-css.test.ts / bar-chart-css.test.ts precedent, adapted for a SHARED (non-`@scope`) sheet: no
// per-control `@scope` body to bound consumption here — this file only DECLARES, at `:where(:root)`; the
// per-consumer alias discipline is pinned on each consuming control's OWN `*-css.test.ts` instead (the
// column-chart-css.test.ts sibling).

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/_chart/chart-axis.css`,
  'utf8',
) as string

describe('chart-axis.css — the shared ADR-0228 token chain', () => {
  it('declares at :where(:root), never inside an @scope body (a shared home, not a control)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ') // comment-stripped — a rationale comment MENTIONING @scope is not a live block
    expect(bare).toMatch(/:where\(:root\)\s*\{/)
    expect(bare).not.toMatch(/@scope/)
  })

  it('declares the chrome-inset knob, the six chip tokens, the two plot-ink tokens, projected + now tokens', () => {
    for (const token of [
      '--ui-chart-chrome-inset',
      '--ui-chart-chip-bg',
      '--ui-chart-chip-fg',
      '--ui-chart-chip-radius',
      '--ui-chart-chip-pad-inline',
      '--ui-chart-chip-pad-block',
      '--ui-chart-chip-font-size',
      '--ui-chart-grid-ink',
      '--ui-chart-baseline-ink',
      '--ui-chart-projected-ink',
      '--ui-chart-projected-dash',
      '--ui-chart-now-ink',
    ]) {
      expect(css, `expected ${token} to be declared`).toMatch(new RegExp(`${token}\\s*:`))
    }
  })

  it('declares the SIX-step single-family lightness ramp — pairwise-distinct, strictly monotone primary TONE primitives per scheme via light-dark(), series 1 brightest (ADR-0228 cl.6, generalizing ADR-0219)', () => {
    const steps = Array.from({ length: 6 }, (_, i) => {
      const m = css.match(
        new RegExp(
          `--ui-chart-series-${i + 1}-ink:\\s*light-dark\\(var\\(--md-sys-color-primary-(\\d{3})\\),\\s*var\\(--md-sys-color-primary-(\\d{3})\\)\\)`,
        ),
      )
      expect(m, `series-${i + 1}-ink must be light-dark(primary tone primitive, primary tone primitive)`).not.toBeNull()
      return { light: Number(m![1]), dark: Number(m![2]) }
    })
    for (const scheme of ['light', 'dark'] as const) {
      const ladder = steps.map((s) => s[scheme])
      expect(new Set(ladder).size, `${scheme}: the six steps must be pairwise distinct (${ladder.join(', ')})`).toBe(6)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i], `${scheme}: the ladder must be strictly monotone darker 1→6 (${ladder.join(', ')})`).toBeGreaterThan(ladder[i - 1])
      }
    }
    for (const s of steps) expect(s.light - s.dark).toBe(100)
  })

  it('every token declaration resolves through a role/ramp/space/typescale reference or a literal shape constant — no raw color/px literal masquerading as a role', () => {
    const decls = [...css.matchAll(/(--ui-chart-[\w-]+)\s*:([^;]*);/g)]
    expect(decls.length).toBeGreaterThan(0) // anti-vacuous
    for (const [, name, value] of decls) {
      const v = value.trim()
      const isRoleRef = /^var\(--md-sys-/.test(v) || /^light-dark\(/.test(v)
      const isShapeConstant = name === '--ui-chart-chip-radius' && v === '999px'
      const isDashPattern = name === '--ui-chart-projected-dash' && /^[\d\s]+$/.test(v)
      expect(isRoleRef || isShapeConstant || isDashPattern, `${name}: "${v}" is neither a role reference nor a named shape constant`).toBe(true)
    }
  })
})
