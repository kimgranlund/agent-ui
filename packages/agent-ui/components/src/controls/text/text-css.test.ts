import { describe, it, expect } from 'vitest'
// Read text.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the s6/s7 probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// ADR-0078 — text.css static structural check (the two-block shape + token hygiene + the 9×3 role/size
// matrix; cl.3). The rendered-px CHANGE is text.browser.test.ts; here we pin the STRUCTURE: the two
// sectioned blocks, that `:where()` DECLARES the `--ui-text-*` chain from `--md-sys-typescale-*`, that the
// base `@scope :scope` rule CONSUMES only `--ui-text-*`, the [variant][size] matrix repoints (including the
// `:not([variant])` body legs), the editorial treatments, the stamp-transparency reset, zero `--ui-type-`
// survivors, and a forced-colors block.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/text/text.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-text) {'), css.indexOf('@scope (ui-text) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-text) {'))
const baseScopeRule = (stylesBlock.match(/:scope\s*\{[^}]*\}/) ?? [''])[0] // the FIRST :scope{} — the base typography rule

const ROLES = ['display', 'headline', 'title', 'label', 'kicker', 'overline', 'quote', 'lead'] as const // the 8 non-body roles
const ALL_VARIANTS = ['display', 'headline', 'title', 'body', 'label', 'kicker', 'overline', 'quote', 'lead'] as const
const SIZE_ROW = { sm: 'small', md: 'medium', lg: 'large' } as const

describe('text.css — structure + token hygiene (ADR-0078 cl.3)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-text\)/)
  })

  it('the :where(ui-text) base block DECLARES all five --ui-text-* component tokens, defaulting to body-medium', () => {
    for (const slot of ['size', 'weight', 'line-height', 'tracking', 'color']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-text-${slot}:`))
    }
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-medium-size)')
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-medium-weight)')
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-medium-line-height)')
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-medium-tracking)')
    expect(tokenBlock).toContain('var(--md-sys-color-neutral-on-surface)')
  })

  it('8 ROLE blocks repoint [variant] alone to the -medium row (md default) — body has NO standalone role block', () => {
    for (const role of ROLES) {
      expect(tokenBlock, `missing [variant='${role}'] role block`).toMatch(new RegExp(`\\[variant='${role}'\\]\\)\\s*\\{`))
      expect(tokenBlock).toContain(`var(--md-sys-typescale-${role}-medium-size)`)
      expect(tokenBlock).toContain(`var(--md-sys-typescale-${role}-medium-weight)`)
      expect(tokenBlock).toContain(`var(--md-sys-typescale-${role}-medium-line-height)`)
      expect(tokenBlock).toContain(`var(--md-sys-typescale-${role}-medium-tracking)`)
    }
    // body is the BASE default (no `:where(ui-text[variant='body']) {` block) — only compound
    // [variant='body'][size=...] size-override selectors mention it (checked below).
    expect(tokenBlock).not.toMatch(/\[variant='body'\]\)\s*\{/)
  })

  it("18 SIZE-OVERRIDE blocks (9 variants × sm/lg) repoint [variant][size] to the -small/-large row", () => {
    for (const variant of ALL_VARIANTS) {
      for (const size of ['sm', 'lg'] as const) {
        const row = SIZE_ROW[size]
        if (variant === 'body') continue // body's absent-variant law is checked separately below
        const re = new RegExp(`\\[variant='${variant}'\\]\\[size='${size}'\\]\\)\\s*\\{`)
        expect(tokenBlock, `missing [variant='${variant}'][size='${size}'] override`).toMatch(re)
        expect(tokenBlock).toContain(`var(--md-sys-typescale-${variant}-${row}-size)`)
        expect(tokenBlock).toContain(`var(--md-sys-typescale-${variant}-${row}-weight)`)
        expect(tokenBlock).toContain(`var(--md-sys-typescale-${variant}-${row}-line-height)`)
        expect(tokenBlock).toContain(`var(--md-sys-typescale-${variant}-${row}-tracking)`)
      }
    }
    // anti-vacuous: 18 total compound [variant='x'][size='y'] selector fragments in the token block — the
    // 16 non-body ones checked above, PLUS body's own two (the second alternative of its :not([variant])
    // compound selector, checked separately below), 9 roles × 2 sizes = 18.
    const compoundCount = (tokenBlock.match(/\[variant='[\w]+'\]\[size='(?:sm|lg)'\]\)/g) ?? []).length
    expect(compoundCount).toBe(18)
  })

  it("the attribute-absence law: body's sm/lg overrides ALSO cover a bare <ui-text size='sm'|'lg'> (:not([variant]))", () => {
    const smRe = /:where\(ui-text\[size='sm'\]:not\(\[variant\]\),\s*ui-text\[variant='body'\]\[size='sm'\]\)/
    const lgRe = /:where\(ui-text\[size='lg'\]:not\(\[variant\]\),\s*ui-text\[variant='body'\]\[size='lg'\]\)/
    expect(tokenBlock, 'missing the absent-variant body/sm compound selector').toMatch(smRe)
    expect(tokenBlock, 'missing the absent-variant body/lg compound selector').toMatch(lgRe)
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-small-size)')
    expect(tokenBlock).toContain('var(--md-sys-typescale-body-large-size)')
  })

  it('zero --ui-type- DECLARATION survivors (the retired ADR-0025 single-axis family)', () => {
    // comment-stripped + a declaration-shaped regex (the dimensions.test.ts precedent) — a historical
    // prose mention of the retired name in a comment (this file's own header) must NOT trip the guard.
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare).not.toMatch(/--ui-type-[\w-]+:/)
    expect(bare).not.toMatch(/var\(--ui-type-/)
  })

  it('the base @scope :scope rule consumes ONLY --ui-text-* for its typography properties', () => {
    expect(baseScopeRule.length).toBeGreaterThan(0)
    const refs = [...baseScopeRule.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) expect(v, `base :scope consumed non-component token: ${v}`).toMatch(/^--ui-text-/)
    expect(refs).toEqual(expect.arrayContaining(['--ui-text-size', '--ui-text-weight', '--ui-text-line-height', '--ui-text-tracking', '--ui-text-color']))
  })

  it('base :scope sets display:block, font-size/weight/line-height/letter-spacing/color; NO frame law properties', () => {
    expect(baseScopeRule).toMatch(/font-size:\s*var\(--ui-text-size\)/)
    expect(baseScopeRule).toMatch(/font-weight:\s*var\(--ui-text-weight\)/)
    expect(baseScopeRule).toMatch(/line-height:\s*var\(--ui-text-line-height\)/)
    expect(baseScopeRule).toMatch(/letter-spacing:\s*var\(--ui-text-tracking\)/)
    expect(baseScopeRule).toMatch(/color:\s*var\(--ui-text-color\)/)
    expect(baseScopeRule).toMatch(/display:\s*block/)
    expect(baseScopeRule).not.toMatch(/block-size:/)
    expect(baseScopeRule).not.toMatch(/padding-block:/)
    expect(baseScopeRule).not.toMatch(/min-inline-size:/)
  })

  it('user-select is ENABLED (text; the deliberate inverse of ui-button which disables it)', () => {
    expect(baseScopeRule).toMatch(/user-select:\s*text/)
  })

  it('kicker/overline get text-transform: uppercase (cl.2b editorial treatment)', () => {
    expect(stylesBlock).toMatch(/:scope\[variant='kicker'\],\s*\n?\s*:scope\[variant='overline'\][\s\S]{0,40}text-transform:\s*uppercase/)
  })

  it("quote gets italic + an inline-start rule (--md-sys-color-neutral-outline-variant) + an indent (--ui-space-md)", () => {
    const quoteRule = (stylesBlock.match(/:scope\[variant='quote'\]\s*\{[^}]*\}/) ?? [''])[0]
    expect(quoteRule.length).toBeGreaterThan(0)
    expect(quoteRule).toMatch(/font-style:\s*italic/)
    expect(quoteRule).toMatch(/border-inline-start:\s*3px solid var\(--md-sys-color-neutral-outline-variant\)/)
    expect(quoteRule).toMatch(/padding-inline-start:\s*var\(--ui-space-md\)/)
  })

  it('the stamp-transparency reset (cl.4) resets margin/font/letter-spacing/color to inherit for every stampable tag', () => {
    const resetRule = (stylesBlock.match(/:scope > :is\([^)]*\)\s*\{[^}]*\}/) ?? [''])[0]
    expect(resetRule.length).toBeGreaterThan(0)
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'span']) {
      expect(resetRule, `stamp reset selector missing ${tag}`).toContain(tag)
    }
    expect(resetRule).toMatch(/margin:\s*0/)
    expect(resetRule).toMatch(/font:\s*inherit/)
    expect(resetRule).toMatch(/letter-spacing:\s*inherit/)
    expect(resetRule).toMatch(/color:\s*inherit/)
  })

  it('a forced-colors block keeps display text visible (CanvasText)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    expect(stylesBlock).toContain('CanvasText')
  })
})
