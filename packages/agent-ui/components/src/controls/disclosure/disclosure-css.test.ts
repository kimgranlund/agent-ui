import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// content-family M1-a — disclosure.css static structural check (ADR-0003 sectioning + token hygiene;
// SPEC-R18 the chevron/no-animation fences; SPEC-R19 the geometry.md Pattern-class split: the summary
// row is density-INVARIANT frame, the body padding is density-RESPONSIVE rhythm). jsdom can't compute
// rendered colours/px/rotation — that is disclosure.browser.test.ts's cross-engine smoke; these pin the
// STRUCTURE + the CSS text.

const css = readFileSync(
  `${process.cwd()}/packages/agent-ui/components/src/controls/disclosure/disclosure.css`,
  'utf8',
) as string
const tokenBlock = css.slice(css.indexOf(':where(ui-disclosure) {'), css.indexOf('@scope (ui-disclosure) {'))
const stylesBlock = css.slice(css.indexOf('@scope (ui-disclosure) {'))

// Comments are stripped before a grep-able-ABSENCE check (the family-coherence.test.ts precedent) — a
// prose comment explaining WHY a selector/property is absent must never itself trip the probe meant to
// catch a real one.
const stripCssComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '')

// The shared fleet constants every control may read DIRECTLY (the button.css/select.css exception to
// "consume only --ui-disclosure-*") — the focus-ring pair (ADR-0009) + the single-line Control
// line-height constant (ADR-0036, the same exemption button-css.test.ts records).
const sharedSeam = new Set([
  '--ui-focus-ring-width',
  '--md-sys-color-focus-ring',
  '--ui-focus-ring-offset',
  '--ui-control-line-height',
])

/** @scope token-hygiene predicate — every var() ref that is NEITHER the own --ui-disclosure-* chain NOR the shared seam. */
const foreignScopeRefs = (scope: string): string[] =>
  [...scope.matchAll(/var\((--[\w-]+)/g)]
    .map((m) => m[1] as string)
    .filter((v) => !sharedSeam.has(v) && !/^--ui-disclosure-/.test(v))

describe('disclosure.css — structure + sectioning', () => {
  it('is two SECTIONED blocks: a :where() token block then an @scope styles block', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(css).toContain('[1] TOKEN BLOCK')
    expect(css).toContain('[2] STYLES BLOCK')
    expect(tokenBlock.length).toBeGreaterThan(0)
    expect(stylesBlock).toMatch(/@scope \(ui-disclosure\)/)
  })

  it('the :where() block DECLARES the --ui-disclosure-* chain from roles + the dimensional ramp', () => {
    for (const slot of ['height', 'font', 'ink', 'glyph', 'gap', 'body-pad-block', 'body-pad-inline']) {
      expect(tokenBlock).toMatch(new RegExp(`--ui-disclosure-${slot}:`))
    }
    // Pattern-class split (geometry.md): the summary row is the CONTROL band (frame, density-invariant);
    // the body padding is the --ui-space LAYOUT ladder (density-responsive) — never interchanged.
    expect(tokenBlock).toMatch(/--ui-disclosure-height:\s*var\(--ui-height-md\)/)
    expect(tokenBlock).toMatch(/--ui-disclosure-font:\s*var\(--ui-font-md\)/)
    expect(tokenBlock).toMatch(/--ui-disclosure-glyph:\s*var\(--ui-disclosure-font\)/) // = font, the inline-affordance law
    expect(tokenBlock).toMatch(/--ui-disclosure-body-pad-block:\s*var\(--ui-space-/)
    expect(tokenBlock).toMatch(/--ui-disclosure-body-pad-inline:\s*var\(--ui-space-/)
  })

  it('NO [size]/[scale] attribute-selector ramp (ui-disclosure exposes no `size` axis, family-coherence A2b)', () => {
    expect(stripCssComments(css)).not.toMatch(/\[size[=\]]/)
  })
})

describe('disclosure.css — the @scope geometry law (Pattern-class split)', () => {
  it('the summary row: block-size off the ramp, padding-block: 0 (the centering law, geometry.md)', () => {
    const m = stylesBlock.match(/:scope \[data-part='summary'\]\s*\{([^}]*)\}/)
    expect(m, 'the summary rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/block-size:\s*var\(--ui-disclosure-height\)/)
    expect(rule).toMatch(/padding-block:\s*0/) // NEVER block-padding as the sizing lever
    expect(rule).toMatch(/padding-inline-start:\s*calc\(var\(--ui-disclosure-height\)\s*\/\s*2\)/) // h/2 slotless edge
    expect(rule).toMatch(/line-height:\s*var\(--ui-control-line-height\)/) // ADR-0036 single-line control standard
  })

  it('the chevron is sized = font (--ui-disclosure-glyph), never the icon ramp (--ui-icon-*)', () => {
    const m = stylesBlock.match(/:scope \[data-part='chevron'\]\s*\{([^}]*)\}/)
    expect(m, 'the chevron rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/inline-size:\s*var\(--ui-disclosure-glyph\)/)
    expect(rule).toMatch(/block-size:\s*var\(--ui-disclosure-glyph\)/)
    expect(css).not.toMatch(/--ui-disclosure-glyph:\s*var\(--ui-icon-/) // never the content-icon ramp (geometry.md bug class)
  })

  it('the chevron rotates 90deg under [open] — orientation carries the state, not colour', () => {
    expect(stylesBlock).toMatch(/\[data-part='details'\]\[open\][^{]*\[data-part='chevron'\][^{]*\{\s*rotate:\s*90deg/)
  })

  it('the body padding rides --ui-space (density-responsive rhythm), never --ui-height-* (the frame ramp)', () => {
    const m = stylesBlock.match(/:scope \[data-part='body'\]\s*\{([^}]*)\}/)
    expect(m, 'the body rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/padding-block:\s*var\(--ui-disclosure-body-pad-block\)/)
    expect(rule).toMatch(/padding-inline:\s*var\(--ui-disclosure-body-pad-inline\)/)
    expect(rule).not.toMatch(/--ui-height-/)
  })
})

describe('disclosure.css — the v1 fences (SPEC-R18): no fold animation, no chevron transition', () => {
  it('grep-able absence: no `transition`/`animation`/`::details-content` rule anywhere in the sheet', () => {
    const code = stripCssComments(css)
    expect(code).not.toMatch(/transition\s*:/)
    expect(code).not.toMatch(/animation\s*:/)
    expect(code).not.toMatch(/::details-content/)
  })
})

describe('disclosure.css — the shared focus ring (ADR-0009) + token hygiene', () => {
  it('the summary draws the ONE shared fleet focus ring on :focus-visible', () => {
    const m = stylesBlock.match(/:scope \[data-part='summary'\]:focus-visible\s*\{([^}]*)\}/)
    expect(m, 'the summary focus-visible rule is missing').not.toBeNull()
    const rule = (m as RegExpMatchArray)[1]
    expect(rule).toMatch(/outline:\s*var\(--ui-focus-ring-width\)\s+solid\s+var\(--md-sys-color-focus-ring\)/)
    expect(rule).toMatch(/outline-offset:\s*var\(--ui-focus-ring-offset\)/)
  })

  it('@scope CONSUMES only the own --ui-disclosure-* chain + the shared focus-ring seam', () => {
    expect(foreignScopeRefs(stylesBlock)).toEqual([])
    const allRefs = [...stylesBlock.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string)
    expect(allRefs.some((v) => /^--ui-disclosure-/.test(v))).toBe(true) // anti-vacuous: the own chain IS consumed
  })

  it('NEGATIVE control: a planted raw-primitive --md-sys-color-* ref in @scope is CAUGHT by the hygiene predicate', () => {
    const planted = "@scope (ui-disclosure) { :scope [data-part='summary'] { color: var(--md-sys-color-neutral-on-surface); } }"
    expect(foreignScopeRefs(planted)).toEqual(['--md-sys-color-neutral-on-surface'])
  })
})

describe('disclosure.css — forced-colors survival', () => {
  it('a forced-colors block keeps the summary/host ink visible as CanvasText', () => {
    expect(stylesBlock).toMatch(/@media \(forced-colors: active\)/)
    const fc = stylesBlock.slice(stylesBlock.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/color:\s*CanvasText/)
  })
})
