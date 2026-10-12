import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// board-grid-css.test.ts: the token-hygiene trip-wire for board-grid.css (ADR-0243; component-build step
// 5), in the playing-card-css.test.ts shape. Raw-text reads, comments stripped where the check needs it.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/board-grid/board-grid.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-board-grid) {'), css.indexOf('@scope (ui-board-grid) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-board-grid) {'))
const bare = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '')

/** The fleet constants @scope may read directly: focus ring, motion, the control line-height. */
const SANCTIONED = [/^--md-sys-state-focus-ring-/, /^--md-sys-color-focus-ring$/, /^--md-sys-motion-/, /^--md-sys-control-line-height$/]

describe('board-grid.css: structure + token hygiene', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-board-grid\)/)
  })

  it('tokens are declared in :where(): every --ui-board-grid-* the styles consume is declared there', () => {
    const declared = new Set([...bare(tokenBlock).matchAll(/(--ui-board-grid-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...bare(stylesBlock).matchAll(/var\((--ui-board-grid-[\w-]+)/g)].map((m) => m[1]))
    expect(declared.size).toBeGreaterThan(0)
    expect(consumed.size).toBeGreaterThan(0)
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('every token-block selector is a :where() naming only ui-board-grid', () => {
    const selectors = [...bare(tokenBlock).matchAll(/([^{}]+)\{/g)].map((m) => m[1]!.trim())
    expect(selectors.length).toBeGreaterThan(0)
    for (const sel of selectors) {
      expect(sel.startsWith(':where(ui-board-grid'), sel).toBe(true)
      for (const tag of sel.match(/ui-[a-z-]+/g) ?? []) expect(tag).toBe('ui-board-grid')
    }
  })

  it('@scope consumes only --ui-board-grid-* plus the sanctioned fleet constants', () => {
    const refs = [...bare(stylesBlock).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!)
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) {
      const ok = v.startsWith('--ui-board-grid-') || SANCTIONED.some((re) => re.test(v))
      expect(ok, `@scope consumed an out-of-family token: ${v}`).toBe(true)
    }
  })

  it('the per-intent -container and -high roles are used for all five intents', () => {
    for (const intent of ['neutral', 'info', 'success', 'warning', 'danger']) {
      expect(tokenBlock).toContain(`var(--md-sys-color-${intent}-container)`)
      expect(tokenBlock).toContain(`var(--md-sys-color-${intent}-high)`)
      expect(tokenBlock).toMatch(new RegExp(`\\[data-intent='${intent}'\\]\\)\\s*\\{[^}]*--ui-board-grid-cell-bg:\\s*var\\(--ui-board-grid-${intent}-bg\\)`))
    }
  })

  it('cells are square and floored at 34px on the control-height row', () => {
    expect(tokenBlock).toMatch(/--ui-board-grid-cell-size:\s*max\(34px,\s*var\(--md-sys-height-md\)\)/)
    expect(bare(stylesBlock)).toMatch(/aspect-ratio:\s*1;/)
  })

  it('transitions live only under prefers-reduced-motion: no-preference', () => {
    const s = bare(stylesBlock)
    const guarded = s.indexOf('@media (prefers-reduced-motion: no-preference)')
    expect(guarded).toBeGreaterThan(-1)
    const firstTransition = s.indexOf('transition')
    expect(firstTransition).toBeGreaterThan(guarded)
  })

  it('hover tint is only on enabled interactive cells', () => {
    const hovers = [...bare(stylesBlock).matchAll(/([^{}]*:hover[^{}]*)\{/g)].map((m) => m[1]!.trim())
    expect(hovers).toEqual(["button[data-part='cell']:not(:disabled):hover".replace(/^/, ':scope ')])
  })
})
