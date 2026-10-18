import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// game-hud-css.test.ts: game-hud.css static structure and token hygiene (the playing-card-css.test.ts
// shape; ADR-0243 GameHud fork sheet). The painted proof (fill, wrap, glyph shapes) is
// game-hud.browser.test.ts.

const raw = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/game-hud/game-hud.css`, 'utf8') as string
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '')
const tokenBlock = css.slice(css.indexOf(':where(ui-game-hud) {'), css.indexOf('@scope (ui-game-hud) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-game-hud) {'))

const INTENTS = ['success', 'danger', 'warning', 'info'] as const

describe('game-hud.css: structure and token hygiene', () => {
  it('is two sectioned blocks: a :where() token block then an @scope styles block', () => {
    expect(raw).toContain('[1] TOKEN BLOCK')
    expect(raw).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-game-hud\)/)
  })

  it('every --ui-game-hud-* token the styles block consumes is declared in :where()', () => {
    const declared = new Set([...tokenBlock.matchAll(/(--ui-game-hud-[\w-]+)\s*:/g)].map((m) => m[1]))
    const consumed = new Set([...stylesBlock.matchAll(/var\((--ui-game-hud-[\w-]+)/g)].map((m) => m[1]))
    expect(consumed.size).toBeGreaterThan(0)
    for (const token of consumed) expect(declared, `${token} consumed in @scope but never declared in :where()`).toContain(token)
  })

  it('@scope consumes only --ui-game-hud-* (plus the private --_fill ratio the control writes)', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!)
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) expect(v.startsWith('--ui-game-hud-') || v === '--_fill', `out-of-family token: ${v}`).toBe(true)
  })

  it('no token or style is declared inside @scope', () => {
    expect(stylesBlock).not.toMatch(/--ui-game-hud-[\w-]+\s*:/)
  })
})

describe('game-hud.css: intent glyphs and ink', () => {
  it('each of the four intents opts its ui-glyph mark in, and no clip-path shape remains (T-0351)', () => {
    const optIn = /\[data-part='stat'\]:is\(([^)]*)\) \[data-part='glyph'\] \{[^}]*display:\s*inline-flex/.exec(stylesBlock)?.[1] ?? ''
    for (const intent of INTENTS) expect(optIn, `${intent} glyph is never shown`).toContain(`[data-intent='${intent}']`)
    expect(stylesBlock).not.toMatch(/clip-path/)
  })

  it('the glyph is hidden by default, so an unknown intent never paints a shapeless square', () => {
    expect(stylesBlock).toMatch(/\[data-part='stat'\] \[data-part='glyph'\] \{[^}]*display:\s*none/)
  })

  it('the delta ink keys on intent, never on sign', () => {
    for (const intent of INTENTS) {
      expect(tokenBlock).toMatch(
        new RegExp(`\\[data-intent='${intent}'\\]\\)\\s*\\{\\s*--ui-game-hud-intent-ink:\\s*var\\(--md-sys-color-${intent}-high\\)`),
      )
    }
    expect(stylesBlock).toMatch(/\[data-part='delta'\] \{[^}]*color:\s*var\(--ui-game-hud-intent-ink\)/)
    expect(css).not.toMatch(/data-sign|data-dir|\[data-delta/)
  })

  it('an intent never tints the tile: the tile surface is one token with no intent repoint', () => {
    expect(tokenBlock).toMatch(/--ui-game-hud-stat-surface:\s*var\(--md-sys-color-neutral-container-low\)/)
    const repoints = tokenBlock.slice(tokenBlock.indexOf("[data-intent='"))
    expect(repoints).not.toMatch(/--ui-game-hud-stat-surface/)
  })

  it('the progress fill is one color always: no intent repoint of --ui-game-hud-fill', () => {
    expect(tokenBlock).toMatch(/--ui-game-hud-fill:\s*var\(--md-sys-color-primary\)/)
    expect((tokenBlock.match(/--ui-game-hud-fill:/g) ?? []).length).toBe(1)
  })
})

describe('game-hud.css: sizing, motion and forced colors', () => {
  it('the host fills by default and hugs only under [inline] (ADR-0223)', () => {
    const host = (stylesBlock.match(/:scope \{[^}]*\}/) ?? [''])[0]
    expect(host).toMatch(/display:\s*grid/)
    expect(host).not.toMatch(/min-inline-size|min-width/)
    expect(stylesBlock).toMatch(/:scope\[inline\] \{[^}]*display:\s*inline-grid/)
  })

  it('the stat tiles wrap: an auto-fit grid with a tile floor', () => {
    expect(stylesBlock).toMatch(/grid-template-columns:\s*repeat\(auto-fit, minmax\(var\(--ui-game-hud-stat-min\), 1fr\)\)/)
  })

  it('any transition sits under prefers-reduced-motion: no-preference', () => {
    const outside = stylesBlock.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n  \}\n/g, '')
    expect(outside).not.toMatch(/transition:/)
  })

  it('forced colors paints the fill and the glyph in a system ink', () => {
    const whcm = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(whcm).toMatch(/\[data-part='progress-fill'\] \{[^}]*background-color:\s*CanvasText/)
    expect(whcm).toMatch(/\[data-part='stat'\] \[data-part='glyph'\] \{[^}]*color:\s*CanvasText/)
  })
})
