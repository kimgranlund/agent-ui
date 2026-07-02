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

// Strip CSS block comments — a `var(--c-…)` mentioned in a banner/comment is DOCUMENTATION, not a live
// reference, and must not pollute the role-leak / hygiene scans (the banner names --c-neutral-surface in prose).
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
// (--ui-container-*, ADR-0015 cl.2) — never a raw --c-* role nor a shared ramp (--ui-space-*/--ui-radius-base).
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

describe('card.css — role-purity: --c-* roles + ramps live ONLY in the TOKEN blocks', () => {
  it('the card seeds its OWN default surface --ui-container-bg from --c-neutral-surface', () => {
    // ADR-0015: the base seam defaults transparent; an un-elevated card must still read as a surface.
    expect(cardTokens).toMatch(/--ui-container-bg:\s*var\(--c-neutral-surface\)/)
  })

  it('the border role is --c-neutral-outline-variant (a hairline neutral frame)', () => {
    expect(cardTokens).toMatch(/--ui-card-border:\s*var\(--c-neutral-outline-variant\)/)
  })

  it('EVERY --c-* role reference lives inside the :where(ui-card) token block (none leaks to a STYLES rule)', () => {
    const allRoleRefs = [...css.matchAll(/var\((--c-[\w-]+)/g)].map((m) => m[1] as string).sort()
    const tokenRoleRefs = [...cardTokens.matchAll(/var\((--c-[\w-]+)/g)].map((m) => m[1] as string).sort()
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

  it('@scope (ui-card-content) consumes ONLY the own --ui-card-* chain (the fade depth)', () => {
    expect(foreignRefs(scopeContent)).toEqual([])
    expect(scopeContent).toMatch(/var\(--ui-card-fade\)/)
  })

  it('NEGATIVE control: a planted raw --c-* ref in a styles block is CAUGHT by the hygiene predicate', () => {
    const planted = '@scope (ui-card) { :scope { border-color: var(--c-neutral-outline); } }'
    expect(foreignRefs(planted)).toEqual(['--c-neutral-outline'])
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
    expect(fallbackBlock).toMatch(/gap:\s*var\(--ui-card-content-gap\)/)
    // hygiene: no foreign (--c-* / bare ramp) reference sneaks into the fallback leg
    expect(foreignRefs(fallbackBlock)).toEqual([])
  })

  it('does NOT touch grid-template-rows (the fallback is a padding/gap leg only, not a row-structure leg)', () => {
    expect(fallbackBlock).not.toMatch(/grid-template-rows/)
  })
})

describe('card.css — scrollable + scroll-fade hooks + forced-colors', () => {
  it('[scrollable] is an overflow viewport; [scroll-fade] is a mask-image edge fade (with the -webkit- prefix)', () => {
    expect(scopeContent).toMatch(/:scope\[scrollable\]\s*\{[^}]*overflow:\s*auto/)
    expect(scopeContent).toMatch(/:scope\[scroll-fade\]\s*\{[^}]*mask-image:\s*linear-gradient/)
    expect(scopeContent).toMatch(/-webkit-mask-image:\s*linear-gradient/) // WebKit still needs the prefix
  })

  it('a forced-colors block keeps the card border visible (CanvasText) and drops the fade mask', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/)
    const fc = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/border-color:\s*CanvasText/) // the frame survives as a system colour
    expect(fc).toMatch(/mask-image:\s*none/) // the edge fade is dropped (a mask over system text harms legibility)
  })

  it('no opacity fade anywhere (the surface is a role plane, not an opacity wash — tokens.md canon)', () => {
    expect(css).not.toMatch(/opacity\s*:/)
  })
})
