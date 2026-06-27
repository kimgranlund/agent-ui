import { describe, it, expect } from 'vitest'
// Read button.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the s6 ramp probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Phase-1 s7 — button.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0006 anatomy;
// references/geometry.md). The rendered-px CHANGE is s13's browser smoke; here we pin the STRUCTURE: the
// two sectioned blocks, that `:where()` DECLARES the `--ui-button-*` chain, that `@scope` CONSUMES only it,
// the geometry law, the `:has()` host-as-grid, the [variant]/[size] repoints, and a forced-colors block.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/button/button.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-button) {'), css.indexOf('@scope (ui-button) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-button) {'))

describe('button.css — structure + token hygiene (s7)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-button\)/)
  })

  it('the :where() block DECLARES the full --ui-button-* chain from colour roles + the dimensional ramp', () => {
    for (const slot of ['bg', 'ink', 'border', 'height', 'font', 'gap', 'icon']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-button-${slot}:`))
    }
    expect(tokenBlock).toContain('var(--c-primary') // colour roles (default family = primary)
    expect(tokenBlock).toContain('var(--ui-height-md)') // the s6 dimensional ramp
  })

  it('[variant] repoints the colour channel; [size] repoints the geometry', () => {
    expect(tokenBlock).toMatch(/ui-button\[variant='soft'\]/)
    expect(tokenBlock).toMatch(/ui-button\[variant='ghost'\]/)
    expect(tokenBlock).toMatch(/ui-button\[size='sm'\]/)
    expect(tokenBlock).toMatch(/ui-button\[size='lg'\]/)
  })

  it('@scope CONSUMES only --ui-button-* (no raw --c- role or ramp refs leak into the styles)', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) expect(v).toMatch(/^--ui-button-/) // the component reads only its own chain
  })

  it('geometry per the LAW: block-size off the ramp, padding-block 0, slotless inline-pad = h/2', () => {
    expect(stylesBlock).toMatch(/block-size:\s*var\(--ui-button-height\)/)
    expect(stylesBlock).toMatch(/padding-block:\s*0/)
    expect(stylesBlock).toMatch(/padding-inline:\s*calc\(var\(--ui-button-height\)\s*\/\s*2\)/)
  })

  it('host-as-grid (ADR-0006): a presence-driven :has() icon slot + the density-bearing column-gap', () => {
    expect(stylesBlock).toMatch(/:scope:has\(>\s*\[slot='icon'\]\)/) // optional leading icon slot
    expect(stylesBlock).toMatch(/grid-template-columns:\s*auto 1fr/) // icon + label
    expect(stylesBlock).toMatch(/column-gap:\s*var\(--ui-button-gap\)/) // the gap rides --ui-density
    expect(stylesBlock).toMatch(/calc\(\(var\(--ui-button-height\)\s*-\s*var\(--ui-button-icon\)\)\s*\/\s*2\)/) // slot ½(h−icon)
  })

  it('a forced-colors block keeps the ink/border from vanishing', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
  })
})
