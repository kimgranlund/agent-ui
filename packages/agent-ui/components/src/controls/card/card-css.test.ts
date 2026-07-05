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
// The ONE deliberate exception (matching button.css's precedent): the shared focus-ring FLEET constants
// (ADR-0009) are read DIRECTLY, never repointed through a --ui-card-* alias, so every control draws the
// identical ring — a fleet constant, not a per-control opinion.
const sharedFleet = new Set(['--md-sys-color-focus-ring', '--ui-focus-ring-width', '--ui-focus-ring-offset'])
const allowed = (v: string): boolean => /^--ui-card-/.test(v) || /^--ui-container-/.test(v) || sharedFleet.has(v)
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

  it('EVERY --md-sys-color-* role reference lives inside the :where(ui-card) token block, except the ONE deliberate shared focus-ring fleet constant (ADR-0009 — read directly in @scope, same exception button.css takes)', () => {
    const allRoleRefs = [...css.matchAll(/var\((--md-sys-color-[\w-]+)/g)].map((m) => m[1] as string).sort()
    const tokenRoleRefs = [...cardTokens.matchAll(/var\((--md-sys-color-[\w-]+)/g)].map((m) => m[1] as string).sort()
    expect(allRoleRefs.length).toBeGreaterThan(0) // anti-vacuous — roles ARE used
    const leaked = allRoleRefs.filter((v) => !tokenRoleRefs.includes(v))
    expect(leaked).toEqual(['--md-sys-color-focus-ring']) // the ONE sanctioned exception — every other role stays confined
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

describe('card.css — scroll mode: ui-card-content IS the viewport, header/footer are OVERLAID peers (REVISED 2026-07-07) + forced-colors', () => {
  it('scroll mode: the shell stays flex (the sizing mechanism only) — position:relative + isolate, NO gap/padding on the shell any more', () => {
    // REVISED 2026-07-07: supersedes the WRAPPER MODEL. The shell still needs `display:flex` (the one construct
    // that hands a flex item a genuinely definite size against a max-block-size-only auto-height parent), but
    // header/footer no longer participate in it (they're position:absolute) — so there is no `gap`/`padding` on
    // the shell any more (those existed only to space THREE flex items; content is now the sole item).
    expect(scopeCard).toMatch(/:scope\[scrollable\]/) // the ergonomic <ui-card scrollable> signal is a trigger
    expect(scopeCard).toMatch(/:has\(>\s*ui-card-content\[scrollable\]\)/) // and the A2UI content-level signal
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*display:\s*flex/) // the shell is STILL flex
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*flex-direction:\s*column/)
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*position:\s*relative/) // anchors the overlay brackets
    expect(scopeCard).toMatch(/:scope\[scrollable\][^}]*\{[^}]*isolation:\s*isolate/)
    // the shell itself no longer scrolls or paints a mask — ui-card-content does (below)
    const shellAt = scopeCard.indexOf(':scope[scrollable]')
    const shellBlock = scopeCard.slice(shellAt, scopeCard.indexOf('}', shellAt))
    expect(shellBlock).not.toMatch(/overflow-y:\s*auto/)
    expect(shellBlock).not.toMatch(/gap:/)
    expect(shellBlock).not.toMatch(/padding:/)
    expect(scopeContent).not.toMatch(/:scope\[scrollable\]/) // ui-card-content's OWN @scope carries no scroll-mode leg
  })

  it('header/footer become OVERLAID PEERS — position:absolute, inset-inline:0, one pinned block edge each, KEEPING their margin (not zeroed)', () => {
    // REVISED 2026-07-07: no longer sticky/flex items — removed from flow entirely so ui-card-content becomes
    // the shell's sole flex item. They keep the generic 6px region margin (unaffected here) — for an absolutely
    // positioned box, margin still offsets it inward from its resolved inset edges, reproducing the same
    // floating 6px-inset look, just out-of-flow.
    expect(scopeCard).toMatch(/ui-card-header\)[^}]*\{[^}]*position:\s*absolute/)
    expect(scopeCard).toMatch(/ui-card-header\)[^}]*\{[^}]*inset-inline:\s*0/)
    expect(scopeCard).toMatch(/ui-card-header\)[^}]*\{[^}]*inset-block-start:\s*0/)
    expect(scopeCard).toMatch(/ui-card-footer\)[^}]*\{[^}]*position:\s*absolute/)
    expect(scopeCard).toMatch(/ui-card-footer\)[^}]*\{[^}]*inset-inline:\s*0/)
    expect(scopeCard).toMatch(/ui-card-footer\)[^}]*\{[^}]*inset-block-end:\s*0/)
    // NO background (Kim: the brackets stay see-through — the mask carries the occlusion) — neither in this
    // @scope block at all, and the header/footer's own token block never sets one either.
    expect(scopeCard).not.toMatch(/background:\s*inherit/)
    // NOT in the block-margin-zeroing leg (that targets ui-card-content alone now, not header/footer)
    const zeroAt = scopeCard.indexOf('margin-block: 0;')
    expect(zeroAt, 'no margin-block:0 leg found').toBeGreaterThan(-1)
    const zeroSelectors = scopeCard.slice(0, zeroAt)
    const zeroTail = zeroSelectors.slice(zeroSelectors.lastIndexOf(';') + 1)
    expect(zeroTail).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-content\)/)
    expect(zeroTail).not.toMatch(/ui-card-header/)
    expect(zeroTail).not.toMatch(/ui-card-footer/)
  })

  it('ui-card-content keeps its INLINE region margin in scroll mode — only the BLOCK axis is zeroed (Kim: "do not lose the default margins")', () => {
    // A screenshot caught the earlier `margin: 0` (both axes) misaligning content's text ~6px LEFT of the
    // header/footer text — the brackets keep their own inline margin (test above), so content must too, or the
    // two texts no longer share the same inset. BLOCK stays zeroed (the flex "100% of parent height" + the
    // block-padding bracket-clearance formula, below, would otherwise double-stack); INLINE reads the SAME
    // `--ui-card-region-margin` the generic (non-scroll) rule and the header/footer both use.
    const at = scopeCard.indexOf('margin-block: 0;')
    expect(at, 'no margin-block:0 leg found').toBeGreaterThan(-1)
    const rule = scopeCard.slice(scopeCard.lastIndexOf('{', at), scopeCard.indexOf('}', at) + 1)
    expect(rule).toMatch(/margin-inline:\s*var\(--ui-card-region-margin\)/)
  })

  it('ui-card-content: flex:1 1 auto (fills "100% of parent height") + min-block-size:0 + overflow-y:auto — the ONE scroll viewport, no wrapper', () => {
    // REVISED 2026-07-07: replaces BOTH the retired min-block-size:100% recipe AND the short-lived [scroll-wrapper]
    // — ui-card-content itself now scrolls directly.
    const at = scopeCard.indexOf('flex: 1 1 auto;')
    expect(at, 'no content flex:1 1 auto rule found').toBeGreaterThan(-1)
    const block = scopeCard.slice(scopeCard.lastIndexOf('{', at), scopeCard.indexOf('}', at) + 1)
    expect(block).toMatch(/min-block-size:\s*0/)
    expect(block).toMatch(/overflow-y:\s*auto/)
    const selectors = scopeCard.slice(0, scopeCard.lastIndexOf('{', at))
    const tail = selectors.slice(selectors.lastIndexOf(';') + 1)
    expect(tail).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-content\)/)
    expect(css).not.toMatch(/min-block-size:\s*100%/) // the retired recipe is genuinely gone, not just unused
    expect(css).not.toMatch(/\[scroll-wrapper\]/) // the wrapper model is genuinely gone, not just unused
  })

  it('the SAME bracket bands drive BOTH the block-padding on ui-card-content AND (unchanged) the gradient offset', () => {
    // Kim's ask: "adjust block-padding and linear gradient coordinates based on presence of the peer footer and
    // header" — ONE measured source (--ui-box-head/--ui-box-foot, published by traits/scroll-fade.ts), two
    // consumers. `max(band, plain-pad)` is the formula: a present bracket's band always exceeds the plain 6px
    // region pad (so it wins — content clears the bracket); an absent bracket publishes 0px (so the plain pad
    // wins instead).
    expect(scopeCard).toMatch(/padding-block-start:\s*max\(var\(--ui-card-box-head\),\s*var\(--ui-card-region-pad-block\)\)/)
    expect(scopeCard).toMatch(/padding-block-end:\s*max\(var\(--ui-card-box-foot\),\s*var\(--ui-card-region-pad-block\)\)/)
    // and the TOKEN block re-declares the card's own vars FROM the shared --ui-box-head/-foot seam (0px default)
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).toMatch(/--ui-card-box-head:\s*var\(--ui-box-head,\s*0px\)/)
    expect(contentTokens).toMatch(/--ui-card-box-foot:\s*var\(--ui-box-foot,\s*0px\)/)
  })

  it('opts INTO the shared HOLD (container-box.css) so the gradient stays fully transparent/opaque THROUGH the bracket band, not mid-ramp across it', () => {
    // The backgroundless overlay brackets need the gradient itself to hold through their own band (else a crisp
    // bracket sits over partially-visible scrolled content, measured cross-engine) — every OTHER --ui-box-fade
    // consumer never sets these two vars, so they stay a provable no-op there (container-box.test.ts, unchanged).
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).toMatch(/--ui-box-head-hold:\s*var\(--ui-box-head,\s*0px\)/)
    expect(contentTokens).toMatch(/--ui-box-foot-hold:\s*var\(--ui-box-foot,\s*0px\)/)
  })

  it('a forced-colors block keeps the card border visible (CanvasText)', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)/)
    const fc = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/border-color:\s*CanvasText/) // the frame survives as a system colour
  })

  it('a forced-colors block also gives the scroll-mode brackets an opaque Canvas fallback (both triggers)', () => {
    // The shared [data-fade-top]/[data-fade-bottom] forced-colors block (container-box.css) drops the mask
    // entirely — and these brackets are deliberately backgroundless in normal rendering, so without a
    // WHCM-only fallback, scrolled content would bleed straight through the header/footer text.
    const fc = css.slice(css.indexOf('@media (forced-colors: active)'))
    expect(fc).toMatch(/:scope\[scrollable\][^{]*ui-card-header[^{]*\{[^}]*background:\s*Canvas/)
    expect(fc).toMatch(/:has\(>\s*ui-card-content\[scrollable\]\)[^{]*ui-card-header[^{]*\{[^}]*background:\s*Canvas/)
  })

  it(':has(> ui-card-content:focus-visible) draws the fleet ring (ADR-0009) on the PARENT ui-card — both triggers, keyboard-only, STANDARD (outward) offset', () => {
    // component-review, 2026-07-08: the GO-blocker on the scrollbar-hide pass — hiding the native scrollbar
    // made ui-card-content a genuine tab stop, so keyboard-focusing it must draw the SAME shared ring every
    // other fleet control does. Kim, 2026-07-08 (superseding an earlier inset/negative-offset draft on
    // ui-card-content itself): the ring paints on the PARENT card instead, via `:has(> ui-card-content:focus-
    // visible)` — the card has no overflow of its own to clip it, so this uses the fleet's STANDARD positive
    // (outward) offset like every other consumer, no sign flip (card.browser.test.ts proves it renders and is
    // not clipped, in-browser).
    const at = scopeCard.indexOf(':focus-visible')
    expect(at, 'no :focus-visible rule found').toBeGreaterThan(-1)
    const rule = scopeCard.slice(scopeCard.indexOf('{', at), scopeCard.indexOf('}', at) + 1)
    expect(rule).toMatch(/outline:\s*var\(--ui-focus-ring-width\)\s+solid\s+var\(--md-sys-color-focus-ring\)/)
    expect(rule).toMatch(/outline-offset:\s*var\(--ui-focus-ring-offset\)/)
    expect(rule).not.toMatch(/calc\(-1/) // the standard offset, NOT the earlier negated one
    // both scroll-mode triggers get the ring — the selector list spans from the PRIOR rule's closing brace
    // up through this rule's opening brace. It's the CARD's own selector (:scope[scrollable] / :scope:has(…)),
    // gated by a NESTED :has(> ui-card-content …:focus-visible) — never a direct rule ON ui-card-content.
    const priorClose = scopeCard.lastIndexOf('}', at)
    const selectors = scopeCard.slice(priorClose + 1, scopeCard.indexOf('{', at))
    expect(selectors).toMatch(/:scope\[scrollable\]:has\(>\s*ui-card-content:focus-visible\)/)
    expect(selectors).toMatch(/:scope:has\(>\s*ui-card-content\[scrollable\]:focus-visible\)/)
    expect(selectors.match(/:focus-visible/g)?.length, 'both triggers should each carry :focus-visible').toBe(2)
    // NOT a direct rule on the content region itself — the ring belongs to the card, not the scroll container.
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).not.toMatch(/focus-visible/)
  })

  it('the scroll-mode content viewport HIDES its native scrollbar (Kim: "keep native, but hide it" — ADR-0046 Amendment 6)', () => {
    // Kim's third option, resolving the mask-fades-the-scrollbar tension: no visible bar → nothing for the
    // mask to fade → the fade becomes the sole scroll affordance. Native overflow-y:auto scrolling (already
    // pinned above) is UNCHANGED — this only hides the CHROME.
    const at = scopeCard.indexOf('scrollbar-width: none;')
    expect(at, 'no scrollbar-width:none rule found').toBeGreaterThan(-1)
    const selectors = scopeCard.slice(0, scopeCard.lastIndexOf('{', at))
    const tail = selectors.slice(selectors.lastIndexOf(';') + 1)
    expect(tail).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-content\)/)
    expect(tail).toMatch(/:has\(>\s*ui-card-content\[scrollable\]\)\s*>\s*:where\(ui-card-content\)/)
    // Chromium/WebKit's own hook — a separate rule (pseudo-elements can't join the declaration block above),
    // scoped identically (both scroll-mode triggers).
    expect(scopeCard).toMatch(/:scope\[scrollable\]\s*>\s*:where\(ui-card-content\)::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/)
    expect(scopeCard).toMatch(
      /:has\(>\s*ui-card-content\[scrollable\]\)\s*>\s*:where\(ui-card-content\)::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/,
    )
    // the NON-scroll (default) content region keeps its native scrollbar — the hide is scroll-mode-only.
    const contentTokens = whereBlock(':where(ui-card-content) {')
    expect(contentTokens).not.toMatch(/scrollbar-width/)
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
