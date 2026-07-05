import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// G9 s7 — the CROSS-ENGINE card smoke (decomp g9-containers s7 browser gate). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). Where card-geometry.test.ts / card-css.test.ts pin the DECLARED formulas, this
// pins the RENDERED px a real engine resolves — ANTI-VACUOUS: the nested radius genuinely DECREMENTS (measured
// px, not equal-to-self), a present region genuinely adds a box in block flow (absent leaves none), the
// [scrollable] card genuinely scrolls its overflow. @scope / :has() / max()/calc() / the surface seam are only TRUE in a real engine.
//
// Side-effect CSS imports — the load-bearing order: foundation roles + dimensional ramp FIRST, then the SHARED
// container surface seam (controls/_surface/container.css — the [elevation]/[brightness] mapping + the
// background paint), then card.css (its own default surface overrides the seam's transparent default → later
// source wins). The component-styles barrel does NOT yet @import container.css/card.css (that is the s12
// integration slice), so this suite imports them directly. The four element modules self-define on import.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import '../_surface/container-box.css' // the box-model layer — provides the shared [data-fade-top]/[data-fade-bottom] mask
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

/** The resolved mask — WebKit ships mask-image unprefixed too, but read both to be engine-agnostic. */
const maskOf = (el: HTMLElement): string => {
  const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitMaskImage?: string }
  return cs.maskImage || cs.webkitMaskImage || 'none'
}

/**
 * Scroll `el` to `top` and wait for the real (async, browser-native) `scroll` event to fire before
 * resolving — a plain `el.scrollTop = top` updates LAYOUT synchronously (fine for geometry assertions) but
 * the `scroll` EVENT the scrollFade trait listens for is dispatched asynchronously by the engine. A no-op
 * scroll (already at `top`) resolves immediately (no event would ever fire).
 */
const scrollTo = (el: HTMLElement, top: number): Promise<void> =>
  new Promise((resolve) => {
    if (el.scrollTop === top) {
      resolve()
      return
    }
    el.addEventListener('scroll', () => resolve(), { once: true })
    el.scrollTop = top
  })

describe('ui-card cross-engine smoke (s7, both engines)', () => {
  it('an un-elevated card paints a SURFACE (the own-default --ui-container-bg, not transparent)', () => {
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    // the surface rides container.css `background-color: var(--ui-container-bg)`; card.css seeds the default
    // --ui-container-bg: var(--md-sys-color-neutral-surface), so an un-elevated card reads as a plane (ADR-0015).
    expect(alphaOf(getComputedStyle(card).backgroundColor), 'card surface is transparent').toBeGreaterThan(0)
  })

  it('a NESTED card radius DECREMENTS one level — measured px == max(0, parent − padding) (ADR-0018)', () => {
    // Reseed the root radius well larger than the region padding so the one-level decrement is a clear
    // unambiguous px (with the default --ui-radius-base of 12px against the shared 12px region padding, REVISED
    // 2026-07-04, the inner radius would floor at a knife-edge 0 — reseeding to 32px keeps the margin wide and
    // demonstrative). The author-set --ui-card-radius reseeds the chain root (ADR-0018 cl.1).
    const root = mount(
      '<ui-card style="--ui-card-radius: 32px"><ui-card-content><ui-card>nested</ui-card></ui-card-content></ui-card>',
    )
    const nested = root.querySelector('ui-card-content > ui-card') as HTMLElement
    const content = root.querySelector('ui-card-content') as HTMLElement
    const rootR = radiusPx(root)
    const nestedR = radiusPx(nested)
    // Box-model: the card holds no padding — a nested card sits inside ui-card-content, inset by the CONTENT
    // region's OWN inline padding (now the shared 12px default, no card-only override), so the concentric
    // decrement measures against THAT (the region's positional MARGIN is a separate layer — ADR-0018's formula
    // is padding-only; see card.css's flagged consequence banner).
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

  it('regions are PRESENCE-DRIVEN in BLOCK FLOW — a present region adds a box, an absent one leaves nothing', () => {
    // REVISED 2026-07-04: the shell is block flow (flow-root), NOT a grid with :has() row templates. So
    // presence-driven is free — a present header/footer contributes a real box in normal flow, an absent one
    // contributes nothing (no phantom track to null out). The rendered proof is the height delta, not a track count.
    const full = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content><ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const contentOnly = mount('<ui-card><ui-card-content>C</ui-card-content></ui-card>')
    expect(getComputedStyle(full).display, 'the card shell is not block flow (flow-root)').toBe('flow-root')
    expect(getComputedStyle(full).gridTemplateRows, 'the shell still carries a grid row template').toBe('none')
    // anti-vacuous rendered proof: the full card (header + content + footer boxes) is genuinely TALLER than the
    // content-only card — the present regions each contribute a real box, the absent ones left nothing behind.
    expect(
      full.getBoundingClientRect().height,
      'header + footer added no height (presence-driven is vacuous)',
    ).toBeGreaterThan(contentOnly.getBoundingClientRect().height)
  })

  it('[scrollable] makes the CARD the scroll viewport — the WHOLE container scrolls, brackets are position:sticky', () => {
    // REVISED 2026-07-05 (Kim: "the whole container should scroll"): scroll mode makes the CARD itself the
    // bounded scroll viewport (overflow-y:auto) with sticky header/footer, so the whole container scrolls as one
    // — NOT the superseded inner-content flex-column model. Off the content-level [scrollable] signal (A2UI).
    const card = mount(
      '<ui-card style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content scrollable><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    // the CARD is the scroll viewport and genuinely overflows its bounded height
    expect(getComputedStyle(card).overflowY, 'the card is not the scroll viewport').toBe('auto')
    expect(card.scrollHeight, 'the card did not overflow its bounded height').toBeGreaterThan(card.clientHeight)
    // the content region does NOT self-scroll any more — the whole container does
    expect(getComputedStyle(content).overflowY, 'the content region is wrongly still a scroll viewport').not.toBe('auto')
    // the card stayed bounded — it did NOT grow to fit the 400px child (the max-block-size held)
    expect(card.getBoundingClientRect().height, 'the card grew past its max-block-size').toBeLessThanOrEqual(110)
    // the brackets ARE sticky — they pin to the card's scroll edges
    expect(getComputedStyle(header).position, 'the header is not sticky').toBe('sticky')
    expect(getComputedStyle(footer).position, 'the footer is not sticky').toBe('sticky')
  })

  it('[box-model] region padding is FIXED (inline 12 · block 6) + density-INVARIANT; the frame HOLDS too', () => {
    // Box-model rollout (container-box.css) — REVISED 2026-07-04: the card-only 6px-inline override is
    // RESCINDED. The card itself still has zero padding; the regions carry the SHARED rem-based --ui-box-*
    // region padding straight (inline 0.75rem=12px / block 0.375rem=6px), matching modal/select/menu/combo-box
    // exactly. Because they are rem-based (not --ui-space × --ui-density), the region padding — like the
    // frame — is density-INVARIANT.
    const card = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement

    // comfortable baseline: the fixed 12/6 region padding
    const padInlineBase = px(getComputedStyle(content).paddingLeft)
    const padBlockBase = px(getComputedStyle(content).paddingTop)
    const borderBase = px(getComputedStyle(card).borderTopWidth)
    const radiusBase = radiusPx(card)
    expect(padInlineBase, 'content inline padding is not ~12px').toBeCloseTo(12, 0)
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

  it('[box-model] REVISED 2026-07-04: regions are INSET — uniform 6px gutters, frame↔region AND region↔region, never doubled', () => {
    // ui-card is `display: flow-root` (plain block flow, like container-box.css's BFC) — adjacent region
    // margins COLLAPSE (6px + 6px → a single 6px gutter) and the card's 1px frame border blocks collapse-through
    // at the edges, so this is the load-bearing rendered proof that one uniform per-region `margin` (card.css
    // @scope) reconciles to 6px everywhere, not 12px between regions (the doubling block-flow collapse avoids).
    const card = mount(
      '<ui-card><ui-card-header>H</ui-card-header><ui-card-content>C</ui-card-content><ui-card-footer>F</ui-card-footer></ui-card>',
    )
    // card.css ALWAYS gives ui-card a 1px border (unaffected by this test) — getBoundingClientRect() returns the
    // card's border box, so a frame↔region delta must subtract that border width to isolate the margin gutter;
    // a region↔region delta involves no card border at all and needs no correction.
    const cardRect = card.getBoundingClientRect()
    const borderTop = px(getComputedStyle(card).borderTopWidth)
    const header = card.querySelector('ui-card-header') as HTMLElement
    const content = card.querySelector('ui-card-content') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    const headerRect = header.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()

    const frameToHeader = headerRect.top - cardRect.top - borderTop
    const headerToContent = contentRect.top - headerRect.bottom
    const contentToFooter = footerRect.top - contentRect.bottom
    const footerToFrame = cardRect.bottom - footerRect.bottom - borderTop
    const frameToHeaderInline = headerRect.left - cardRect.left - borderTop

    for (const [label, gap] of [
      ['frame→header', frameToHeader],
      ['header→content', headerToContent],
      ['content→footer', contentToFooter],
      ['footer→frame', footerToFrame],
      ['frame→header (inline)', frameToHeaderInline],
    ] as const) {
      expect(gap, `${label} gap is not ~6px (got ${gap})`).toBeCloseTo(6, 0)
    }
    // anti-vacuous: the BETWEEN-region gutter is genuinely not double the edge gutter (the doubling that
    // margin-collapse in this block-flow shell prevents for free).
    expect(headerToContent, 'between-region gap doubled (12px) instead of reconciling to one inset (6px)').toBeLessThan(frameToHeader * 1.5)
  })

  it('NESTED card-content padding stays FLAT (12/6) at every depth — no stepping law at all (REVISED 2026-07-04)', () => {
    // The shared container-box.css model (modal/select/menu/combo-box) steps a NESTED [data-region='content']'s
    // inline padding IN one inset per level (12 → 6 → 6, floored). But `ui-card-content` is a bespoke tag,
    // never marked `[data-region='content']` or `[data-box]` — the shared stepping selectors
    // (`:where([data-region='content'], main) :where(...)`) never match it, so ui-card-content carries NO
    // padding-stepping law at all: every level reads the SAME flat --ui-card-region-pad-inline/-block (12/6),
    // independent of nesting depth. Proven here 3 levels deep (card > content > card > content > card >
    // content) — flat, never a decreasing ladder — is the correct, deliberate resolution for card (only the
    // RADIUS chain steps, ADR-0018).
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
    for (const [i, p] of padsInline.entries()) expect(p, `L${i + 1} inline padding is not ~12px (a stepping law leaked in)`).toBeCloseTo(12, 0)
    for (const [i, p] of padsBlock.entries()) expect(p, `L${i + 1} block padding is not ~6px (a stepping law leaked in)`).toBeCloseTo(6, 0)
    // anti-vacuous: every level reads the identical value (flat, NOT a decreasing ladder) — a stepping bug
    // (accidentally inheriting the shared container-box.css formula) would make these diverge.
    expect(new Set(padsInline).size, 'padding is not flat across nesting depth').toBe(1)
  })

  it('a BARE card (no region children) renders region-equivalent padding + rhythm (ADR-0056, anti-vacuous)', () => {
    // Two loose children, no header/content/footer — the wild-payload default. REVISED 2026-07-04: the
    // fallback applies the SAME OWN-ink padding a real region's padding carries (12px inline / 6px block, was
    // 6/6 under the rescinded card-only override) plus the 8px content-rhythm gap between them. (It does NOT
    // also add the region's separate 6px positional margin — see card.css's flagged note on this reading.)
    const bare = mount('<ui-card><div>First</div><div>Second</div></ui-card>')
    const bareStyle = getComputedStyle(bare)
    expect(px(bareStyle.paddingLeft), 'bare card inline padding is not ~12px').toBeCloseTo(12, 0)
    expect(px(bareStyle.paddingTop), 'bare card block padding is not ~6px').toBeCloseTo(6, 0)
    // REVISED 2026-07-04: the loose-child rhythm is an adjacent-sibling margin now (the shell is block flow, not
    // a grid/flex `gap` — `rowGap` computes to 'normal'). Measure the RENDERED gap between the two children.
    const [first, second] = [...bare.children] as HTMLElement[]
    const rhythm = second.getBoundingClientRect().top - first.getBoundingClientRect().bottom
    expect(rhythm, 'bare card content rhythm (adjacent-sibling margin) is not ~8px').toBeCloseTo(8, 0)

    // anti-vacuous vs a region card: a card WITH a real region does NOT get the fallback on its OWN box (its
    // own padding stays the box-model 0 — the region itself carries the padding, not the card).
    const withRegion = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    expect(px(getComputedStyle(withRegion).paddingLeft), 'region-bearing card padding is not the box-model 0').toBe(0)
  })

  it('a region-bearing card is BYTE-IDENTICAL to the pre-ADR-0056 PADDING shape (negative control, no regression)', () => {
    // The exact case card.browser.test.ts already prints elsewhere (surface + box-model tests) — pinned again
    // here as the explicit negative control for THIS leg: :has() finds ui-card-content, so the fallback never
    // engages, and the card's own PADDING stays 0 (the ADR-0046 box-model, unchanged). REVISED 2026-07-04:
    // the card shell is now plain BLOCK FLOW (flow-root, NOT grid) — regions are spaced by their own 6px
    // margin (collapsing in the BFC), so there is no grid row-gap; the display is flow-root.
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    const style = getComputedStyle(card)
    expect(px(style.paddingLeft)).toBe(0)
    expect(px(style.paddingTop)).toBe(0)
    expect(style.display, 'the card shell is block flow (flow-root), not grid').toBe('flow-root')
  })

  it('the STREAMING flip: a late-arriving ui-card-header drops the fallback + becomes a real region box', () => {
    // The exact case that ruled out a factory/mount-time decision (ADR-0056 alternative (c)): a card starts
    // bare (streamed with no regions yet) and a header streams in AFTER. The :has() re-evaluation must catch
    // it live, with no double padding at any point.
    const card = mount('<ui-card><div>Body</div></ui-card>')
    expect(px(getComputedStyle(card).paddingLeft), 'bare card did not get the fallback padding').toBeCloseTo(12, 0)

    const header = document.createElement('ui-card-header')
    header.textContent = 'Title'
    card.prepend(header) // a late-arriving region child, same as a streamed CardHeader landing after the body

    expect(px(getComputedStyle(card).paddingLeft), 'the fallback did not drop once a region child arrived').toBe(0)
    // REVISED 2026-07-04: block flow — no grid row template "takes over". The late header now simply contributes
    // a real region box in normal flow (presence-driven for free), carrying the uniform 6px inset region margin.
    expect(getComputedStyle(card).display, 'the shell is not block flow post-flip').toBe('flow-root')
    expect(px(getComputedStyle(header).marginTop), 'the flipped-in header did not get the 6px region inset margin').toBeCloseTo(6, 0)
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
    expect(px(getComputedStyle(root).paddingLeft), 'the bare outer card lost its own fallback padding').toBeCloseTo(12, 0)
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

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  Edge-aware scroll fade (Kim, 2026-07-05 — "the whole container should scroll") — scroll-then-measure, both
//  engines. scroll-fade.test.ts proves the trait's DECISION logic (jsdom, stubbed geometry); this proves the
//  whole live wire: card-content.ts's connected() → the CARD is the SCROLL VIEWPORT (the whole container
//  scrolls, header/footer sticky) → the card carries the flags → the shared container-box.css mask PAINTS.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-card — the edge-fade mask is AUTOMATIC and lands on the CARD viewport (whole-container scroll)', () => {
  it('at the TOP: the CARD gets data-fade-bottom (more below) not data-fade-top; the content carries neither', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(card, 0)

    expect(card.hasAttribute('data-fade-top'), `${server.browser}: fresh scroll wrongly fades the top`).toBe(false)
    expect(card.hasAttribute('data-fade-bottom'), `${server.browser}: the card did not fade its bottom (more below)`).toBe(true)
    // anti-vacuous: the flags live on the CARD (the scroll viewport), NOT the content region.
    expect(
      content.hasAttribute('data-fade-top') || content.hasAttribute('data-fade-bottom'),
      'a fade flag leaked onto the content instead of the card viewport',
    ).toBe(false)
  })

  it('scrolled to the MIDDLE: both edges of the card fade', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    await scrollTo(card, card.scrollHeight - card.clientHeight - 10) // well inside, neither edge
    expect(card.hasAttribute('data-fade-top'), `${server.browser}`).toBe(true)
    expect(card.hasAttribute('data-fade-bottom'), `${server.browser}`).toBe(true)
  })

  it('scrolled to the BOTTOM: top fades, bottom does not (nothing left below)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    await scrollTo(card, card.scrollHeight) // the browser clamps to the real max
    expect(card.hasAttribute('data-fade-top'), `${server.browser}: end-of-scroll did not fade the top`).toBe(true)
    expect(card.hasAttribute('data-fade-bottom'), `${server.browser}: end-of-scroll wrongly kept fading the bottom`).toBe(false)
  })

  it('AUTOMATIC — <ui-card scrollable> fades with NO opt-in attribute (the mask is inherent to scroll mode)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' + // no scroll-fade attr — retired
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    expect(card.scrollHeight, 'the card did not genuinely overflow (test setup is vacuous)').toBeGreaterThan(card.clientHeight)
    await scrollTo(card, 40)
    expect(
      card.hasAttribute('data-fade-top') || card.hasAttribute('data-fade-bottom'),
      `${server.browser}: a scrollable card did not automatically fade`,
    ).toBe(true)
  })

  it('also arms off the CONTENT-level [scrollable] signal (the A2UI mapping) — no card-level attr needed', async () => {
    const card = mount(
      '<ui-card style="max-block-size: 100px"><ui-card-content scrollable>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    expect(card.scrollHeight, 'the card did not overflow (test setup is vacuous)').toBeGreaterThan(card.clientHeight)
    await scrollTo(card, 40)
    expect(
      card.hasAttribute('data-fade-top') || card.hasAttribute('data-fade-bottom'),
      `${server.browser}: the content-level [scrollable] signal did not arm the fade`,
    ).toBe(true)
  })

  it('a NON-scrolling card in scroll mode never fades (self-gates on real overflow — never a flat guess)', () => {
    const card = mount('<ui-card scrollable><ui-card-content><p>short</p></ui-card-content></ui-card>')
    expect(card.scrollHeight, 'the card unexpectedly overflows (test setup is vacuous)').toBeLessThanOrEqual(card.clientHeight + 1)
    expect(card.hasAttribute('data-fade-top')).toBe(false)
    expect(card.hasAttribute('data-fade-bottom')).toBe(false)
  })

  it('the rendered mask PAINTS on the CARD from the flags — a gradient when scrolling, none when it fits', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    await scrollTo(card, 0)
    expect(maskOf(card), `${server.browser}: at the top, only-bottom-faded should still paint a gradient`).toMatch(/gradient/)

    await scrollTo(card, card.scrollHeight - card.clientHeight - 10)
    expect(maskOf(card), `${server.browser}: mid-scroll (both edges) should paint a gradient`).toMatch(/gradient/)

    // a NON-scrolling card never paints a mask.
    const plain = mount('<ui-card><ui-card-content><p>short</p></ui-card-content></ui-card>')
    expect(maskOf(plain), `${server.browser}: a non-scrolling card painted a mask`).toBe('none')
  })

  it('presence-aware: the card viewport HOLDS the sticky brackets, so --ui-box-head/foot are POSITIVE (the fade ramps PAST them)', async () => {
    // The card is the scroll viewport and the header/footer are its direct sticky children, so the trait
    // measures each bracket band and publishes it — the fade's opaque end lands past the bracket + fade depth,
    // never blanking the brackets. (The superseded content-viewport model had 0px offsets — a plain edge fade.)
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    await scrollTo(card, 40)
    const head = card.style.getPropertyValue('--ui-box-head')
    const foot = card.style.getPropertyValue('--ui-box-foot')
    expect(px(head), `${server.browser}: the header band was not published (${head})`).toBeGreaterThan(0)
    expect(px(foot), `${server.browser}: the footer band was not published (${foot})`).toBeGreaterThan(0)
    expect(maskOf(card), `${server.browser}: the presence-aware fade did not paint`).toMatch(/gradient/)
  })

  it('the brackets ARE position:sticky and stay pinned as the CARD scrolls (the whole container scrolls under them)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>Header</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall body</div></ui-card-content>' +
        '<ui-card-footer>Footer</ui-card-footer></ui-card>',
    )
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    expect(getComputedStyle(header).position, `${server.browser}: header is not sticky`).toBe('sticky')
    expect(getComputedStyle(footer).position, `${server.browser}: footer is not sticky`).toBe('sticky')
    const headerTopBefore = header.getBoundingClientRect().top
    const footerBottomBefore = footer.getBoundingClientRect().bottom
    await scrollTo(card, 60)
    // the sticky header stayed pinned near the card's top edge — it did NOT scroll away with the body.
    expect(
      Math.abs(header.getBoundingClientRect().top - headerTopBefore),
      `${server.browser}: the sticky header moved when the card scrolled`,
    ).toBeLessThan(2)
    // and the sticky footer stayed pinned near the card's bottom edge ("Footer stays put").
    expect(
      Math.abs(footer.getBoundingClientRect().bottom - footerBottomBefore),
      `${server.browser}: the sticky footer moved when the card scrolled`,
    ).toBeLessThan(2)
  })

  // ── The two review-required gutter proofs (render-and-measure, both engines) ─────────────────────────
  it('[review] scroll-mode gutters are REAL px + the sticky footer keeps a ~6px bottom gutter through scroll', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    // top gutter: the header's border-box top sits ~6px below the card's padding-box top (the region inset margin)
    const topGutter = header.getBoundingClientRect().top - (card.getBoundingClientRect().top + px(getComputedStyle(card).borderTopWidth))
    expect(topGutter, `${server.browser}: the scroll-mode top gutter is not ~6px (${topGutter})`).toBeGreaterThanOrEqual(4)
    expect(topGutter, `${server.browser}: the scroll-mode top gutter is too large (${topGutter})`).toBeLessThanOrEqual(9)
    // bottom gutter THROUGH scroll: scroll to the end; the sticky footer stays ~6px above the card's bottom edge
    // (the sticky bracket provides the gutter — no scroll-container padding/margin quirk).
    await scrollTo(card, card.scrollHeight)
    const viewportBottom = card.getBoundingClientRect().bottom - px(getComputedStyle(card).borderBottomWidth)
    const bottomGutter = viewportBottom - footer.getBoundingClientRect().bottom
    expect(bottomGutter, `${server.browser}: the sticky footer's ~6px bottom gutter collapsed on scroll (${bottomGutter})`).toBeGreaterThanOrEqual(4)
    expect(bottomGutter, `${server.browser}: the sticky footer's bottom gutter is too large (${bottomGutter})`).toBeLessThanOrEqual(9)
  })

  it('[review] NO-footer: the last content stays off the card edge at max scroll (the region PADDING is a robust gutter, not the collapsible margin)', async () => {
    // The classic cross-engine quirk (WebKit historically dropped a scroll-container last-child MARGIN from the
    // scroll extent) can't bite here: the visible gutter is the content region's OWN padding-block-end (6px,
    // INSIDE its border-box → always in the scroll extent), not the inter-region margin. Prove it survives.
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px" id="tail">tall</div></ui-card-content></ui-card>',
    )
    const tail = card.querySelector('#tail') as HTMLElement
    await scrollTo(card, card.scrollHeight)
    const viewportBottom = card.getBoundingClientRect().bottom - px(getComputedStyle(card).borderBottomWidth)
    const gutter = viewportBottom - tail.getBoundingClientRect().bottom
    expect(gutter, `${server.browser}: the last content sat flush to the card edge at max scroll (${gutter}px)`).toBeGreaterThanOrEqual(4)
  })
})
