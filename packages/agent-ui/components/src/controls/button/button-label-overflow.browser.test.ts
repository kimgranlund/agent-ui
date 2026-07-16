import { describe, it, expect, afterEach } from 'vitest'

// TKT-0042 / ADR-0133 — the cross-engine proof for the label-wrapper ellipsis mechanism. Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts). Two legs, both explicitly called for by the ticket's
// Acceptance criteria:
//   [1] byte-identical geometry when the label FITS (a real-engine regression check — the wrapper must add
//       zero visual footprint over the anonymous text it replaced).
//   [2] a real ellipsis when the label OVERFLOWS — this is CSS-only geometry (text-overflow rendering);
//       jsdom cannot prove it, only a real layout/paint engine can.
// A third leg proves the mechanism survives the exact write pattern that motivated the heal observer: the
// A2UI `buttonFactory`'s `el.textContent = label` (factories.ts:117-119).
//
// Side-effect imports — same load-bearing CSS order as button-geometry.browser.test.ts (ADR-0003).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; btn: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, btn: wrap.querySelector('ui-button') as HTMLElement }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const frameHeight = (btn: HTMLElement): number => px(getComputedStyle(btn).blockSize)
const padStartPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineStart)
const padEndPx = (btn: HTMLElement): number => px(getComputedStyle(btn).paddingInlineEnd)
const label = (btn: HTMLElement): HTMLElement => btn.querySelector('[data-part="label"]') as HTMLElement

/** Wait one microtask tick — long enough for a MutationObserver callback queued earlier to run (FIFO). */
const tick = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve))

describe('ui-button label-wrapper geometry regression (ADR-0133) — the label FITS', () => {
  it('a fitting label renders the SAME frame the pre-wrapper law specified: h=28, h/2=14 pads, no clipping engaged', () => {
    const { btn } = mount('<ui-button>Save</ui-button>') // md default, wide (unconstrained) container
    expect(frameHeight(btn), 'md frame height (geometry.md §1 row)').toBeCloseTo(28, 0)
    expect(padStartPx(btn), 'slotless h/2 leading pad').toBeCloseTo(14, 0)
    expect(padEndPx(btn), 'slotless h/2 trailing pad').toBeCloseTo(14, 0)

    const el = label(btn)
    expect(el, 'the label wrapper must exist').not.toBeNull()
    expect(el.tagName).toBe('SPAN')
    // anti-vacuous: the wrapper is NOT currently clipping anything — scrollWidth <= clientWidth (+1 rounding
    // slack). If this were > , the ellipsis mechanism would be firing on a label that FITS — a false positive.
    expect(el.scrollWidth, 'the fitting label must not be clipped').toBeLessThanOrEqual(el.clientWidth + 1)
  })

  it('leading-icon + label variant: geometry is unaffected by the wrapper — same [leading | label] law as button-geometry.browser.test.ts', () => {
    const { btn } = mount(
      '<ui-button><svg slot="leading" data-role="icon"><rect width="18" height="18"/></svg>Download</ui-button>',
    )
    const h = frameHeight(btn)
    expect(h).toBeCloseTo(28, 0)
    // leading slot edge = ½(h−icon); trailing (label) edge = h/2 — the wrapper must not perturb either.
    expect(padStartPx(btn)).toBeCloseTo((h - 18) / 2, 0)
    expect(padEndPx(btn)).toBeCloseTo(h / 2, 0)
    expect(label(btn).textContent).toBe('Download')
    // the leading adornment stays a DIRECT host child, not swept into the label wrapper.
    expect(btn.children[0]?.getAttribute('slot')).toBe('leading')
  })
})

describe('ui-button label overflow — a real ellipsis when the label does NOT fit (ADR-0133)', () => {
  it('a long label in a narrow host clips with a real rendered ellipsis — text-overflow engages, the host stays the constrained width', () => {
    const { btn } = mount('<ui-button>This label is far too long to fit in a narrow button</ui-button>')
    btn.style.inlineSize = '80px' // author-set explicit width — forces the 1fr label track to shrink

    const el = label(btn)
    expect(getComputedStyle(el).textOverflow, 'text-overflow must be the computed ellipsis value').toBe('ellipsis')
    // the REAL proof: the label's own content overflows its box (scrollWidth > clientWidth) — a genuine clip,
    // not just a declared-but-inert CSS property.
    expect(el.scrollWidth, 'the long label must genuinely overflow its wrapper box').toBeGreaterThan(el.clientWidth)
    // the host itself stayed at the constrained width — it did NOT grow to accommodate the full label text
    // (which would silently defeat the clip by making the box big enough to never overflow).
    expect(btn.getBoundingClientRect().width, 'the host must stay at the author-set width, not grow to fit').toBeCloseTo(80, 0)
    // no title/reveal mirror is minted (ADR-0133 explicitly carries none, unlike ui-text[truncate]/ADR-0106).
    expect(el.hasAttribute('title'), 'ui-button mints no title reveal mirror').toBe(false)
  })

  it('a SHORT label in the same narrow host does NOT clip — the ellipsis leg is content-driven, not a permanent clip', () => {
    const { btn } = mount('<ui-button>OK</ui-button>')
    btn.style.inlineSize = '80px'
    const el = label(btn)
    expect(el.scrollWidth, 'a short label must not overflow even at the same constrained width').toBeLessThanOrEqual(
      el.clientWidth + 1,
    )
  })
})

describe('ui-button label overflow survives a dynamic textContent write (the A2UI buttonFactory pattern)', () => {
  it('el.textContent = longLabel (factories.ts buttonFactory) rebuilds the wrapper fresh and still ellipsizes', async () => {
    const { btn } = mount('<ui-button>Short</ui-button>')
    btn.style.inlineSize = '80px'
    const originalLabel = label(btn)
    expect(originalLabel.scrollWidth).toBeLessThanOrEqual(originalLabel.clientWidth + 1) // fits initially

    btn.textContent = 'A freshly bound label that is much too long for this button'
    await tick()
    await tick()

    const healedLabel = label(btn)
    expect(healedLabel, 'the wrapper must be rebuilt after the textContent clobber').not.toBeNull()
    expect(healedLabel).not.toBe(originalLabel) // a fresh wrapper — the stale one is never reused
    expect(getComputedStyle(healedLabel).textOverflow).toBe('ellipsis')
    expect(healedLabel.scrollWidth, 'the newly bound long label must overflow and clip').toBeGreaterThan(
      healedLabel.clientWidth,
    )
  })
})
