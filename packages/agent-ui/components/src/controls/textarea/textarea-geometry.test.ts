import { describe, it, expect } from 'vitest'
// Read textarea.css as TEXT — jsdom can't compute rendered px/colours; this pins the STRUCTURE + the
// declared calc()s (ADR-0134's own multi-line law, geometry.md §Mechanization: "a law without a probe is
// not enforced"). The rendered-px proof is textarea-geometry.browser.test.ts.
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/textarea/textarea.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-textarea) {'), css.indexOf('@scope (ui-textarea) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-textarea) {'))

const whereBlock = (marker: string): string => {
  const start = tokenBlock.indexOf(marker)
  return start < 0 ? '' : tokenBlock.slice(start, tokenBlock.indexOf('}', start))
}

// The fleet tokens read DIRECTLY in @scope (never repointed through the component chain — the text-field
// precedent, so every control draws the identical ring / uses the identical timing).
const sharedFleet = new Set([
  '--md-sys-color-focus-ring',
  '--ui-focus-ring-width',
  '--ui-focus-ring-offset',
  '--ui-motion-fast',
  '--ui-ease-standard',
])

const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !sharedFleet.has(v) && !/^--ui-textarea-/.test(v))

describe('textarea.css — structure + sectioning', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-textarea\)/)
  })

  it('the :where() block DECLARES the full --ui-textarea-* chain from colour roles + the font ramp', () => {
    for (const slot of ['border', 'bg', 'ink', 'placeholder', 'font', 'line-height', 'line-box', 'padding-block', 'padding-inline', 'min-block-size', 'radius', 'min-inline-size']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-textarea-${slot}:`))
    }
    expect(tokenBlock).toContain('var(--md-sys-color-neutral') // the field-frame roles (family = neutral)
    expect(tokenBlock).toContain('var(--ui-font-md)') // the font ramp (NOT --ui-height-* — no fixed height lever)
  })

  it('[size] repoints ONLY the font token (padding/line-box derive from it via calc — no separate repoint needed)', () => {
    for (const size of ['sm', 'lg'] as const) {
      const b = whereBlock(`:where(ui-textarea[size='${size}'])`)
      expect(b).toMatch(new RegExp(`--ui-textarea-font:\\s*var\\(--ui-font-${size}\\)`))
    }
  })

  it('NEGATIVE control: a foreign (non-fleet, non-own-chain) var() ref in @scope is caught', () => {
    const planted = ':scope { color: var(--some-random-token); }'
    expect(foreignScopeRefs(planted)).toEqual(['--some-random-token'])
    expect(foreignScopeRefs(stylesBlock)).toEqual([]) // the real file stays clean
  })
})

describe('textarea.css — the MULTI-LINE geometry law (ADR-0134 — the inversion of the single-line Control lookup)', () => {
  it('min-block-size is a GROWABLE MINIMUM (rows × line-box + 2·block-padding) — never a fixed §1-row height', () => {
    expect(tokenBlock).toMatch(
      /--ui-textarea-min-block-size:\s*calc\(var\(--ui-textarea-rows\)\s*\*\s*var\(--ui-textarea-line-box\)\s*\+\s*2\s*\*\s*var\(--ui-textarea-padding-block\)\)/,
    )
    expect(stylesBlock).toMatch(/min-block-size:\s*var\(--ui-textarea-min-block-size\)/)
    expect(stylesBlock).not.toMatch(/block-size:\s*var\(--ui-textarea-height\)/) // no fixed-height token exists at all
  })

  it('padding-block is REAL (never 0) — the inversion of the single-line law', () => {
    const m = stylesBlock.match(/padding-block:\s*([^;]+);/)
    expect(m, 'padding-block must be declared').not.toBeNull()
    expect((m as RegExpMatchArray)[1]?.trim()).toBe('var(--ui-textarea-padding-block)')
    expect(tokenBlock).toMatch(/--ui-textarea-padding-block:\s*calc\(var\(--ui-textarea-font\)/) // non-zero, font-derived
  })

  it('a prose line-height is declared — never the single-line control line-height:1', () => {
    expect(tokenBlock).toMatch(/--ui-textarea-line-height:\s*1\.5/)
    expect(stylesBlock).toMatch(/line-height:\s*var\(--ui-textarea-line-height\)/)
    expect(stylesBlock).not.toMatch(/line-height:\s*var\(--ui-control-line-height\)/) // never the single-line constant
    expect(stylesBlock).not.toMatch(/line-height:\s*1\s*;/) // never a bare 1
  })

  it('align-items:start is NOT used (block layout, not a centring grid) — the editor sits at the top via normal flow', () => {
    // ADR-0134: "text at top-left, not vertically centred". This control uses `display:block` (no
    // adornment slots to centre), so top-alignment is the ABSENCE of any centring rule, not an explicit
    // align-items:start on a flex/grid host. Assert no vertical-centring rule leaked in from the text-field
    // precedent (align-items:center would be the single-line law's centring, wrong here).
    const hostBlock = stylesBlock.slice(stylesBlock.indexOf(':scope {'), stylesBlock.indexOf('}', stylesBlock.indexOf(':scope {')))
    expect(hostBlock).not.toMatch(/align-items:\s*center/)
  })

  it('resize:vertical + overflow-y:auto (native <textarea> parity, ADR-0134)', () => {
    const hostBlock = stylesBlock.slice(stylesBlock.indexOf(':scope {'), stylesBlock.indexOf('}', stylesBlock.indexOf(':scope {')))
    expect(hostBlock).toMatch(/resize:\s*vertical/)
    expect(hostBlock).toMatch(/overflow-y:\s*auto/)
  })

  it('white-space:pre-wrap on the editor — multi-line wraps AND preserves newlines (the nowrap inversion)', () => {
    const editorBlock = stylesBlock.slice(
      stylesBlock.indexOf(":scope > [data-part='editor'] {"),
      stylesBlock.indexOf('}', stylesBlock.indexOf(":scope > [data-part='editor'] {")),
    )
    expect(editorBlock).toMatch(/white-space:\s*pre-wrap/)
    expect(editorBlock).not.toMatch(/white-space:\s*nowrap/)
  })

  it('min-inline-size reuses the ~20ch entry-control typing-width floor (ADR-0021 parity)', () => {
    expect(tokenBlock).toMatch(/--ui-textarea-min-inline-size:\s*20ch/)
    expect(stylesBlock).toMatch(/min-inline-size:\s*var\(--ui-textarea-min-inline-size\)/)
  })

  it('radius reuses the fixed --ui-radius-base entry-control referent (geometry.md "Corner radius")', () => {
    expect(tokenBlock).toMatch(/--ui-textarea-radius:\s*var\(--ui-radius-base\)/)
    expect(stylesBlock).toMatch(/border-radius:\s*var\(--ui-textarea-radius\)/)
  })

  it('disabled repoints resize:none (a disabled surface is not user-resizable)', () => {
    const disabledBlock = stylesBlock.slice(
      stylesBlock.indexOf(":scope:is([disabled], :state(disabled)) {"),
      stylesBlock.indexOf('}', stylesBlock.indexOf(":scope:is([disabled], :state(disabled)) {")),
    )
    expect(disabledBlock).toMatch(/resize:\s*none/)
  })
})

describe('textarea.css — the BORDER-channel state ladder + focus ring (ADR-0014 cl.2c/dev#1, reused verbatim)', () => {
  it('declares the full border ladder from the PINNED roles: idle/hover/focus/invalid/invalid+hover', () => {
    const b = whereBlock(':where(ui-textarea) {')
    expect(b).toMatch(/--ui-textarea-border:\s*var\(--md-sys-color-neutral\)/)
    expect(b).toMatch(/--ui-textarea-border-hover:\s*var\(--md-sys-color-neutral-high\)/)
    expect(b).toMatch(/--ui-textarea-border-focus:\s*transparent/)
    expect(b).toMatch(/--ui-textarea-border-invalid:\s*var\(--md-sys-color-danger\)/)
    expect(b).toMatch(/--ui-textarea-border-invalid-hover:\s*var\(--md-sys-color-danger-high\)/)
  })

  it(':focus-within (not :focus-visible) draws the shared outline ring and steps the border transparent', () => {
    const focusBlock = stylesBlock.slice(
      stylesBlock.indexOf(':scope:focus-within {'),
      stylesBlock.indexOf('}', stylesBlock.indexOf(':scope:focus-within {')),
    )
    expect(focusBlock).toMatch(/border-color:\s*var\(--ui-textarea-border-focus\)/)
    expect(focusBlock).toMatch(/outline:\s*var\(--ui-focus-ring-width\)\s*solid\s*var\(--md-sys-color-focus-ring\)/)
  })

  it('disabled is a role-REPOINT (not opacity)', () => {
    const b = whereBlock(':where(ui-textarea:is([disabled], :state(disabled))) {')
    expect(b).toMatch(/--ui-textarea-bg:\s*var\(--md-sys-color-neutral-surface-high\)/)
    expect(b).not.toMatch(/opacity/)
  })
})
