// radio-group-segmented.browser.test.ts — cross-engine browser smoke for ui-radio-group[variant=segmented]
// (ADR-0086). Runs in Chromium + WebKit (vitest.browser.config.ts). Where the jsdom probes in
// radio-group.test.ts pin the reflected props / resolved-orientation / roving-axis / state-seam writes, this
// file pins what a real engine PAINTS + LAYS OUT: the grid track, the ONE shared moving `::before` indicator's
// geometry + transform slide, the motion gate, the fill-presence non-color signal, the interaction-state
// washes, and the forced-colors inversion — all structurally unavailable to jsdom (no @scope grid layout, no
// `::before` geometry, no `transform`, no `:has()`-driven visibility proof, no forced-colors emulation).
//
// "Test the whole shape" (the fleet law): every assertion below reads the REAL rendered bounding box/transform
// of the group and its segments, not just a per-part declared px.

import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; group: HTMLElement; radios: HTMLElement[] } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const group = wrap.querySelector('ui-radio-group') as HTMLElement
  const radios = [...wrap.querySelectorAll('ui-radio')] as HTMLElement[]
  return { wrap, group, radios }
}
afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const before = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::before')
const bg = (el: Element): string => getComputedStyle(el).backgroundColor
const beforeBg = (el: Element): string => before(el).backgroundColor
const ink = (el: Element): string => getComputedStyle(el).color

/** Resolve a `--ui-radio-group-*`/`--md-sys-color-*` token to its serialized colour on a throwaway probe. */
const resolveToken = (host: HTMLElement, tokenVar: string): string => {
  const probe = document.createElement('span')
  probe.style.background = `var(${tokenVar})`
  host.append(probe)
  const c = bg(probe)
  probe.remove()
  return c
}

/** Parse a `matrix(a, b, c, d, tx, ty)` transform string into its translate components (0,0 for 'none'). */
const translateOf = (transform: string): { tx: number; ty: number } => {
  const m = /matrix\(([^)]+)\)/.exec(transform)
  if (!m) return { tx: 0, ty: 0 }
  const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
  return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const HORIZONTAL = `
  <ui-radio-group variant="segmented">
    <ui-radio value="a">One</ui-radio>
    <ui-radio value="b">Two</ui-radio>
    <ui-radio value="c">Three</ui-radio>
  </ui-radio-group>
`
const VERTICAL = `
  <ui-radio-group variant="segmented" orientation="vertical">
    <ui-radio value="a">One</ui-radio>
    <ui-radio value="b">Two</ui-radio>
    <ui-radio value="c">Three</ui-radio>
  </ui-radio-group>
`

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Grid track + segment geometry — a REAL row/stack (equal cells), not a collapsed sliver
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-radio-group[segmented] — grid track + segment geometry (both engines)', () => {
  it('horizontal: display:grid, equal-width cells, one outer rounded track, collapsed dividers', () => {
    const { group, radios } = mount(HORIZONTAL)
    expect(getComputedStyle(group).display).toBe('grid')
    expect(group.getAttribute('orientation'), 'segmented defaults to horizontal with no explicit orientation').toBe('horizontal')

    const rects = radios.map((r) => r.getBoundingClientRect())
    // real bounding box — the group has non-zero width/height (not a collapsed sliver).
    const groupRect = group.getBoundingClientRect()
    expect(groupRect.width).toBeGreaterThan(0)
    expect(groupRect.height).toBeGreaterThan(0)
    // equal cells ±1px
    for (const r of rects) expect(r.width).toBeCloseTo(rects[0]!.width, 0)
    // no inter-cell gap: each cell's left edge sits at the previous cell's right edge
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.left).toBeCloseTo(rects[i - 1]!.right, 0)

    // one outer rounded track
    const gcs = getComputedStyle(group)
    expect(px(gcs.borderTopWidth)).toBeCloseTo(1, 0)
    expect(px(gcs.borderTopLeftRadius)).toBeGreaterThan(0)

    // collapsed dividers: first segment suppresses its own leading border; the rest carry one.
    expect(px(getComputedStyle(radios[0]!).borderInlineStartWidth)).toBe(0)
    expect(px(getComputedStyle(radios[1]!).borderInlineStartWidth)).toBeCloseTo(1, 0)
    expect(px(getComputedStyle(radios[2]!).borderInlineStartWidth)).toBeCloseTo(1, 0)
  })

  it('vertical: a real stack — equal-height cells, block-start dividers collapsed', () => {
    const { group, radios } = mount(VERTICAL)
    expect(group.getAttribute('orientation')).toBe('vertical')
    const rects = radios.map((r) => r.getBoundingClientRect())
    for (const r of rects) expect(r.height).toBeCloseTo(rects[0]!.height, 0)
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.top).toBeCloseTo(rects[i - 1]!.bottom, 0)
    expect(px(getComputedStyle(radios[0]!).borderBlockStartWidth)).toBe(0)
    expect(px(getComputedStyle(radios[1]!).borderBlockStartWidth)).toBeCloseTo(1, 0)
  })

  it('segment geometry: block-size = --ui-height-md, padding-inline = height/2, padding-block = 0', () => {
    const { radios } = mount(HORIZONTAL)
    const seg = radios[0]!
    const cs = getComputedStyle(seg)
    const height = px(cs.blockSize)
    expect(height).toBeCloseTo(28, 0) // --ui-height-md default
    expect(px(cs.paddingInlineStart)).toBeCloseTo(height / 2, 0)
    expect(px(cs.paddingInlineEnd)).toBeCloseTo(height / 2, 0)
    expect(px(cs.paddingBlockStart)).toBe(0)
    expect(px(cs.paddingBlockEnd)).toBe(0)
    // line-height: read the --ui-control-line-height custom property (== '1'), NEVER assert
    // computed lineHeight === '1' (getComputedStyle returns the USED px value).
    expect(cs.getPropertyValue('--ui-control-line-height').trim()).toBe('1')
    expect(px(cs.lineHeight)).toBeCloseTo(px(cs.fontSize) * 1, 0)
  })

  it('the dot glyph is suppressed in segmented mode (display:none)', () => {
    const { radios } = mount(HORIZONTAL)
    expect(before(radios[0]!).display).toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The shared moving indicator — one artifact, sized to a cell, translated (never grid-placed)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-radio-group[segmented] — the shared moving indicator (both engines)', () => {
  it('no selection → the indicator is hidden (opacity 0)', () => {
    const { group } = mount(HORIZONTAL)
    expect(px(before(group).opacity)).toBe(0)
  })

  it('horizontal: indicator sizes to one cell, translateX == selectedIndex × cellWidth, and slides on reselect', async () => {
    const { group, radios } = mount(HORIZONTAL)
    await userEvent.click(radios[1]!)
    expect(px(before(group).opacity)).toBe(1) // appears instantly on first selection

    const cellWidth = radios[1]!.getBoundingClientRect().width
    const indicatorWidth = px(before(group).width)
    expect(indicatorWidth).toBeCloseTo(cellWidth, 0)

    // the ::before transitions `transform` over --ui-motion-fast (300ms) — a synchronous read right
    // after the click would sample a MID-FADE interpolated value (the same reasoning as the button
    // motion harness); poll until the transform SETTLES on the target translate instead.
    await expect.poll(() => translateOf(before(group).transform).tx, { timeout: 1500 }).toBeCloseTo(1 * cellWidth, 0)
    expect(translateOf(before(group).transform).ty).toBeCloseTo(0, 0)

    // grid-column/grid-row are NOT used to place the indicator (the animatable path is transform).
    expect(before(group).gridColumnStart).toBe('auto')
    expect(before(group).gridRowStart).toBe('auto')

    // slide on reselect
    await userEvent.click(radios[2]!)
    await expect.poll(() => translateOf(before(group).transform).tx, { timeout: 1500 }).toBeCloseTo(2 * cellWidth, 0)
  })

  it('vertical: indicator sizes to one cell, translateY == selectedIndex × cellHeight', async () => {
    const { group, radios } = mount(VERTICAL)
    await userEvent.click(radios[2]!)
    const cellHeight = radios[2]!.getBoundingClientRect().height
    const indicatorHeight = px(before(group).height)
    expect(indicatorHeight).toBeCloseTo(cellHeight, 0)
    await expect.poll(() => translateOf(before(group).transform).ty, { timeout: 1500 }).toBeCloseTo(2 * cellHeight, 0)
    expect(translateOf(before(group).transform).tx).toBeCloseTo(0, 0)
  })

  it('fill == --md-sys-color-primary-selected; selected ink == -on-primary; unselected ink == neutral-on-surface-variant', async () => {
    const { group, radios } = mount(HORIZONTAL)
    await userEvent.click(radios[0]!)
    expect(beforeBg(group)).toBe(resolveToken(group, '--md-sys-color-primary-selected'))
    expect(ink(radios[0]!)).toBe(resolveToken(group, '--md-sys-color-primary-on-primary'))
    expect(ink(radios[1]!)).toBe(resolveToken(group, '--md-sys-color-neutral-on-surface-variant'))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Motion — transition:transform over --ui-motion-fast; reduced-motion jumps
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-radio-group[segmented] — motion (both engines)', () => {
  it('the ::before transitions transform over --ui-motion-fast', () => {
    const { group } = mount(HORIZONTAL)
    const cs = before(group)
    expect(cs.transitionProperty).toContain('transform')
    expect(px(cs.transitionDuration) * 1000).toBeCloseTo(300, -1) // --ui-motion-fast = 300ms
  })

  it('reduced-motion ZEROES the transition — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const { group } = mount(HORIZONTAL)
    expect(px(before(group).transitionDuration)).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      expect(px(before(group).transitionDuration)).toBe(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Interaction states — unselected hover/active wash; selected holds; disabled holds at idle
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-radio-group[segmented] — interaction states (both engines)', () => {
  it('unselected hover repaints to --ui-radio-group-bg-hover (resolved via the group host)', async () => {
    const { radios } = mount(HORIZONTAL)
    const idle = bg(radios[0]!)
    await userEvent.hover(radios[0]!)
    await expect.poll(() => bg(radios[0]!)).not.toBe(idle)
    await userEvent.unhover(radios[0]!)
  })

  it('the SELECTED segment does not wash on hover (holds — a checked radio cannot toggle off)', async () => {
    const { radios } = mount(HORIZONTAL)
    await userEvent.click(radios[0]!)
    const selectedBg = bg(radios[0]!)
    await userEvent.hover(radios[0]!)
    expect(bg(radios[0]!)).toBe(selectedBg) // unchanged — no hover wash on the selected cell
    await userEvent.unhover(radios[0]!)
  })

  it('a disabled group holds at idle — no hover wash', async () => {
    const { group, radios } = mount(HORIZONTAL)
    group.setAttribute('disabled', '')
    const idle = bg(radios[1]!)
    await userEvent.hover(radios[1]!)
    expect(bg(radios[1]!)).toBe(idle)
    await userEvent.unhover(radios[1]!)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Focus ring — reused, unclipped, forced-colors-safe
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ringDrawn = (el: HTMLElement): boolean => {
  const cs = getComputedStyle(el)
  return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0
}

describe('ui-radio-group[segmented] — focus ring (both engines)', () => {
  it('Tab lands on a segment and draws the shared fleet focus ring (not clipped)', async () => {
    const { radios } = mount(HORIZONTAL)
    await userEvent.tab()
    expect(document.activeElement).toBe(radios[0]!)
    expect(ringDrawn(radios[0]! as HTMLElement)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] Forced colors — indicator inverts to Highlight/HighlightText; frame/ink hold ButtonText
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** Resolve a forced-colors SYSTEM KEYWORD (e.g. 'Highlight'/'HighlightText'/'ButtonText') to its serialized
 *  computed colour, via a throwaway probe (mirrors `resolveToken`, but for a literal keyword, not a
 *  `--custom-property`). Must be called WHILE forced-colors emulation is active. */
const resolveKeyword = (host: HTMLElement, keyword: string, channel: 'color' | 'background'): string => {
  const probe = document.createElement('span')
  probe.style.setProperty(channel, keyword)
  host.append(probe)
  const c = channel === 'color' ? getComputedStyle(probe).color : bg(probe)
  probe.remove()
  return c
}

describe('ui-radio-group[segmented] — forced-colors (Chromium emulates; WebKit baseline)', () => {
  it('under forced-colors: indicator → Highlight, selected ink → HighlightText, unselected ink → ButtonText, focus ring survives', async () => {
    const { group, radios } = mount(HORIZONTAL)
    await userEvent.click(radios[0]!)
    await userEvent.tab() // real Tab lands somewhere in the roving set

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      // the indicator still POSITIONS (transform still applies) — only fill/ink invert.
      const t = translateOf(before(group).transform)
      expect(Number.isFinite(t.tx)).toBe(true)
      expect(px(before(group).opacity)).toBe(1)

      // the actual inversion (decomp n19): indicator fill → Highlight; selected ink → HighlightText;
      // unselected ink → ButtonText — not just "still visible", the SPECIFIC WHCM system colours.
      expect(beforeBg(group)).toBe(resolveKeyword(group, 'Highlight', 'background'))
      expect(ink(radios[0]!)).toBe(resolveKeyword(group, 'HighlightText', 'color')) // selected (radios[0] was clicked)
      expect(ink(radios[1]!)).toBe(resolveKeyword(group, 'ButtonText', 'color')) // unselected
      // anti-vacuous: Highlight/HighlightText genuinely differ from the idle ButtonText/Canvas pairing.
      expect(ink(radios[0]!)).not.toBe(ink(radios[1]!))
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] Per-orientation roving — real focus + real Arrow keys (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-radio-group[segmented] — real roving per orientation (both engines)', () => {
  it('horizontal: ArrowRight moves REAL focus + selection to the next segment', async () => {
    const { group, radios } = mount(HORIZONTAL)
    ;(radios[0] as HTMLElement).focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(radios[1]!)
    expect((radios[1] as unknown as { checked: boolean }).checked).toBe(true)
  })

  it('vertical: ArrowDown moves REAL focus + selection to the next segment', async () => {
    const { group, radios } = mount(VERTICAL)
    ;(radios[0] as HTMLElement).focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(radios[1]!)
    expect((radios[1] as unknown as { checked: boolean }).checked).toBe(true)
  })
})
