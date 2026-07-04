import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

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
    // --ui-container-bg: var(--md-sys-color-neutral-surface), so an un-elevated card reads as a plane (ADR-0015).
    expect(alphaOf(getComputedStyle(card).backgroundColor), 'card surface is transparent').toBeGreaterThan(0)
  })

  it('a NESTED card radius DECREMENTS one level — measured px == max(0, parent − padding) (ADR-0018)', () => {
    // Reseed the root radius well larger than the region padding so the one-level decrement is a clear
    // unambiguous px (with the default --ui-radius-base of 12px against the card's 6px region padding, the
    // inner radius would still decrement to a demonstrative 6px — but reseeding to 32px keeps the margin wide).
    // The author-set --ui-card-radius reseeds the chain root (ADR-0018 cl.1).
    const root = mount(
      '<ui-card style="--ui-card-radius: 32px"><ui-card-content><ui-card>nested</ui-card></ui-card-content></ui-card>',
    )
    const nested = root.querySelector('ui-card-content > ui-card') as HTMLElement
    const content = root.querySelector('ui-card-content') as HTMLElement
    const rootR = radiusPx(root)
    const nestedR = radiusPx(nested)
    // Box-model: the card holds no padding — a nested card sits inside ui-card-content, inset by the CONTENT
    // region's inline padding, so the concentric decrement measures against THAT (now 6px, card-only override
    // of the shared 12px), not the card's.
    const pad = px(getComputedStyle(content).paddingLeft)

    expect(rootR, 'root radius did not reseed to 32px').toBeCloseTo(32, 0)
    expect(pad, 'content inline padding is not a positive px').toBeGreaterThan(0)
    // the concentric-corner law, measured: child == max(0, parent − content inline padding)
    expect(nestedR, 'nested radius != max(0, parent − content inline padding)').toBeCloseTo(Math.max(0, rootR - pad), 1)
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

  it('[box-model] region padding is FIXED (inline 6 · block 6) + density-INVARIANT; the frame HOLDS too', () => {
    // Box-model rollout (container-box.css), CARD-ONLY override (Kim, 2026-07-04): the card itself has zero
    // padding; the regions carry a FIXED region padding off the rem-based --ui-box-* tokens, repointed on
    // :where(ui-card) from the shared 12px/4px default to a uniform 0.375rem = 6px inline AND block. Because
    // they are rem-based (not --ui-space × --ui-density), the region padding — like the frame — is
    // density-INVARIANT. (Other [data-box] consumers — modal/select/menu/combo-box — are untouched; see the
    // modal box-model browser smoke for the 12/4 regression witness.)
    const card = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement

    // comfortable baseline: the fixed uniform 6/6 region padding
    const padInlineBase = px(getComputedStyle(content).paddingLeft)
    const padBlockBase = px(getComputedStyle(content).paddingTop)
    const borderBase = px(getComputedStyle(card).borderTopWidth)
    const radiusBase = radiusPx(card)
    expect(padInlineBase, 'content inline padding is not ~6px').toBeCloseTo(6, 0)
    expect(padBlockBase, 'content block padding is not ~6px').toBeCloseTo(6, 0)
    expect(borderBase, 'border is 0 (frame invariant is vacuous)').toBeGreaterThan(0)
    expect(radiusBase, 'radius is 0 (frame invariant is vacuous)').toBeGreaterThan(0)

    // density-INVARIANT: compact + spacious leave the region padding + frame unchanged (rem, not --ui-space)
    for (const d of ['compact', 'spacious']) {
      card.setAttribute('density', d)
      expect(px(getComputedStyle(content).paddingLeft), `inline padding changed at ${d}`).toBeCloseTo(padInlineBase, 1)
      expect(px(getComputedStyle(content).paddingTop), `block padding changed at ${d}`).toBeCloseTo(padBlockBase, 1)
      expect(px(getComputedStyle(card).borderTopWidth), `border width changed at ${d}`).toBe(borderBase)
      expect(radiusPx(card), `radius changed at ${d}`).toBe(radiusBase)
    }
  })

  it('NESTED card-content padding stays FLAT (6px) at every depth — no stepping law to invert (6px override proof)', () => {
    // The shared container-box.css model (modal/select/menu/combo-box) steps a NESTED [data-region='content']'s
    // inline padding IN one inset per level (12 → 8 → 4, floored) — a formula that would genuinely INVERT
    // (L2 < L3-floor) if naively re-based on the card's new 6px pad-inline against the shared 4px inset
    // (6−4=2 < the 4px floor). But `ui-card-content` is a bespoke tag, never marked `[data-region='content']`
    // or `[data-box]` — the shared stepping selectors (`:where([data-region='content'], main) :where(...)`)
    // never match it, so ui-card-content carries NO padding-stepping law at all, before or after this change:
    // every level reads the SAME flat --ui-card-region-pad-inline/-block (6px), independent of nesting depth.
    // Proven here 3 levels deep (card > content > card > content > card > content) — monotonic (flat, never
    // inverts) is the correct, deliberate resolution for card (only the RADIUS chain steps, ADR-0018).
    const root = mount(
      '<ui-card><ui-card-content>L1' +
        '<ui-card><ui-card-content>L2' +
          '<ui-card><ui-card-content>L3</ui-card-content></ui-card>' +
        '</ui-card-content></ui-card>' +
      '</ui-card-content></ui-card>',
    )
    const contents = [...root.querySelectorAll('ui-card-content')] as HTMLElement[]
    expect(contents, 'did not find all 3 nested ui-card-content levels').toHaveLength(3)

    const padsInline = contents.map((c) => px(getComputedStyle(c).paddingLeft))
    const padsBlock = contents.map((c) => px(getComputedStyle(c).paddingTop))
    for (const [i, p] of padsInline.entries()) expect(p, `L${i + 1} inline padding is not ~6px (a stepping law leaked in)`).toBeCloseTo(6, 0)
    for (const [i, p] of padsBlock.entries()) expect(p, `L${i + 1} block padding is not ~6px (a stepping law leaked in)`).toBeCloseTo(6, 0)
    // anti-vacuous: every level reads the identical value (flat, NOT a decreasing ladder) — a stepping bug
    // (accidentally inheriting the shared container-box.css formula) would make these diverge.
    expect(new Set(padsInline).size, 'padding is not flat across nesting depth').toBe(1)
  })

  it('a BARE card (no region children) renders region-equivalent padding + rhythm (ADR-0056, anti-vacuous)', () => {
    // Two loose children, no header/content/footer — the wild-payload default. The fallback should apply the
    // SAME inline/block padding a real region carries (6px/6px) plus the 8px content-rhythm gap between them.
    const bare = mount('<ui-card><div>First</div><div>Second</div></ui-card>')
    const bareStyle = getComputedStyle(bare)
    expect(px(bareStyle.paddingLeft), 'bare card inline padding is not ~6px').toBeCloseTo(6, 0)
    expect(px(bareStyle.paddingTop), 'bare card block padding is not ~6px').toBeCloseTo(6, 0)
    expect(px(bareStyle.rowGap), 'bare card content rhythm is not ~8px').toBeCloseTo(8, 0)

    // anti-vacuous vs a region card: a card WITH a real region does NOT get the fallback on its OWN box (its
    // own padding stays the box-model 0 — the region itself carries the padding, not the card).
    const withRegion = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    expect(px(getComputedStyle(withRegion).paddingLeft), 'region-bearing card padding is not the box-model 0').toBe(0)
  })

  it('a region-bearing card is BYTE-IDENTICAL to the pre-ADR-0056 shape (negative control, no regression)', () => {
    // The exact case card.browser.test.ts already prints elsewhere (surface + box-model tests) — pinned again
    // here as the explicit negative control for THIS leg: :has() finds ui-card-content, so the fallback never
    // engages, and the card's own box stays zero-padding/zero-gap (the ADR-0046 box-model, unchanged).
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    const style = getComputedStyle(card)
    expect(px(style.paddingLeft)).toBe(0)
    expect(px(style.paddingTop)).toBe(0)
    expect(px(style.rowGap) || 0).toBe(0)
  })

  it('the STREAMING flip: a late-arriving ui-card-header drops the fallback + the region grid takes over', () => {
    // The exact case that ruled out a factory/mount-time decision (ADR-0056 alternative (c)): a card starts
    // bare (streamed with no regions yet) and a header streams in AFTER. The :has() re-evaluation must catch
    // it live, with no double padding at any point.
    const card = mount('<ui-card><div>Body</div></ui-card>')
    expect(px(getComputedStyle(card).paddingLeft), 'bare card did not get the fallback padding').toBeCloseTo(6, 0)

    const header = document.createElement('ui-card-header')
    header.textContent = 'Title'
    card.prepend(header) // a late-arriving region child, same as a streamed CardHeader landing after the body

    expect(px(getComputedStyle(card).paddingLeft), 'the fallback did not drop once a region child arrived').toBe(0)
    expect(trackCount(card), 'the presence-driven row template did not take over post-flip').toBe(2) // auto 1fr
  })

  it('MIXED composition (a region PLUS a loose sibling) gets NO fallback — regions present, author owns it', () => {
    const mixed = mount('<ui-card><ui-card-content>Body</ui-card-content><div>Loose</div></ui-card>')
    // :has() finds ui-card-content — the fallback stays off; the card's own box is unchanged box-model 0.
    expect(px(getComputedStyle(mixed).paddingLeft), 'mixed composition wrongly got the fallback padding').toBe(0)
  })

  it('a DIRECT card > card nesting (no region wrapper, outer card bare) stays the pre-existing manual case — ADR-0056 re-proof', () => {
    // ADR-0056 re-proof (the ADR names this explicitly as an open question — verify which way it resolves):
    // a card nested DIRECTLY inside another card (no ui-card-content between) matches BOTH `:where(ui-card)`
    // (declaring its own --ui-card-inner-radius) AND its parent's `:where(ui-card) > *` publish rule (setting
    // --ui-card-child-radius directly ON it) — a genuine multi-property CSS CYCLE
    // (radius → child-radius → inner-radius → radius) that collapses the nested radius to 0, independent of
    // any padding value. This is PRE-EXISTING (ADR-0018), not something ADR-0056 introduces: the region-less
    // fallback only ever sets padding/gap, never touches the radius chain — so direct nesting stays exactly
    // the documented manual-reseed case, whether or not the outer (bare) card now also carries fallback
    // padding. Measured, not assumed: the fallback's OWN leg (the padding) still applies independently.
    const root = mount('<ui-card style="--ui-card-radius: 32px"><ui-card>nested, no region wrapper</ui-card></ui-card>')
    const nested = root.querySelector('ui-card') as HTMLElement

    expect(radiusPx(root), 'root radius did not reseed to 32px').toBeCloseTo(32, 0)
    // the region-less fallback (an unrelated, independent leg) still applies its own padding to the bare outer
    // card even though its radius chain doesn't reach the nested card cleanly.
    expect(px(getComputedStyle(root).paddingLeft), 'the bare outer card lost its own fallback padding').toBeCloseTo(6, 0)
    // the pre-existing cycle still collapses the DIRECT nested card's radius — unchanged by ADR-0056
    expect(radiusPx(nested), 'direct nesting unexpectedly escaped the pre-existing radius cycle (ADR-0018)').toBe(0)

    // the documented workaround (an explicit border-radius reseed) still recovers the radius under the
    // fallback — the manual case remains manually fixable, it is simply not automatic.
    nested.style.setProperty('--ui-card-radius', '10px')
    expect(radiusPx(nested), 'an explicit reseed did not recover the radius under the fallback').toBeCloseTo(10, 0)
  })

  it('forced-colors keeps the card border visible — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')

    // Baseline (BOTH engines): the card border is a painted hairline (--md-sys-color-neutral-outline-variant, opaque).
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
