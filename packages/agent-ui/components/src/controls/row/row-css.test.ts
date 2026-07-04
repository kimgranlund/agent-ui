import { describe, it, expect } from 'vitest'
// Read row.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the button s7 probe).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s3 — row.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0016 flex + container-query).
// jsdom can NOT compute layout px — the rendered-px CHANGE (align/justify/gap, the @container reflow) is
// row.browser.test.ts. Here we pin the STRUCTURE: the two sectioned blocks, that `:where()` DECLARES the
// `--ui-row-*` chain + the attribute repoints, that `@scope` CONSUMES only `--ui-row-*` (role-pure — NO raw
// `--md-sys-color-*`, the surface is delegated to the shared container.css), the row-identity flex, the `@container`
// reflow, and a forced-colors block. NEGATIVE control: a planted `--md-sys-color-*` ref trips the hygiene checker.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/row/row.css`, 'utf8') as string
const tokenBlock = css.slice(css.indexOf(':where(ui-row) {'), css.indexOf('@scope (ui-row) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-row) {'))

// The @scope token-hygiene allowlist (decomp s3): a layout primitive's styles block consumes ONLY its own
// `--ui-row-*` chain, the shared `--ui-container-*` surface seam, and the `--ui-space-*` ladder — never a raw
// `--md-sys-color-*` colour role (those enter the chain in the token layer / container.css, ADR-0008 role-purity).
const ALLOWED = /^--ui-(?:row|container|space)-/
const scopeViolations = (block: string): string[] =>
  [...block.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string).filter((ref) => !ALLOWED.test(ref))

describe('row.css — structure + sectioning (ADR-0003) (s3)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-row\)/)
  })

  it('the :where() block DECLARES the --ui-row-* chain (align/justify/gap/wrap/radius)', () => {
    for (const slot of ['align', 'justify', 'gap', 'wrap', 'radius']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-row-${slot}:`))
    }
    expect(tokenBlock).toMatch(/--ui-row-radius:\s*var\(--ui-radius-base\)/) // the shared fleet radius (ADR-0015 cl.5)
  })

  it('@scope sets display:flex with the ROW identity (flex-direction: row — direction is the tag, ADR-0016 cl.2)', () => {
    expect(stylesBlock).toMatch(/display:\s*flex/)
    expect(stylesBlock).toMatch(/flex-direction:\s*row/)
    // consumes the grammar via the --ui-row-* chain (the computed px is the browser smoke)
    expect(stylesBlock).toMatch(/align-items:\s*var\(--ui-row-align\)/)
    expect(stylesBlock).toMatch(/justify-content:\s*var\(--ui-row-justify\)/)
    expect(stylesBlock).toMatch(/gap:\s*var\(--ui-row-gap\)/)
    expect(stylesBlock).toMatch(/flex-wrap:\s*var\(--ui-row-wrap\)/)
    expect(stylesBlock).toMatch(/border-radius:\s*var\(--ui-row-radius\)/)
  })
})

describe('row.css — the flex grammar repoints (ADR-0016 cl.1) (s3)', () => {
  it('align → align-items keywords (1:1: center/end/stretch/baseline)', () => {
    expect(tokenBlock).toMatch(/ui-row\[align='center'\]\)\s*\{\s*--ui-row-align:\s*center/)
    expect(tokenBlock).toMatch(/ui-row\[align='baseline'\]\)\s*\{\s*--ui-row-align:\s*baseline/)
  })

  it('justify → justify-content, with between/around/evenly crossing to the space-* forms', () => {
    expect(tokenBlock).toMatch(/ui-row\[justify='between'\]\)\s*\{\s*--ui-row-justify:\s*space-between/)
    expect(tokenBlock).toMatch(/ui-row\[justify='around'\]\)\s*\{\s*--ui-row-justify:\s*space-around/)
    expect(tokenBlock).toMatch(/ui-row\[justify='evenly'\]\)\s*\{\s*--ui-row-justify:\s*space-evenly/)
  })

  it('gap → the --ui-space ladder: each step repoints to the matching --ui-space-{step}', () => {
    for (const step of ['xs', 'sm', 'md', 'lg', 'xl', '2xl']) {
      expect(tokenBlock).toMatch(new RegExp(`ui-row\\[gap='${step}'\\]\\)\\s*\\{\\s*--ui-row-gap:\\s*var\\(--ui-space-${step}\\)`))
    }
    expect(tokenBlock).toMatch(/--ui-row-gap:\s*var\(--ui-space-none\)/) // the default (no-gap) maps to the none step
  })

  it('wrap → flex-wrap via boolean presence ([wrap] repoints to wrap)', () => {
    expect(tokenBlock).toMatch(/ui-row\[wrap\]\)\s*\{\s*--ui-row-wrap:\s*wrap/)
    expect(tokenBlock).toMatch(/--ui-row-wrap:\s*nowrap/) // the default
  })
})

describe('row.css — container-query reflow + forced-colors (ADR-0016 cl.4) (s3)', () => {
  it('a @container (inline-size …) rule reflows the row to a COLUMN under a narrow OWN-container width', () => {
    expect(stylesBlock).toMatch(/@container \(inline-size/) // queries the row's own query container (no breakpoint prop)
    const cq = stylesBlock.slice(stylesBlock.indexOf('@container'))
    expect(cq).toMatch(/:scope\s*\{\s*flex-direction:\s*column/) // wraps to a column (the ADR's named example)
  })

  it('a forced-colors block keeps a surfaced row neutral (surface survives WHCM)', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors'))
    expect(fc).toMatch(/background-color:\s*Canvas/)
    expect(fc).toMatch(/background-image:\s*none/)
  })
})

describe('row.css — token hygiene: role-pure, NO raw --md-sys-color-* (ADR-0008) (s3)', () => {
  it('@scope CONSUMES only the --ui-{row,container,space}-* chain — no raw --md-sys-color-* colour role', () => {
    const refs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(refs.length).toBeGreaterThan(0) // anti-vacuous: the styles block actually reads tokens
    expect(refs.some((r) => r.startsWith('--ui-row-'))).toBe(true) // it reads its OWN chain
    expect(scopeViolations(stylesBlock)).toEqual([]) // and nothing outside the allowlist
  })

  it('the WHOLE sheet reads no raw --md-sys-color-* — colour is delegated entirely to the shared surface seam', () => {
    expect(css).not.toContain('var(--md-sys-color-') // ui-row holds zero colour opinion (container.css owns the plane)
    expect(css).not.toContain('color-mix(') // and never synthesizes a shade (ADR-0008)
  })

  it('NEGATIVE control: a planted raw --md-sys-color-* ref in the styles block FAILS the hygiene checker', () => {
    // a synthetic styles block with a colour-role leak — proves scopeViolations actually BITES (not vacuous).
    const planted = '@scope (ui-row) { :scope { background: var(--md-sys-color-neutral-surface); gap: var(--ui-row-gap); } }'
    expect(scopeViolations(planted)).toContain('--md-sys-color-neutral-surface')
    expect(scopeViolations(stylesBlock)).not.toContain('--md-sys-color-neutral-surface') // the real sheet is clean
  })
})
