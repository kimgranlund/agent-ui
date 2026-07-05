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

/** A flat `:where(...) {` token block — marker to its first closing brace. */
const whereBlock = (marker: string): string => {
  const start = css.indexOf(marker)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
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

describe('card.css — scroll mode (whole-container scroll, sticky brackets, mask on card) + forced-colors', () => {
  it('scroll mode: the CARD is the scroll viewport off either signal, header/footer are position:sticky, content does NOT self-scroll', () => {
    // REVISED 2026-07-05 (Kim: "the whole container should scroll"): the card ITSELF becomes the scroll viewport
    // (overflow-y:auto) with sticky brackets, so the WHOLE container scrolls as one — superseding the short-lived
    // flex-column / inner-content-viewport model that trapped the scroll in the middle region.
    expect(scopeCard).toMatch(/:scope\[scrollable\]/) // the ergonomic <ui-card scrollable> signal is a trigger
    expect(scopeCard).toMatch(/:has\(>\s*ui-card-content\[scrollable\]\)/) // and the A2UI content-level signal
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*overflow-y:\s*auto/) // the CARD is the viewport
    expect(scopeCard).toMatch(/position:\s*sticky/) // header/footer pin to the card's scroll edges
    expect(scopeCard).toMatch(/inset-block-start:\s*var\(--ui-card-region-margin\)/) // sticky header offset = 6px
    expect(scopeCard).toMatch(/inset-block-end:\s*var\(--ui-card-region-margin\)/) // sticky footer offset = 6px
    expect(scopeCard).not.toMatch(/flex-direction:\s*column/) // NOT a flex column any more (model superseded)
    expect(scopeContent).not.toMatch(/:scope\[scrollable\]/) // the content region no longer self-scrolls at all
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

  it('the card feeds the shared --ui-box-fade depth (the card is the scroll viewport the trait paints); ui-card-content does NOT', () => {
    // REVISED 2026-07-05: the mask paints on the CARD (the whole-container scroll viewport), so the CARD feeds
    // the depth token; ui-card-content no longer does (the trait targets the card, not the content).
    expect(cardTokens).toMatch(/--ui-box-fade:\s*var\(--ui-space-lg,\s*1rem\)/)
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).not.toMatch(/--ui-box-fade/) // the content viewport is retired
  })

  it('the forced-colors block no longer targets ui-card-content[scroll-fade] directly (the shared rule owns the drop)', () => {
    expect(css).not.toMatch(/ui-card-content\[scroll-fade\]/)
  })
})
