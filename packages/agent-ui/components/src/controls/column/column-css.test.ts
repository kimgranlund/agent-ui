import { describe, it, expect } from 'vitest'
// Read column.css as text (vite strips `.css?raw`; no `@types/node` devDep — same approach as the button probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// s4 — column.css static structural check (ADR-0003 sectioning + token hygiene; ADR-0016 flex/container-query).
// jsdom can't compute the rendered flex props (that's column.browser.test.ts); here we pin the STRUCTURE: the
// two sectioned blocks, that `:where()` DECLARES the `--ui-column-*` flex chain + the [attr] repoints, that
// `@scope` CONSUMES only it (role-pure — no raw `--c-*`), the `display:flex` + `flex-direction:column` identity,
// the `@container` reflow rule, and a forced-colors block. NEGATIVE control: a planted raw `--c-*` ref FAILS.

const css = readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/column/column.css`, 'utf8') as string
// The sectioned-banner test reads the RAW source (the banners live in comments); every other check reads the
// comment-STRIPPED code, so a prose mention of `--c-*`/`--ui-height-*` in a comment is not a false positive.
const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
const tokenBlock = code.slice(code.indexOf(':where(ui-column) {'), code.indexOf('@scope (ui-column) {'))
const stylesBlock = code.slice(code.indexOf('@scope (ui-column) {'))

/** Every `var(--token)` reference inside a block. */
const varRefs = (block: string): string[] => [...block.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)

describe('column.css — structure + token hygiene (s4)', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK') // sectioned banners distinguish declaration vs consumption
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-column\)/)
  })

  it('the :where() block DECLARES the full --ui-column-* flex chain (align/justify/gap/wrap)', () => {
    for (const slot of ['align', 'justify', 'gap', 'wrap']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-column-${slot}:`))
    }
    // gap reads the density-responsive --ui-space ladder (ADR-0015 cl.4), never a control dimension
    expect(tokenBlock).toContain('var(--ui-space-none)')
  })

  it('[align]/[justify]/[gap]/[wrap] attribute selectors repoint the tokens (the literal-union → CSS map)', () => {
    // ADR-0030: `start` is now a non-default → it has its own [align='start'] repoint to flex-start.
    // The [align='stretch'] rule is REMOVED (stretch is the base — no repoint needed).
    expect(tokenBlock).toMatch(/ui-column\[align='start'\]/) // the new non-default repoint (ADR-0030)
    expect(tokenBlock).not.toMatch(/ui-column\[align='stretch'\]/) // stretch = the base; no repoint needed
    expect(tokenBlock).toMatch(/ui-column\[align='center'\]/)
    expect(tokenBlock).toMatch(/ui-column\[justify='between'\]/) // between → space-between
    expect(tokenBlock).toContain('space-between')
    expect(tokenBlock).toMatch(/ui-column\[gap='md'\]/)
    expect(tokenBlock).toMatch(/var\(--ui-space-md\)/) // gap=md → the --ui-space-md step
    expect(tokenBlock).toMatch(/ui-column\[wrap\]/) // boolean-presence repoint
  })

  it('base token --ui-column-align is `stretch` (the new ADR-0030 default; [align="start"] repoints to flex-start)', () => {
    // The CSS base token must carry the prop default (ADR-0005: default is NOT reflected as an attribute).
    expect(tokenBlock).toMatch(/--ui-column-align:\s*stretch/) // base = stretch (ADR-0030 flip)
    // [align='start'] repoints to flex-start — the one non-default keyword needing a rule
    expect(tokenBlock).toMatch(/ui-column\[align='start'\][^{]*\{[^}]*--ui-column-align:\s*flex-start/)
  })

  it('@scope CONSUMES only --ui-column-* (role-pure — no fleet/role token leaks for a layout primitive)', () => {
    const refs = varRefs(stylesBlock)
    expect(refs.length).toBeGreaterThan(0)
    for (const v of refs) expect(v).toMatch(/^--ui-column-/) // a layout primitive reads ONLY its own chain
    // anti-vacuous: the four mapped flex tokens are actually consumed in @scope
    for (const slot of ['align', 'justify', 'gap', 'wrap']) {
      expect(refs).toContain(`--ui-column-${slot}`)
    }
  })

  it('is display:flex with flex-direction:column — the tag identity (ADR-0016 cl.2), NO control height', () => {
    expect(stylesBlock).toMatch(/display:\s*flex/)
    expect(stylesBlock).toMatch(/flex-direction:\s*column/)
    expect(stylesBlock).toMatch(/align-items:\s*var\(--ui-column-align\)/)
    expect(stylesBlock).toMatch(/justify-content:\s*var\(--ui-column-justify\)/)
    expect(stylesBlock).toMatch(/gap:\s*var\(--ui-column-gap\)/)
    expect(stylesBlock).toMatch(/flex-wrap:\s*var\(--ui-column-wrap\)/)
    // a layout primitive NEVER reads a control height (geometry.md Container/layout class)
    expect(code).not.toMatch(/--ui-height-/)
  })

  it('a @container inline-size reflow rule flips to a row under a wide container (ADR-0016 cl.4)', () => {
    expect(stylesBlock).toMatch(/@container\s*\(min-width:\s*[\d.]+rem\)/)
    const cq = stylesBlock.slice(stylesBlock.indexOf('@container'))
    expect(cq).toMatch(/flex-direction:\s*row/) // the axis flips under the wide container (the "switcher")
  })

  it('a forced-colors block drops the tonal wash', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('forced-colors'))
    expect(fc).toMatch(/background-image:\s*none/)
  })
})

describe('column.css — role-purity (no raw --c-* colour opinion) + the negative control', () => {
  it('holds ZERO raw --c-* role reference anywhere — the surface is the shared container.css’ job (ADR-0008)', () => {
    expect(code).not.toMatch(/--c-/) // column paints no colour; elevation/brightness flow through the shared seam
    expect(code).not.toContain('color-mix(') // no synthesized colour
  })

  it('the role-purity check BITES — a planted raw --c-* ref would be caught (synthetic negative control)', () => {
    // run the SAME predicate the real sheet passes over a planted snippet, proving the check is non-vacuous.
    const planted = '@scope (ui-column) { :scope { background: var(--c-neutral-surface); } }'
    const refs = varRefs(planted)
    expect(refs.some((v) => v.startsWith('--c-'))).toBe(true) // the leak is detected
    expect(refs.every((v) => v.startsWith('--ui-column-'))).toBe(false) // and it fails the role-pure rule
  })
})
