import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from '@vitest/browser/context'

// G9 s7 — the CROSS-ENGINE card smoke (decomp g9-containers s7 browser gate). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). Where card-geometry.test.ts / card-css.test.ts pin the DECLARED formulas, this
// pins the RENDERED px a real engine resolves — ANTI-VACUOUS: the nested radius genuinely DECREMENTS (measured
// px, not equal-to-self), the presence-driven rows genuinely change track count, the [scrollable] body
// genuinely contains its overflow. @scope / :has() / max()/calc() / the surface seam are only TRUE in a real engine.
//
// Side-effect CSS imports — the load-bearing order: foundation roles + dimensional ramp FIRST, then the SHARED
// container surface seam (controls/_surface/container.css — the [elevation]/[brightness] mapping + the
// background paint), then card.css (its own default surface overrides the seam's transparent default → later
// source wins). The component-styles barrel does NOT yet @import container.css/card.css (that is the s12
// integration slice), so this suite imports them directly. The four element modules self-define on import.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import './card.css'
import './card.ts'
import './card-header.ts'
import './card-content.ts'
import './card-footer.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const radiusPx = (el: HTMLElement): number => px(getComputedStyle(el).borderTopLeftRadius)
const trackCount = (el: HTMLElement): number => getComputedStyle(el).gridTemplateRows.split(/\s+/).filter(Boolean).length

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-card cross-engine smoke (s7, both engines)', () => {
  it('an un-elevated card paints a SURFACE (the own-default --ui-container-bg, not transparent)', () => {
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    // the surface rides container.css `background-color: var(--ui-container-bg)`; card.css seeds the default
    // --ui-container-bg: var(--c-neutral-surface), so an un-elevated card reads as a plane (ADR-0015).
    expect(alphaOf(getComputedStyle(card).backgroundColor), 'card surface is transparent').toBeGreaterThan(0)
  })

  it('a NESTED card radius DECREMENTS one level — measured px == max(0, parent − padding) (ADR-0018)', () => {
    // Reseed the root radius larger than the padding so the one-level decrement is a clear NON-ZERO px (with the
    // default --ui-radius-base == --ui-space-md the inner radius collapses to 0 — a valid but undemonstrative
    // decrement). The author-set --ui-card-radius reseeds the chain root (ADR-0018 cl.1).
    const root = mount(
      '<ui-card style="--ui-card-radius: 32px"><ui-card-content><ui-card>nested</ui-card></ui-card-content></ui-card>',
    )
    const nested = root.querySelector('ui-card-content > ui-card') as HTMLElement
    const rootR = radiusPx(root)
    const nestedR = radiusPx(nested)
    const pad = px(getComputedStyle(root).paddingTop)

    expect(rootR, 'root radius did not reseed to 32px').toBeCloseTo(32, 0)
    expect(pad, 'padding is not a positive px').toBeGreaterThan(0)
    // the concentric-corner law, measured: child == max(0, parent − padding)
    expect(nestedR, 'nested radius != max(0, parent − padding)').toBeCloseTo(Math.max(0, rootR - pad), 1)
    // anti-vacuous negative control: the nested radius is genuinely SMALLER than the parent (the decrement is
    // real — a same-radius/no-decrement bug would make these equal and FAIL here)
    expect(nestedR, 'nested radius did not decrement below the parent').toBeLessThan(rootR)
    expect(nestedR, 'nested radius collapsed to 0 (no demonstrable decrement)').toBeGreaterThan(0)
  })

  it('the region grid is PRESENCE-DRIVEN — track count changes with which regions are present', () => {
    const full = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content><ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const contentOnly = mount('<ui-card><ui-card-content>C</ui-card-content></ui-card>')
    expect(trackCount(full), 'header+content+footer is not a 3-row grid').toBe(3)
    expect(trackCount(contentOnly), 'content-only is not a 1-row grid').toBe(1)
    // anti-vacuous: an absent region truly left no phantom row (3 ≠ 1)
    expect(trackCount(full)).toBeGreaterThan(trackCount(contentOnly))
  })

  it('[scrollable] contains the body within a sized card (the content scrolls, the card stays bounded)', () => {
    const card = mount(
      '<ui-card style="max-block-size: 100px"><ui-card-content scrollable><div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(getComputedStyle(content).overflowY, '[scrollable] did not become an overflow viewport').toBe('auto')
    // the body's content overflows and is scrollable (scrollHeight beyond the visible clientHeight)
    expect(content.scrollHeight, 'the content did not overflow its viewport').toBeGreaterThan(content.clientHeight)
    // the card stayed bounded — it did NOT grow to fit the 400px child (the constraint held)
    expect(card.getBoundingClientRect().height, 'the card grew past its max-block-size').toBeLessThanOrEqual(120)
  })

  it('[density] compact→comfortable→spacious SHIFTS padding+gap (--ui-space-driven); border+radius HOLD', () => {
    // card.css:39-40: --ui-card-padding and --ui-card-gap both ride --ui-space-md (density-responsive).
    // The frame (border: 1px solid; radius: --ui-radius-base = 12px constant) is NOT a --ui-space quantity
    // and must stay invariant. Anti-vacuous: prove the spacing change is measurably nonzero AND that the
    // frame value is > 0 (so the "holds" proof is not vacuously equal-because-both-zero).
    const card = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content></ui-card>',
    )

    // comfortable (no [density] attr = --ui-density 1): the baseline spacing
    const padBase = px(getComputedStyle(card).paddingTop)
    const gapBase = px(getComputedStyle(card).rowGap)
    expect(padBase, 'comfortable padding is not a positive px').toBeGreaterThan(0)
    expect(gapBase, 'comfortable gap is not a positive px').toBeGreaterThan(0)

    // compact (density 0.5) — padding+gap halve
    card.setAttribute('density', 'compact')
    const padCompact = px(getComputedStyle(card).paddingTop)
    const gapCompact = px(getComputedStyle(card).rowGap)
    expect(padCompact, 'compact padding did not shrink from comfortable').toBeCloseTo(padBase / 2, 1)
    expect(gapCompact, 'compact gap did not shrink from comfortable').toBeCloseTo(gapBase / 2, 1)

    // spacious (density 1.5) — padding+gap grow
    card.setAttribute('density', 'spacious')
    const padSpacious = px(getComputedStyle(card).paddingTop)
    const gapSpacious = px(getComputedStyle(card).rowGap)
    expect(padSpacious, 'spacious padding did not grow from comfortable').toBeCloseTo(padBase * 1.5, 1)
    expect(gapSpacious, 'spacious gap did not grow from comfortable').toBeCloseTo(gapBase * 1.5, 1)

    // anti-vacuity: the density extremes are measurably distinct (compact < spacious)
    expect(padCompact, 'padding is the same at compact and spacious (density has no effect)').toBeLessThan(padSpacious)
    expect(gapCompact, 'gap is the same at compact and spacious (density has no effect)').toBeLessThan(gapSpacious)

    // FRAME is density-INVARIANT — border (1px solid) and radius (--ui-radius-base = 12px constant) must hold
    card.setAttribute('density', 'compact')
    const borderCompact = px(getComputedStyle(card).borderTopWidth)
    const radiusCompact = radiusPx(card)
    card.setAttribute('density', 'spacious')
    expect(px(getComputedStyle(card).borderTopWidth), 'border width changed with density').toBe(borderCompact)
    expect(radiusPx(card), 'radius changed with density').toBe(radiusCompact)
    // anti-vacuous: both are real painted values (not 0) so the invariant proves something
    expect(borderCompact, 'border is 0 (frame invariant is vacuous)').toBeGreaterThan(0)
    expect(radiusCompact, 'radius is 0 (frame invariant is vacuous)').toBeGreaterThan(0)
  })

  it('forced-colors keeps the card border visible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')

    // Baseline (BOTH engines): the card border is a painted hairline (--c-neutral-outline-variant, opaque).
    expect(alphaOf(getComputedStyle(card).borderTopColor), 'baseline border is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented cross-engine split — the button s13
      // harness convention). Assert the engine is genuinely NOT in forced-colors (so we are not faking the
      // Chromium proof) and stop; the forced-colors leg is proven in Chromium.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    // Chromium: emulate forced-colors via CDP — card.css's @media (forced-colors: active) repoints the border to
    // CanvasText (a system colour), so the frame survives WHCM (alpha stays > 0, not the user-agent default).
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(card).borderTopColor), 'card border vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })
})
