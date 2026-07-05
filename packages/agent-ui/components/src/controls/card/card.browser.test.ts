import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

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
import { UICardContentElement } from './card-content.ts'
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
 * Parse the RESOLVED gradient stop offsets out of a computed `mask-image` — the actual px depth at which the
 * top/bottom fade turns fully opaque, per Kim's ask ("depending on header and footer presence we can offset
 * the start of the gradient transition coordinates"). Both engines serialize the same 4-stop shape
 * (`rgba(0,0,0,0) 0px, rgb(0,0,0) <top>px, rgb(0,0,0) calc(100% - <bottom>px), rgba(0,0,0,0) 100%`) once BOTH
 * edges are fading (the mid-scroll state every presence test below uses), so one engine-agnostic regex covers
 * Chromium + WebKit alike. Returns `NaN` for either side if the mask isn't the expected 4-stop shape.
 */
const gradientOffsets = (el: HTMLElement): { top: number; bottom: number } => {
  const m = maskOf(el)
  const top = m.match(/rgba?\(0,\s*0,\s*0(?:,\s*1)?\)\s*([\d.]+)px/)
  const bottom = m.match(/calc\(100%\s*-\s*([\d.]+)px\)/)
  return { top: top ? Number(top[1]) : NaN, bottom: bottom ? Number(bottom[1]) : NaN }
}

/** The rendered band a sticky bracket occupies — its border-box block-size + its inset margin to the frame.
 * Mirrors `traits/scroll-fade.ts`'s own `bandOf()` so the test measures independently of the trait's internals
 * (getBoundingClientRect + getComputedStyle, not offsetHeight/parseFloat) yet the SAME physical quantity. */
const bracketBand = (el: HTMLElement, top: boolean): number => {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().height + px(top ? cs.marginBlockStart : cs.marginBlockEnd)
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

  it('[scrollable] makes ui-card-content the scroll viewport — the CARD stays bounded, header/footer are OVERLAID (position:absolute)', () => {
    // REVISED 2026-07-07 (Kim: "<ui-card-content> should have the mask and manage overflow ... it should be set
    // to use 100% of its parent height when [scrollable]"): ui-card-content itself is now the bounded scroll
    // viewport (overflow-y:auto), NOT the card — the card only supplies the flex-column sizing mechanism. Off
    // the content-level [scrollable] signal (A2UI).
    const card = mount(
      '<ui-card style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content scrollable><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    // ui-card-content IS the scroll viewport and genuinely overflows its own (flex-filled) bounded height
    expect(getComputedStyle(content).overflowY, 'ui-card-content is not the scroll viewport').toBe('auto')
    expect(content.scrollHeight, 'ui-card-content did not overflow its bounded height').toBeGreaterThan(content.clientHeight)
    // the CARD does NOT scroll any more — content does
    expect(getComputedStyle(card).overflowY, 'the card is wrongly still a scroll viewport').not.toBe('auto')
    expect(card.scrollHeight, 'the card itself overflowed (the flex column should keep it exactly bounded)').toBeLessThanOrEqual(card.clientHeight + 1)
    // the card stayed bounded — it did NOT grow to fit the 400px child (the max-block-size held)
    expect(card.getBoundingClientRect().height, 'the card grew past its max-block-size').toBeLessThanOrEqual(110)
    // the brackets are OVERLAID PEERS (position:absolute), not sticky and not flex items
    expect(getComputedStyle(header).position, 'the header is not absolute').toBe('absolute')
    expect(getComputedStyle(footer).position, 'the footer is not absolute').toBe('absolute')
    expect(getComputedStyle(card).position, 'the card is not position:relative (the overlay anchor)').toBe('relative')
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
//  Edge-aware scroll fade — ui-card-content IS the viewport (REVISED 2026-07-07, Kim, verbatim:
//  "<ui-card-content> should have the mask and manage overflow, and adjust block-padding and linear gradient
//  coordinates based on presence of the peer footer and header. it should be set to use 100% of its parent
//  height when [scrollable]"). SUPERSEDES both the 2026-07-05 card-as-viewport shape AND the short-lived
//  2026-07-06 WRAPPER MODEL — there is now only ONE shape: ui-card-content scrolls directly, is masked
//  directly, and header/footer are OVERLAID peers (position:absolute) rather than sticky/flex siblings. This
//  keeps the running mid-scroll fade the retired wrapper model fixed (content's own box is bounded via flex,
//  so its "full height" IS the small visible frame throughout) WITHOUT a separate wrapper element.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-card scroll mode — ui-card-content is the viewport; header/footer are overlaid peers', () => {
  it('at the TOP: ui-card-content gets data-fade-bottom (more below) not data-fade-top; the CARD carries neither', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, 0)

    expect(content.hasAttribute('data-fade-top'), `${server.browser}: fresh scroll wrongly fades the top`).toBe(false)
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}: content did not fade its bottom (more below)`).toBe(true)
    // anti-vacuous: the flags live on ui-card-content, NOT the card.
    expect(
      card.hasAttribute('data-fade-top') || card.hasAttribute('data-fade-bottom'),
      'a fade flag leaked onto the card',
    ).toBe(false)
  })

  it('scrolled to the MIDDLE: both edges of ui-card-content fade', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, (content.scrollHeight - content.clientHeight) / 2) // well inside, neither edge
    expect(content.hasAttribute('data-fade-top'), `${server.browser}`).toBe(true)
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}`).toBe(true)
  })

  it('scrolled to the BOTTOM: top fades, bottom does not (nothing left below)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, content.scrollHeight) // the browser clamps to the real max
    expect(content.hasAttribute('data-fade-top'), `${server.browser}: end-of-scroll did not fade the top`).toBe(true)
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}: end-of-scroll wrongly kept fading the bottom`).toBe(false)
  })

  it('AUTOMATIC — <ui-card scrollable> fades with NO opt-in attribute (the mask is inherent to scroll mode)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(content.scrollHeight, 'ui-card-content did not genuinely overflow (test setup is vacuous)').toBeGreaterThan(content.clientHeight)
    await scrollTo(content, 40)
    expect(
      content.hasAttribute('data-fade-top') || content.hasAttribute('data-fade-bottom'),
      `${server.browser}: a scrollable card did not automatically fade its content`,
    ).toBe(true)
  })

  it('also arms off the CONTENT-level [scrollable] signal (the A2UI mapping) — no card-level attr needed', async () => {
    const card = mount(
      '<ui-card style="max-block-size: 100px"><ui-card-content scrollable>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(content.scrollHeight, 'ui-card-content did not overflow (test setup is vacuous)').toBeGreaterThan(content.clientHeight)
    await scrollTo(content, 40)
    expect(
      content.hasAttribute('data-fade-top') || content.hasAttribute('data-fade-bottom'),
      `${server.browser}: the content-level [scrollable] signal did not arm the fade`,
    ).toBe(true)
  })

  it('a NON-scrolling card in scroll mode never fades (self-gates on real overflow — never a flat guess)', () => {
    const card = mount('<ui-card scrollable><ui-card-content><p>short</p></ui-card-content></ui-card>')
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(content.scrollHeight, 'ui-card-content unexpectedly overflows (test setup is vacuous)').toBeLessThanOrEqual(content.clientHeight + 1)
    expect(content.hasAttribute('data-fade-top')).toBe(false)
    expect(content.hasAttribute('data-fade-bottom')).toBe(false)
  })

  it('the rendered mask PAINTS on ui-card-content from the flags — a gradient when scrolling, none when it fits, NEVER on the card', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, 0)
    expect(maskOf(content), `${server.browser}: at the top, only-bottom-faded should still paint a gradient`).toMatch(/gradient/)
    expect(maskOf(card), `${server.browser}: the card itself must never carry the mask`).toBe('none')

    await scrollTo(content, (content.scrollHeight - content.clientHeight) / 2)
    expect(maskOf(content), `${server.browser}: mid-scroll (both edges) should paint a gradient`).toMatch(/gradient/)

    // a NON-scrolling card never paints a mask.
    const plain = mount('<ui-card><ui-card-content><p>short</p></ui-card-content></ui-card>')
    expect(maskOf(plain.querySelector('ui-card-content') as HTMLElement), `${server.browser}: a non-scrolling card painted a mask`).toBe(
      'none',
    )
  })

  it('[MUST-PASS] the OVERLAID header/footer NEVER carry the mask, at any scroll position (crisp brackets)', async () => {
    // Kim's ask: "the mask should not be placed on the container element — it should be on ui-card-content". The
    // must-pass proof — the brackets never receive a `data-fade-*` flag or a mask-image, at rest, mid-scroll, or
    // at the end, in either engine — now proven against ui-card-content's OWN scroll (not the card's).
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    for (const top of [0, content.scrollHeight / 2, content.scrollHeight]) {
      await scrollTo(content, top)
      expect(header.hasAttribute('data-fade-top') || header.hasAttribute('data-fade-bottom'), `${server.browser}: header faded at scrollTop=${top}`).toBe(false)
      expect(footer.hasAttribute('data-fade-top') || footer.hasAttribute('data-fade-bottom'), `${server.browser}: footer faded at scrollTop=${top}`).toBe(false)
      expect(maskOf(header), `${server.browser}: header carries a mask at scrollTop=${top}`).toBe('none')
      expect(maskOf(footer), `${server.browser}: footer carries a mask at scrollTop=${top}`).toBe('none')
    }
  })

  it('[WHCM] scroll-mode brackets get an opaque Canvas fallback — the sole occluder left once the mask drops', async () => {
    // component-review finding (2026-07-07): the overlaid brackets are deliberately backgroundless in NORMAL
    // rendering ("the gradient carries the occlusion") — but the shared [data-fade-top]/[data-fade-bottom]
    // forced-colors rule (container-box.css) drops that gradient entirely under WHCM, leaving nothing to
    // occlude scrolled content behind the bracket text. card.css's WHCM-only bracket background is the fix.
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    await scrollTo(content, 40)

    // Baseline (BOTH engines): normal rendering keeps the brackets see-through, and content genuinely masks.
    expect(alphaOf(getComputedStyle(header).backgroundColor), 'baseline header unexpectedly painted a background').toBe(0)
    expect(alphaOf(getComputedStyle(footer).backgroundColor), 'baseline footer unexpectedly painted a background').toBe(0)
    expect(maskOf(content), 'baseline content did not paint a gradient (test setup is vacuous)').toMatch(/gradient/)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      // The shared rule drops the sole (gradient) occluder under WHCM…
      expect(maskOf(content), 'the mask should be dropped under WHCM').toBe('none')
      // …so the bracket fallback background is now the ONLY thing keeping scrolled content from bleeding
      // through the bracket text.
      expect(alphaOf(getComputedStyle(header).backgroundColor), 'WHCM header stayed transparent — scrolled content can bleed through the bracket text').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(footer).backgroundColor), 'WHCM footer stayed transparent — scrolled content can bleed through the bracket text').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })

  it('[structural] header/footer are OVERLAID PEERS (position:absolute) — their rect stays FIXED as content scrolls (they are not part of the scrolled content)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    expect(getComputedStyle(header).position, `${server.browser}: header is not absolute`).toBe('absolute')
    expect(getComputedStyle(footer).position, `${server.browser}: footer is not absolute`).toBe('absolute')
    const headerTopBefore = header.getBoundingClientRect().top
    const footerBottomBefore = footer.getBoundingClientRect().bottom
    await scrollTo(content, content.scrollHeight / 2)
    // the OVERLAID header/footer stayed put — they did NOT scroll away with the body (unlike the retired
    // sticky-in-the-scroll-container model, they are entirely outside the scrolled element now).
    expect(
      Math.abs(header.getBoundingClientRect().top - headerTopBefore),
      `${server.browser}: the overlaid header moved when content scrolled`,
    ).toBeLessThan(1)
    expect(
      Math.abs(footer.getBoundingClientRect().bottom - footerBottomBefore),
      `${server.browser}: the overlaid footer moved when content scrolled`,
    ).toBeLessThan(1)
  })

  it('presence-aware: ui-card-content publishes POSITIVE --ui-box-head/foot bands measured off the card\'s header/footer', async () => {
    // The bracket QUERY runs against the card (its direct children), even though the offsets + the mask land
    // on ui-card-content — the fade's opaque end lands past the bracket + fade depth, never blanking the brackets.
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, 40)
    const head = content.style.getPropertyValue('--ui-box-head')
    const foot = content.style.getPropertyValue('--ui-box-foot')
    expect(px(head), `${server.browser}: the header band was not published (${head})`).toBeGreaterThan(0)
    expect(px(foot), `${server.browser}: the footer band was not published (${foot})`).toBeGreaterThan(0)
    expect(maskOf(content), `${server.browser}: the presence-aware fade did not paint`).toMatch(/gradient/)
    // anti-vacuous: the card itself publishes NEITHER — the offsets are content's alone.
    expect(card.style.getPropertyValue('--ui-box-head')).toBe('')
    expect(card.style.getPropertyValue('--ui-box-foot')).toBe('')
  })

  // ── Kim's ask: "adjust block-padding and linear gradient coordinates based on presence of the peer footer
  // and header" — ONE measured source (the bracket band), TWO consumers: ui-card-content's own block-padding
  // (so its first/last visible line clears the overlaid bracket) AND the gradient's opaque-end offset
  // (container-box.css, unchanged formula). All FOUR presence combinations, both engines. ──
  describe('presence-aware BLOCK-PADDING + gradient OFFSET — all four header/footer presence combinations', () => {
    const combos = [
      { label: 'both', header: true, footer: true },
      { label: 'header-only', header: true, footer: false },
      { label: 'footer-only', header: false, footer: true },
      { label: 'neither', header: false, footer: false },
    ] as const

    for (const { label, header: hasHeader, footer: hasFooter } of combos) {
      it(`[${label}] block-padding clears a present bracket's band (else the plain 6px region pad); the gradient offset == band + fade depth (else the plain fade depth)`, async () => {
        const markup =
          (hasHeader ? '<ui-card-header>H</ui-card-header>' : '') +
          '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
          (hasFooter ? '<ui-card-footer>F</ui-card-footer>' : '')
        const card = mount(`<ui-card scrollable style="max-block-size: 120px">${markup}</ui-card>`)
        const content = card.querySelector('ui-card-content') as HTMLElement
        const header = card.querySelector('ui-card-header') as HTMLElement | null
        const footer = card.querySelector('ui-card-footer') as HTMLElement | null

        // Ground truth for BOTH formulas, off a companion bracket-less card — no hardcoded token value, so
        // these hold even if the padding/fade-depth tokens are retuned later.
        const baseline = mount(
          '<ui-card scrollable style="max-block-size: 120px"><ui-card-content><div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
        )
        const baselineContent = baseline.querySelector('ui-card-content') as HTMLElement
        const plainPad = px(getComputedStyle(baselineContent).paddingTop) // the plain region pad (no bracket)
        await scrollTo(baselineContent, baselineContent.scrollHeight / 2)
        const fadeDepth = gradientOffsets(baselineContent).top
        expect(fadeDepth, `${server.browser}: could not establish the baseline fade depth`).toBeGreaterThan(0)

        // The BLOCK-PADDING proof — a static box-model property, measured at rest (before any scroll).
        const padTop = px(getComputedStyle(content).paddingTop)
        const padBottom = px(getComputedStyle(content).paddingBottom)
        if (hasHeader) {
          const band = bracketBand(header as HTMLElement, true)
          expect(padTop, `${server.browser} [${label}]: top padding did not clear the header band (${band})`).toBeCloseTo(band, 0)
        } else {
          expect(padTop, `${server.browser} [${label}]: an ABSENT header did not collapse the top padding to the plain region pad (${plainPad})`).toBeCloseTo(plainPad, 0)
        }
        if (hasFooter) {
          const band = bracketBand(footer as HTMLElement, false)
          expect(padBottom, `${server.browser} [${label}]: bottom padding did not clear the footer band (${band})`).toBeCloseTo(band, 0)
        } else {
          expect(padBottom, `${server.browser} [${label}]: an ABSENT footer did not collapse the bottom padding to the plain region pad (${plainPad})`).toBeCloseTo(plainPad, 0)
        }

        // The GRADIENT OFFSET proof (unchanged container-box.css formula) — mid-scroll, so BOTH edges fade
        // regardless of bracket presence, isolating presence as the only variable this measures.
        await scrollTo(content, content.scrollHeight / 2)
        expect(content.hasAttribute('data-fade-top'), `${server.browser} [${label}]: top did not fade mid-scroll`).toBe(true)
        expect(content.hasAttribute('data-fade-bottom'), `${server.browser} [${label}]: bottom did not fade mid-scroll`).toBe(true)
        const { top, bottom } = gradientOffsets(content)
        if (hasHeader) {
          const band = bracketBand(header as HTMLElement, true)
          expect(top, `${server.browser} [${label}]: top offset != header band (${band}) + fade depth (${fadeDepth})`).toBeCloseTo(band + fadeDepth, 0)
          expect(maskOf(header as HTMLElement), `${server.browser} [${label}]: header carries a mask`).toBe('none')
        } else {
          expect(top, `${server.browser} [${label}]: an ABSENT header did not collapse the top offset to the plain fade depth`).toBeCloseTo(fadeDepth, 0)
        }
        if (hasFooter) {
          const band = bracketBand(footer as HTMLElement, false)
          expect(bottom, `${server.browser} [${label}]: bottom offset != footer band (${band}) + fade depth (${fadeDepth})`).toBeCloseTo(band + fadeDepth, 0)
          expect(maskOf(footer as HTMLElement), `${server.browser} [${label}]: footer carries a mask`).toBe('none')
        } else {
          expect(bottom, `${server.browser} [${label}]: an ABSENT footer did not collapse the bottom offset to the plain fade depth`).toBeCloseTo(fadeDepth, 0)
        }
      })
    }
  })

  it('[MUST-PROVE] mid-scroll: the see-through fade is VISIBLE at both content edges (the running fade, no wrapper needed)', async () => {
    const longContent = Array.from({ length: 30 }, (_, i) => `<p>Paragraph ${i} — scrollable content filler text.</p>`).join('')
    const card = mount(
      `<ui-card scrollable style="max-block-size: 220px"><ui-card-header>H</ui-card-header>` +
        `<ui-card-content>${longContent}</ui-card-content><ui-card-footer>F</ui-card-footer></ui-card>`,
    )
    const content = card.querySelector('ui-card-content') as HTMLElement

    await scrollTo(content, (content.scrollHeight - content.clientHeight) / 2)
    expect(content.hasAttribute('data-fade-top'), `${server.browser}: content did not fade its top mid-scroll`).toBe(true)
    expect(content.hasAttribute('data-fade-bottom'), `${server.browser}: content did not fade its bottom mid-scroll`).toBe(true)

    // The load-bearing proof of VISIBILITY, not just presence: the gradient's opaque-start offset must fall
    // WITHIN content's own (small, bounded) rendered height. content is bounded by `flex: 1 1 auto` against the
    // card's max-block-size (never the full un-clipped scroll extent — proven below), so its "full height" IS
    // the visible frame throughout the whole scroll — the fix the retired WRAPPER MODEL needed a separate
    // element for, now achieved by content managing its own overflow directly.
    const { top, bottom } = gradientOffsets(content)
    expect(top, `${server.browser}: the top fade offset (${top}) does not fall within content's own height (${content.clientHeight})`).toBeLessThan(
      content.clientHeight,
    )
    expect(
      content.clientHeight - bottom,
      `${server.browser}: the bottom fade's opaque-end (${bottom} from the bottom) does not fall within content's own height (${content.clientHeight})`,
    ).toBeGreaterThan(0)
    expect(content.clientHeight, `${server.browser}: content's own frame is implausibly tall for this proof to be meaningful`).toBeLessThan(300)
    // anti-vacuous structural proof: content genuinely overflows; the CARD does not (the flex column keeps it
    // exactly bounded — the mechanism realizing "100% of parent height").
    expect(content.scrollHeight, `${server.browser}: content did not genuinely overflow (test setup is vacuous)`).toBeGreaterThan(content.clientHeight)
    expect(card.scrollHeight, `${server.browser}: the CARD itself overflows (the flex column should keep it exactly bounded)`).toBeLessThanOrEqual(
      card.clientHeight + 1,
    )
  })

  // ── The review-required gutter proofs (render-and-measure, both engines) ─────────────────────────
  it('[review] scroll-mode gutters are REAL px + the overlaid footer keeps a ~6px bottom gutter through scroll', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const header = card.querySelector('ui-card-header') as HTMLElement
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    // top gutter: the header's border-box top sits ~6px below the card's padding-box top (the region inset margin)
    const topGutter = header.getBoundingClientRect().top - (card.getBoundingClientRect().top + px(getComputedStyle(card).borderTopWidth))
    expect(topGutter, `${server.browser}: the scroll-mode top gutter is not ~6px (${topGutter})`).toBeGreaterThanOrEqual(4)
    expect(topGutter, `${server.browser}: the scroll-mode top gutter is too large (${topGutter})`).toBeLessThanOrEqual(9)
    // bottom gutter THROUGH content's own scroll — the overlaid footer never moves at all (see [structural] above).
    await scrollTo(content, content.scrollHeight)
    const viewportBottom = card.getBoundingClientRect().bottom - px(getComputedStyle(card).borderBottomWidth)
    const bottomGutter = viewportBottom - footer.getBoundingClientRect().bottom
    expect(bottomGutter, `${server.browser}: the overlaid footer's ~6px bottom gutter collapsed on scroll (${bottomGutter})`).toBeGreaterThanOrEqual(4)
    expect(bottomGutter, `${server.browser}: the overlaid footer's bottom gutter is too large (${bottomGutter})`).toBeLessThanOrEqual(9)
  })

  it('[review] NO-footer: the last content stays off the card edge at max scroll (the region PADDING is a robust gutter, not a collapsible margin)', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px" id="tail">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    const tail = card.querySelector('#tail') as HTMLElement
    await scrollTo(content, content.scrollHeight)
    const gutter = content.getBoundingClientRect().bottom - tail.getBoundingClientRect().bottom
    expect(gutter, `${server.browser}: the last content sat flush to the viewport edge at max scroll (${gutter}px)`).toBeGreaterThanOrEqual(4)
  })

  it('[fixed] a SHORT card no longer force-overflows (flex fill — header/footer add no flow height, they are overlaid)', () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 220px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><p>Just one short line.</p></ui-card-content>' +
        '<ui-card-footer>Footer stays put</ui-card-footer></ui-card>',
    )
    const footer = card.querySelector('ui-card-footer') as HTMLElement
    expect(card.scrollHeight, `${server.browser}: a short card still force-overflows (${card.scrollHeight} vs ${card.clientHeight})`).toBeLessThanOrEqual(
      card.clientHeight + 1,
    )
    expect(card.hasAttribute('data-fade-top') || card.querySelector('ui-card-content')?.hasAttribute('data-fade-top')).toBeFalsy()
    // positional proof of the fill: the overlaid footer genuinely sits at the card's bottom edge — not
    // stranded mid-viewport under the short content, which `flex: 1 1 auto` on ui-card-content prevents.
    const viewportBottom = card.getBoundingClientRect().bottom - px(getComputedStyle(card).borderBottomWidth)
    const footerGutter = viewportBottom - footer.getBoundingClientRect().bottom
    expect(footerGutter, `${server.browser}: the footer is not at the card's bottom edge — content did not fill (gutter ${footerGutter})`).toBeGreaterThanOrEqual(4)
    expect(footerGutter, `${server.browser}: the footer's bottom gutter is too large — content did not fill (gutter ${footerGutter})`).toBeLessThanOrEqual(9)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// SCROLL MODE — the scrollbar is HIDDEN, keyboard operability (WCAG 2.1.1 — ADR-0046 Amendment 6, both engines)
// Kim's third option resolving "the mask fades the scrollbar": hide the native scrollbar CHROME entirely
// (native scrolling is unaffected) — the fade becomes the sole scroll affordance, and card-content.ts
// compensates with a reactive tabindex=0 + role=group so a keyboard-only user is never stranded.
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// Probe re-exposing the protected internals — vitest-browser locators are BLIND to internals-only ARIA
// (role/ariaLabelledByElements), the same gap tabs.browser.test.ts's probe precedent works around.
class ProbeCardContent extends UICardContentElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-card-content-axprobe', ProbeCardContent)

describe('ui-card-content — scroll mode: the scrollbar is HIDDEN, keyboard operability compensates (both engines)', () => {
  it('the native scrollbar is genuinely HIDDEN — scrollbar-width:none computed, no reserved layout gutter', () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-content>' +
        '<div style="block-size: 400px">tall</div></ui-card-content></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(content.scrollHeight, 'vacuous test setup — content did not overflow').toBeGreaterThan(content.clientHeight)
    const cs = getComputedStyle(content) as CSSStyleDeclaration & { scrollbarWidth?: string }
    expect(cs.scrollbarWidth, `${server.browser}: scrollbar-width did not compute to none`).toBe('none')
    // No reserved scrollbar gutter — a plain block with no border/own padding-box quirks, so offsetWidth
    // should equal clientWidth exactly UNLESS a scrollbar is still reserving space.
    expect(content.offsetWidth - content.clientWidth, `${server.browser}: a scrollbar gutter is still reserved`).toBe(0)
  })

  it('the DEFAULT (non-scroll) content region keeps its native scrollbar — the hide is scroll-mode-only', () => {
    const card = mount('<ui-card><ui-card-content>Body</ui-card-content></ui-card>')
    const content = card.querySelector('ui-card-content') as HTMLElement
    const cs = getComputedStyle(content) as CSSStyleDeclaration & { scrollbarWidth?: string }
    expect(cs.scrollbarWidth, `${server.browser}: a non-scroll card content wrongly hid its scrollbar`).not.toBe('none')
  })

  it('tabindex=0 + role=group are LIVE on a real engine (internals-only ARIA, read via the probe)', () => {
    const card = mount('<ui-card scrollable style="max-block-size: 100px"><ui-card-header>Title</ui-card-header></ui-card>')
    const content = new ProbeCardContent()
    content.innerHTML = '<div style="block-size: 400px">tall</div>'
    card.append(content)
    expect(content.getAttribute('tabindex'), `${server.browser}: not a real tab stop`).toBe('0')
    expect(content.ii.role, `${server.browser}: role did not land on internals`).toBe('group')
    expect(content.getAttribute('role'), `${server.browser}: role leaked onto the host attribute`).toBeNull()
  })

  it('[MUST-PROVE] KEYBOARD scroll — deterministic EXPLICIT handler, not the cross-engine-inconsistent platform default', async () => {
    // MEASURED finding this test setup exposed: a focused, tabindex=0, overflow:auto DIV is NOT reliably
    // keyboard-scrollable by the platform's own default action across engines — Chromium moved it (once
    // genuinely, trusted-click-focused); WebKit did not move it AT ALL, confirming the "WebKit lags" gap
    // flagged at design time. card-content.ts therefore wires an EXPLICIT keydown handler (40px/arrow press,
    // 90%-of-viewport/Page, 0/Home, scrollHeight/End) and calls preventDefault() — deterministic, identical
    // px amounts on BOTH engines, not a per-platform default it merely hopes fires.
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        `<ui-card-content>${Array.from({ length: 20 }, (_, i) => `<p>Paragraph ${i}</p>`).join('')}</ui-card-content>` +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    expect(content.scrollHeight, 'vacuous test setup — content did not overflow').toBeGreaterThan(content.clientHeight)
    expect(content.getAttribute('tabindex'), `${server.browser}: not a real tab stop`).toBe('0')

    // A genuine, trusted click establishes focus (Chromium's own default action needs exactly this — a bare
    // `.focus()` call was measured NOT to suffice there; a real click is also the representative real-world
    // path a mouse-then-keyboard user actually takes).
    await userEvent.click(content)
    expect(document.activeElement, `${server.browser}: content did not actually take focus`).toBe(content)

    await userEvent.keyboard('{ArrowDown}')
    expect(content.scrollTop, `${server.browser}: ArrowDown did not move exactly one line (40px)`).toBeCloseTo(40, 0)
    await userEvent.keyboard('{ArrowDown}')
    expect(content.scrollTop, `${server.browser}: a second ArrowDown did not add another line`).toBeCloseTo(80, 0)
    await userEvent.keyboard('{ArrowUp}')
    expect(content.scrollTop, `${server.browser}: ArrowUp did not move back exactly one line`).toBeCloseTo(40, 0)

    await userEvent.keyboard('{PageDown}')
    expect(content.scrollTop, `${server.browser}: PageDown did not move ~90% of the viewport`).toBeCloseTo(40 + content.clientHeight * 0.9, 0)

    await userEvent.keyboard('{End}')
    // the browser clamps scrollTop to the real max (scrollHeight − clientHeight) — setting it to the raw
    // scrollHeight (the handler's own literal) is the correct "go to the very end" idiom, not a bug.
    expect(content.scrollTop, `${server.browser}: End did not reach the bottom`).toBeCloseTo(content.scrollHeight - content.clientHeight, 0)
    await userEvent.keyboard('{Home}')
    expect(content.scrollTop, `${server.browser}: Home did not return to the top`).toBe(0)
  })

  it('the welded see-through fade is UNCHANGED by hiding the scrollbar — still ramps mid-scroll, mask logic untouched', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 120px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const content = card.querySelector('ui-card-content') as HTMLElement
    await scrollTo(content, content.scrollHeight / 2)
    expect(maskOf(content), `${server.browser}: mid-scroll fade should still paint — hiding the scrollbar must not touch the mask`).toMatch(/gradient/)
  })

  it('WHCM: scroll-mode brackets keep their Canvas fallback — unrelated to (and unaffected by) hiding the scrollbar', async () => {
    const card = mount(
      '<ui-card scrollable style="max-block-size: 100px"><ui-card-header>H</ui-card-header>' +
        '<ui-card-content><div style="block-size: 400px">tall</div></ui-card-content>' +
        '<ui-card-footer>F</ui-card-footer></ui-card>',
    )
    const header = card.querySelector('ui-card-header') as HTMLElement
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(header).backgroundColor), `${server.browser}: WHCM header lost its Canvas fallback`).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  /** A resolved, visible outline on `el` — the button-states.browser.test.ts precedent's own helper. */
  const ringDrawn = (el: HTMLElement): boolean => {
    const cs = getComputedStyle(el)
    return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0 && alphaOf(cs.outlineColor) > 0
  }

  const tallCard = (): HTMLElement =>
    mount(
      '<ui-card scrollable style="max-block-size: 120px; max-inline-size: 220px"><ui-card-header>Title</ui-card-header>' +
        `<ui-card-content>${Array.from({ length: 20 }, (_, i) => `<p>Paragraph ${i}</p>`).join('')}</ui-card-content>` +
        '<ui-card-footer>Footer</ui-card-footer></ui-card>',
    )

  it('[ADR-0009] KEYBOARD focus (Tab) into ui-card-content draws the fleet ring on the PARENT card', async () => {
    // component-review, 2026-07-08 → Kim, superseding an earlier inset/negative-offset draft: ui-card-content's
    // tabindex=0 is the tab stop, but the RING paints on the parent ui-card, via `:has(> ui-card-content:focus-
    // visible)` — the card reacts to its content region's focus state rather than drawing its own ring on a
    // scroll container that would clip it.
    const card = tallCard()
    const content = card.querySelector('ui-card-content') as HTMLElement
    await userEvent.tab() // real Tab → keyboard modality → :focus-visible matches (content is the only tab stop mounted)
    expect(document.activeElement, `${server.browser}: Tab did not land on ui-card-content`).toBe(content)

    const cs = getComputedStyle(card)
    expect(cs.outlineStyle, `${server.browser}: no focus outline style on the card when its content is keyboard-focused`).toBe('solid')
    expect(px(cs.outlineWidth), `${server.browser}: focus outline width is not the 2px ring`).toBeCloseTo(2, 0)
    expect(alphaOf(cs.outlineColor), `${server.browser}: focus ring colour vanished`).toBeGreaterThan(0)
  })

  it('[ADR-0009] the card\'s ring is NOT clipped (own overflow:visible) and uses the STANDARD outward offset', async () => {
    // Screenshot-verified during development (Chromium + WebKit): moving the ring to the card side-steps the
    // clipping problem entirely rather than working around it — ui-card itself carries no `overflow` (default
    // `visible`), so the fleet's usual POSITIVE (outward) offset just works, no sign flip. The ring reads
    // cleanly around the card's full edge, including where it passes beneath the overlaid, backgroundless
    // header/footer (same see-through trade-off the mask itself already makes there).
    const card = tallCard()
    const content = card.querySelector('ui-card-content') as HTMLElement
    await userEvent.tab()
    expect(document.activeElement, `${server.browser}: Tab did not land on ui-card-content`).toBe(content)

    const cs = getComputedStyle(card)
    expect(cs.outlineStyle, `${server.browser}`).toBe('solid')
    expect(alphaOf(cs.outlineColor), `${server.browser}: the ring resolved invisible`).toBeGreaterThan(0)
    expect(getComputedStyle(card).overflow, `${server.browser}: the card has no overflow of its own to clip the ring`).toBe('visible')
    // MEASURED: no divergence from the fleet norm any more — the STANDARD positive (outward) offset, same
    // constant every other :focus-visible consumer reads (checkbox.css is the fleet reference).
    expect(px(cs.outlineOffset), `${server.browser}: the offset should be the fleet's STANDARD positive (outward) value`).toBeGreaterThan(0)
  })

  it('[ADR-0009] MOUSE click into content does NOT draw the ring (:focus-visible keyboard-only contract)', async () => {
    const card = tallCard()
    const content = card.querySelector('ui-card-content') as HTMLElement
    await userEvent.click(content) // pointer modality → :focus-visible must NOT match
    expect(document.activeElement, `${server.browser}: click did not focus ui-card-content`).toBe(content)
    expect(ringDrawn(card), `${server.browser}: a mouse click into content drew the focus ring on the card (:focus-visible matched on pointer)`).toBe(false)
  })

  it('[ADR-0009] forced-colors keeps the keyboard ring on the card — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const card = tallCard()
    const content = card.querySelector('ui-card-content') as HTMLElement
    await userEvent.tab()
    expect(document.activeElement, `${server.browser}: Tab did not land on ui-card-content`).toBe(content)
    expect(ringDrawn(card), 'no keyboard ring on the card in normal mode').toBe(true)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the documented split, see button-states.browser.test.ts) —
      // assert we are genuinely NOT in forced-colors (so the Chromium proof below is not silently faked) and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      // the ring SURVIVES forced-colors on the CARD now (it moved off the scroll container): `--md-sys-color-
      // focus-ring → Highlight` keeps a visible outline.
      expect(ringDrawn(card), 'the focus ring on the card vanished under forced-colors').toBe(true)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
