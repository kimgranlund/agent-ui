import { describe, it, expect } from 'vitest'
// Read text.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0025 — text.css static structural check (the two-block shape + token hygiene + role-pure seam;
// ADR-0025 cl.3a). The rendered-px CHANGE is text.browser.test.ts; here we pin the STRUCTURE: the two
// sectioned blocks, that `:where()` DECLARES the `--ui-text-*` chain, that `@scope` CONSUMES only it,
// the [variant] repoints to --ui-type-*, and a forced-colors block.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/text/text.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-text) {'), css.indexOf('@scope (ui-text) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-text) {'))

describe('text.css — structure + token hygiene (ADR-0025 cl.3a)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-text\)/)
  })

  it('the :where() block DECLARES all four --ui-text-* component tokens', () => {
    for (const slot of ['size', 'weight', 'leading', 'color']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-text-${slot}:`))
    }
    // default level = body — each triplet points to the body level
    expect(tokenBlock).toContain('var(--ui-type-body-size)')
    expect(tokenBlock).toContain('var(--ui-type-body-weight)')
    expect(tokenBlock).toContain('var(--ui-type-body-leading)')
    // color role — the surface-text ink (the AA-gated role)
    expect(tokenBlock).toContain('var(--c-neutral-on-surface)')
  })

  it('[variant] repoints the three typography tokens to --ui-type-{level}-* (the role-pure seam)', () => {
    for (const v of ['h1', 'h2', 'h3', 'h4', 'h5', 'caption']) {
      // each non-body variant has a repoint block (body is the default — no repoint needed)
      expect(tokenBlock, `missing [variant='${v}'] repoint`).toContain(`[variant='${v}']`)
      expect(tokenBlock).toContain(`var(--ui-type-${v}-size)`)
      expect(tokenBlock).toContain(`var(--ui-type-${v}-weight)`)
      expect(tokenBlock).toContain(`var(--ui-type-${v}-leading)`)
    }
    // body has NO repoint block (it IS the default)
    expect(tokenBlock).not.toMatch(/\[variant='body'\]/)
  })

  it('@scope CONSUMES only --ui-text-* (no --ui-type-* or --c-* leaking into the styles block)', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) {
      expect(v, `@scope consumed non-component token: ${v}`).toMatch(/^--ui-text-/)
    }
    // anti-vacuous: the component tokens ARE consumed
    expect(refs).toContain('--ui-text-size')
    expect(refs).toContain('--ui-text-weight')
    expect(refs).toContain('--ui-text-leading')
    expect(refs).toContain('--ui-text-color')
  })

  it('@scope :scope sets display:block, font-size/weight/line-height/color; NO frame law properties', () => {
    expect(stylesBlock).toMatch(/font-size:\s*var\(--ui-text-size\)/)
    expect(stylesBlock).toMatch(/font-weight:\s*var\(--ui-text-weight\)/)
    expect(stylesBlock).toMatch(/line-height:\s*var\(--ui-text-leading\)/)
    expect(stylesBlock).toMatch(/color:\s*var\(--ui-text-color\)/)
    expect(stylesBlock).toMatch(/display:\s*block/)
    // Display class: no control-frame law (no block-size, no padding-block, no min-inline-size)
    expect(stylesBlock).not.toMatch(/block-size:/)
    expect(stylesBlock).not.toMatch(/padding-block:/)
    expect(stylesBlock).not.toMatch(/min-inline-size:/)
  })

  it('user-select is ENABLED (text; the deliberate inverse of ui-button which disables it)', () => {
    expect(stylesBlock).toMatch(/user-select:\s*text/)
  })

  it('a forced-colors block keeps display text visible (CanvasText)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    expect(stylesBlock).toContain('CanvasText')
  })
})
