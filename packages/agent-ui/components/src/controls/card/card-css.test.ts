import { describe, it, expect } from 'vitest'
// Read card.css as TEXT (no @types/node devDep — same approach as the button/text-field css probes).
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// G9 s7 — card.css token-hygiene + structure (ADR-0003 sectioning · ADR-0008 role-purity · ADR-0015 the
// own-default surface · forced-colors). jsdom can't compute the rendered px — these pin the CSS TEXT: the
// colour roles + shared ramps enter ONLY in the `:where()` TOKEN blocks; the STYLES blocks (@scope + the
// region anatomy) consume ONLY the own --ui-card-* chain (+ the role-pure --ui-container-* surface seam). The
// rendered surface + forced-colors survival is the cross-engine card.browser.test.ts.

// Strip CSS block comments — a `var(--md-sys-color-…)` mentioned in a banner/comment is DOCUMENTATION, not a live
// reference, and must not pollute the role-leak / hygiene scans (the banner names --md-sys-color-neutral-surface in prose).
const css = (readFileSync(`${process.cwd()}/packages/agent-ui/components/src/controls/card/card.css`, 'utf8') as string)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')

/** A flat `:where(...) {` token block — marker to its first closing brace. Requires the marker to open its
 * OWN line (only leading indentation before it, since the file's rule bodies are 2-space indented) — a genuine
 * selector, never a same-text tail nested inside an unrelated compound selector (e.g. `@scope (ui-card)`'s
 * `… > :where(ui-card-content) {` scroll-mode leg shares the literal substring `:where(ui-card-content) {` with
 * the REAL top-level token block declared further down the file). */
const whereBlock = (marker: string): string => {
  let from = 0
  for (;;) {
    const start = css.indexOf(marker, from)
    if (start < 0) return ''
    const lineStart = css.lastIndexOf('\n', start - 1) + 1
    if (/^\s*$/.test(css.slice(lineStart, start))) return css.slice(start, css.indexOf('}', start))
    from = start + 1
  }
}

/** A brace-balanced block INCLUDING its marker (handles the nested rules inside an @scope). */
const balancedBlock = (marker: string): string => {
  const at = css.indexOf(marker)
  if (at < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1)
  }
  return css.slice(at)
}

const cardTokens = whereBlock(':where(ui-card) {')
const scopeCard = balancedBlock('@scope (ui-card)')
const scopeContent = balancedBlock('@scope (ui-card-content)')

// A consumption block may read ONLY the own --ui-card-* chain + the role-pure container surface seam
// (--ui-container-*, ADR-0015 cl.2) — never a raw --md-sys-color-* role nor a shared ramp (--ui-space-*/--ui-radius-base).
const allowed = (v: string): boolean => /^--ui-card-/.test(v) || /^--ui-container-/.test(v)
const foreignRefs = (block: string): string[] =>
  [...block.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] as string).filter((v) => !allowed(v))

describe('card.css — sectioned, single-sheet family (ADR-0003)', () => {
  it('covers all four elements with TOKEN + STYLES sections', () => {
    expect(css.length).toBeGreaterThan(0)
    expect(cardTokens.length).toBeGreaterThan(0)
    expect(scopeCard).toMatch(/@scope \(ui-card\)/)
    expect(scopeContent).toMatch(/@scope \(ui-card-content\)/)
    // the shared header/footer anatomy + the content/footer token blocks are present
    expect(css).toContain(':where(ui-card-header, ui-card-footer)')
    expect(css).toContain(':where(ui-card-content)')
  })
})

describe('card.css — role-purity: --md-sys-color-* roles + ramps live ONLY in the TOKEN blocks', () => {
  it('the card seeds its OWN default surface --ui-container-bg from --md-sys-color-neutral-surface', () => {
    // ADR-0015: the base seam defaults transparent; an un-elevated card must still read as a surface.
    expect(cardTokens).toMatch(/--ui-container-bg:\s*var\(--md-sys-color-neutral-surface\)/)
  })

  it('the border role is --md-sys-color-neutral-outline-variant (a hairline neutral frame)', () => {
    expect(cardTokens).toMatch(/--ui-card-border:\s*var\(--md-sys-color-neutral-outline-variant\)/)
  })

  it('EVERY --md-sys-color-* role reference lives inside the :where(ui-card) token block (none leaks to a STYLES rule)', () => {
    const allRoleRefs = [...css.matchAll(/var\((--md-sys-color-[\w-]+)/g)].map((m) => m[1] as string).sort()
    const tokenRoleRefs = [...cardTokens.matchAll(/var\((--md-sys-color-[\w-]+)/g)].map((m) => m[1] as string).sort()
    expect(allRoleRefs.length).toBeGreaterThan(0) // anti-vacuous — roles ARE used
    expect(allRoleRefs).toEqual(tokenRoleRefs) // and ALL of them are confined to the token block
  })

  it('NEVER a color-mix (a mix ratio is a component colour opinion — ADR-0008)', () => {
    expect(css).not.toContain('color-mix(')
  })
})

describe('card.css — @scope token hygiene (consume only --ui-card-* / --ui-container-*)', () => {
  it('@scope (ui-card) consumes ONLY the own --ui-card-* chain', () => {
    expect(foreignRefs(scopeCard)).toEqual([])
    // anti-vacuous: the own chain IS consumed (padding/radius/border drive the frame)
    expect(scopeCard).toMatch(/var\(--ui-card-/)
  })

  it('@scope (ui-card-content) consumes ONLY the own --ui-card-* chain (the content rhythm gap)', () => {
    expect(foreignRefs(scopeContent)).toEqual([])
    // anti-vacuous: the own chain IS consumed (the 8px content rhythm). REVISED 2026-07-04: the fade mask
    // itself no longer lives here at all — --ui-card-fade is gone (see the scroll-fade describe below).
    expect(scopeContent).toMatch(/var\(--ui-card-content-gap\)/)
  })

  it('NEGATIVE control: a planted raw --md-sys-color-* ref in a styles block is CAUGHT by the hygiene predicate', () => {
    const planted = '@scope (ui-card) { :scope { border-color: var(--md-sys-color-neutral-outline); } }'
    expect(foreignRefs(planted)).toEqual(['--md-sys-color-neutral-outline'])
  })
})

describe('card.css — region-less humane default (ADR-0056)', () => {
  // jsdom cannot evaluate :has() (no cascade truth here) — these pin the DECLARED rule + its token hygiene;
  // the rendered flip (bare→padded, region→unchanged, the streaming re-evaluation) is card.browser.test.ts.
  const fallbackMarker = ':scope:not(:has(> ui-card-header, > ui-card-content, > ui-card-footer))'
  const fallbackBlock = whereBlock(`${fallbackMarker} {`)

  it('the fallback leg exists inside @scope (ui-card), keyed off the same three region tags as the row legs', () => {
    expect(scopeCard).toContain(fallbackMarker)
    expect(fallbackBlock.length).toBeGreaterThan(0)
  })

  it('the fallback consumes ONLY the region-equivalent --ui-card-* tokens (the ones a real region carries)', () => {
    expect(fallbackBlock).toMatch(/padding-inline:\s*var\(--ui-card-region-pad-inline\)/)
    expect(fallbackBlock).toMatch(/padding-block:\s*var\(--ui-card-region-pad-block\)/)
    // REVISED 2026-07-04: the loose-child rhythm is an adjacent-sibling margin now (the shell is block flow,
    // not grid/flex — a `gap` would be inert), so the fallback block carries NO `gap`; the 8px rhythm rides a
    // separate `> * + *` margin-block-start rule keyed off the same fallback marker.
    expect(fallbackBlock).not.toMatch(/gap:/)
    expect(scopeCard).toMatch(/margin-block-start:\s*var\(--ui-card-content-gap\)/)
    // hygiene: no foreign (--md-sys-color-* / bare ramp) reference sneaks into the fallback leg
    expect(foreignRefs(fallbackBlock)).toEqual([])
  })

  it('does NOT touch grid-template-rows (the fallback is a padding/gap leg only, not a row-structure leg)', () => {
    expect(fallbackBlock).not.toMatch(/grid-template-rows/)
  })
})

describe('card.css — scroll mode is a FLEX COLUMN (the WRAPPER MODEL, REVISED 2026-07-06) + forced-colors', () => {
  it('scroll mode: the shell becomes a flex column off either signal — header/footer flex:0 0 auto + sticky KEPT, content flex:1 1 auto', () => {
    // REVISED 2026-07-06 (Kim ratified via /intent-extract): the shell switches from block-flow to a FLEX COLUMN
    // in scroll mode — the structural change the wrapper model needs. `overflow-y:auto` + sticky brackets are
    // KEPT on the card (the fallback viewport when no [scroll-wrapper] is present — byte-identical to the PRIOR
    // 2026-07-05 "whole container scrolls" behaviour).
    expect(scopeCard).toMatch(/:scope\[scrollable\]/) // the ergonomic <ui-card scrollable> signal is a trigger
    expect(scopeCard).toMatch(/:has\(>\s*ui-card-content\[scrollable\]\)/) // and the A2UI content-level signal
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*display:\s*flex/) // the shell IS now flex
    expect(scopeCard).toMatch(/flex-direction:\s*column/) // header/content/footer stack as a column
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*overflow-y:\s*auto/) // the FALLBACK viewport
    expect(scopeCard).toMatch(/position:\s*sticky/) // header/footer sticky is KEPT (harmless in the wrapper shape)
    // sticky inset is 0 (NOT --ui-card-region-margin) — the card's own flex-mode `padding` (below) now provides
    // the 6px frame↔bracket gutter; an ADDITIONAL 6px inset would double-stack once actually stuck (measured
    // cross-engine — card.browser.test.ts's gutter proof).
    expect(scopeCard).toMatch(/ui-card-header\)[^}]*\{[^}]*inset-block-start:\s*0/)
    expect(scopeCard).toMatch(/ui-card-footer\)[^}]*\{[^}]*inset-block-end:\s*0/)
    expect(scopeContent).not.toMatch(/:scope\[scrollable\]/) // ui-card-content's OWN @scope carries no scroll-mode leg
  })

  it('flex items never margin-collapse: scroll mode zeroes the per-region margin and reproduces the SAME 6px rhythm via gap + container padding', () => {
    // The load-bearing correctness fix a flex column needs (flex items do NOT margin-collapse, unlike the
    // block-flow BFC default) — keeping each region's own 6px margin here would DOUBLE the region↔region gutter
    // to 12px. `gap` (between items, never doubles) + the container's own `padding` (frame↔first/last-item,
    // where a flex container has no adjacent sibling to collapse against anyway) reproduce the identical 6px.
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*gap:\s*var\(--ui-card-region-margin\)/)
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*padding:\s*var\(--ui-card-region-margin\)/)
    // the zeroing leg: higher specificity than the base per-region margin rule, keyed off all three region tags
    const at = scopeCard.indexOf('margin: 0;')
    expect(at, 'no margin:0 override found in @scope (ui-card)').toBeGreaterThan(-1)
    const selectors = scopeCard.slice(0, at)
    const tail = selectors.slice(selectors.lastIndexOf(';') + 1)
    expect(tail).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-header,\s*ui-card-content,\s*ui-card-footer\)/)
  })

  it('header/footer are flex:0 0 auto (never grow/shrink to fill) — content is flex:1 1 auto (fills the space between them)', () => {
    // REVISED 2026-07-06: replaces the RETIRED min-block-size:100% percentage recipe (which always overflowed a
    // short card by the header+footer's own height) — flex-grow gives the SAME sticky-footer-fill for free,
    // without that side effect (flex-grow only adds LEFTOVER space, it never forces height beyond natural size).
    expect(scopeCard).toMatch(/ui-card-header\)[^}]*\{[^}]*flex:\s*0 0 auto/)
    expect(scopeCard).toMatch(/ui-card-footer\)[^}]*\{[^}]*flex:\s*0 0 auto/)
    const at = scopeCard.indexOf('flex: 1 1 auto;')
    expect(at, 'no content flex:1 1 auto rule found').toBeGreaterThan(-1)
    const selectors = scopeCard.slice(0, at)
    const tail = selectors.slice(selectors.lastIndexOf(';') + 1)
    expect(tail).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-content\)/)
    expect(css).not.toMatch(/min-block-size:\s*100%/) // the retired recipe is genuinely gone, not just unused
  })

  it('THE WRAPPER MODEL: a [scroll-wrapper] child of ui-card-content becomes the real overflow:auto viewport; content becomes a nested flex column with min-block-size:0', () => {
    expect(scopeCard).toMatch(/:has\(>\s*\[scroll-wrapper\]\)/) // ui-card-content is matched by its wrapper child
    const contentNestedAt = scopeCard.indexOf('min-block-size: 0;')
    expect(contentNestedAt, 'no min-block-size:0 override found on ui-card-content').toBeGreaterThan(-1)
    // the wrapper itself: flex:1 1 auto + min-block-size:0 + overflow-y:auto — the actual scroll viewport
    const wrapperAt = scopeCard.indexOf('overflow-y: auto;', contentNestedAt)
    expect(wrapperAt, 'no [scroll-wrapper] overflow-y:auto rule found').toBeGreaterThan(-1)
    const wrapperBlock = scopeCard.slice(scopeCard.lastIndexOf('{', wrapperAt), wrapperAt)
    expect(wrapperBlock).toMatch(/flex:\s*1 1 auto/)
    expect(wrapperBlock).toMatch(/min-block-size:\s*0/)
    const wrapperSelectors = scopeCard.slice(0, scopeCard.lastIndexOf('{', wrapperAt))
    expect(wrapperSelectors.slice(wrapperSelectors.lastIndexOf(';') + 1)).toMatch(/ui-card-content\)\s*>\s*\[scroll-wrapper\]/)
  })

  it('a forced-colors block keeps the card border visible (CanvasText)', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/)
    const fc = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/border-color:\s*CanvasText/) // the frame survives as a system colour
  })

  it('no opacity fade anywhere (the surface is a role plane, not an opacity wash — tokens.md canon)', () => {
    expect(css).not.toMatch(/opacity\s*:/)
  })
})

describe('card.css — REVISED 2026-07-04: the [scroll-fade] mask moved to the shared container-box.css seam', () => {
  // The gutter-exposure fix: the mask-image PAINT no longer lives in card.css at all — it is the generic
  // `[data-fade-top]`/`[data-fade-bottom]` rule (container-box.css), driven by traits/scroll-fade.ts from
  // card-content.ts's `connected()`. card.css only feeds the shared `--ui-box-fade` depth token.

  it('neither @scope block declares a mask-image rule any more (no --ui-card-fade, no inline gradient)', () => {
    expect(css).not.toMatch(/--ui-card-fade/)
    expect(scopeCard).not.toMatch(/mask-image/)
    expect(scopeContent).not.toMatch(/mask-image/)
  })

  it('ui-card-content feeds the shared --ui-box-fade depth (the mask paints THERE); the card token block does NOT', () => {
    // REVISED 2026-07-05 (Kim: "the mask should not be placed on the container element — it should be on
    // ui-card-content"): the CARD stays the scroll viewport the trait MEASURES, but the mask now PAINTS on
    // ui-card-content, so ui-card-content feeds the depth token and the card no longer does.
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).toMatch(/--ui-box-fade:\s*var\(--ui-space-lg,\s*1rem\)/)
    expect(cardTokens).not.toMatch(/--ui-box-fade/) // the card viewport no longer paints the mask
  })

  it('the forced-colors block no longer targets ui-card-content[scroll-fade] directly (the shared rule owns the drop)', () => {
    expect(css).not.toMatch(/ui-card-content\[scroll-fade\]/)
  })
})
