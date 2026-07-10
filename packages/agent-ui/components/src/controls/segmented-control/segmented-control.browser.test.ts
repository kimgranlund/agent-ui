// segmented-control.browser.test.ts — cross-engine browser smoke for ui-segmented-control (ADR-0095;
// re-keyed VERBATIM from the retired radio-group-segmented.browser.test.ts, ADR-0086's own acceptance list
// re-targeted onto the new tag/tokens per ADR-0095's Acceptance clause). Runs in Chromium + WebKit
// (vitest.browser.config.ts). Where the jsdom probes in segmented-control.test.ts pin the reflected props /
// resolved-orientation / roving-axis / state-seam writes, this file pins what a real engine PAINTS + LAYS
// OUT: the grid track, the ONE shared moving `::before` indicator's geometry + transform slide, the motion
// gate, the fill-presence non-color signal, the interaction-state washes, and the forced-colors inversion —
// all structurally unavailable to jsdom (no @scope grid layout, no `::before` geometry, no `transform`, no
// `:has()`-driven visibility proof, no forced-colors emulation).
//
// "Test the whole shape" (the fleet law): every assertion below reads the REAL rendered bounding box/transform
// of the control and its segments, not just a per-part declared px.

import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; group: HTMLElement; segments: HTMLElement[] } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const group = wrap.querySelector('ui-segmented-control') as HTMLElement
  const segments = [...wrap.querySelectorAll('ui-segment')] as HTMLElement[]
  return { wrap, group, segments }
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

/** Resolve a `--ui-segmented-control-*`/`--md-sys-color-*` token to its serialized colour on a throwaway probe. */
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
  <ui-segmented-control>
    <ui-segment value="a">One</ui-segment>
    <ui-segment value="b">Two</ui-segment>
    <ui-segment value="c">Three</ui-segment>
  </ui-segmented-control>
`
const VERTICAL = `
  <ui-segmented-control orientation="vertical">
    <ui-segment value="a">One</ui-segment>
    <ui-segment value="b">Two</ui-segment>
    <ui-segment value="c">Three</ui-segment>
  </ui-segmented-control>
`

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Grid track + segment geometry — a REAL row/stack (equal cells), not a collapsed sliver
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-segmented-control — grid track + segment geometry (both engines)', () => {
  it('horizontal (the class default, NO explicit orientation): display:grid, equal-width cells, one outer rounded track, ZERO inter-segment dividers', () => {
    const { group, segments } = mount(HORIZONTAL)
    expect(getComputedStyle(group).display).toBe('grid')
    expect(group.getAttribute('orientation'), 'a bare ui-segmented-control defaults to horizontal').toBe('horizontal')

    const rects = segments.map((r) => r.getBoundingClientRect())
    // real bounding box — the control has non-zero width/height (not a collapsed sliver).
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

    // ZERO inter-segment dividers (Kim's ruling, 2026-07-09 — the outer track + the moving fill + the
    // hover washes carry the segmentation; the original collapsed-divider borders were removed): EVERY
    // segment, first included, renders with no border of its own on any edge.
    for (const seg of segments) {
      const cs = getComputedStyle(seg)
      expect(px(cs.borderInlineStartWidth), 'a segment regrew an inter-segment divider').toBe(0)
      expect(px(cs.borderInlineEndWidth)).toBe(0)
    }
  })

  it('vertical: a real stack — equal-height cells, ZERO inter-segment dividers', () => {
    const { group, segments } = mount(VERTICAL)
    expect(group.getAttribute('orientation')).toBe('vertical')
    const rects = segments.map((r) => r.getBoundingClientRect())
    for (const r of rects) expect(r.height).toBeCloseTo(rects[0]!.height, 0)
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.top).toBeCloseTo(rects[i - 1]!.bottom, 0)
    // Same zero-divider ruling as horizontal, on the block axis.
    for (const seg of segments) {
      const cs = getComputedStyle(seg)
      expect(px(cs.borderBlockStartWidth), 'a segment regrew an inter-segment divider').toBe(0)
      expect(px(cs.borderBlockEndWidth)).toBe(0)
    }
  })

  it('segment geometry: block-size = --ui-height-md, padding-inline = height/2, padding-block = 0', () => {
    const { segments } = mount(HORIZONTAL)
    const seg = segments[0]!
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

  it('a segment renders no dot glyph — NO CSS rule authors ::before content on ui-segment at all (unlike ' +
    'a plain ui-radio, there is nothing to suppress: radio.css\'s @scope(ui-radio) simply does not match)', () => {
    const { segments } = mount(HORIZONTAL)
    // `content` computes to 'none' (both engines, verified) whenever no author rule sets it — the
    // pseudo-element generates no box at all. This is the ABSENCE proof; segmented-control.css's own
    // `::before` (the shared moving indicator) is authored on the HOST `ui-segmented-control`, never on
    // `ui-segment`.
    expect(before(segments[0]!).content).toBe('none')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The shared moving indicator — one artifact, sized to a cell, translated (never grid-placed)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-segmented-control — the shared moving indicator (both engines)', () => {
  it('no selection → the indicator is hidden (opacity 0)', () => {
    const { group } = mount(HORIZONTAL)
    expect(px(before(group).opacity)).toBe(0)
  })

  it('horizontal: indicator sizes to one cell, translateX == selectedIndex × cellWidth, and slides on reselect', async () => {
    const { group, segments } = mount(HORIZONTAL)
    await userEvent.click(segments[1]!)
    expect(px(before(group).opacity)).toBe(1) // appears instantly on first selection

    const cellWidth = segments[1]!.getBoundingClientRect().width
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
    await userEvent.click(segments[2]!)
    await expect.poll(() => translateOf(before(group).transform).tx, { timeout: 1500 }).toBeCloseTo(2 * cellWidth, 0)
  })

  it('vertical: indicator sizes to one cell, translateY == selectedIndex × cellHeight', async () => {
    const { group, segments } = mount(VERTICAL)
    await userEvent.click(segments[2]!)
    const cellHeight = segments[2]!.getBoundingClientRect().height
    const indicatorHeight = px(before(group).height)
    expect(indicatorHeight).toBeCloseTo(cellHeight, 0)
    await expect.poll(() => translateOf(before(group).transform).ty, { timeout: 1500 }).toBeCloseTo(2 * cellHeight, 0)
    expect(translateOf(before(group).transform).tx).toBeCloseTo(0, 0)
  })

  it('fill == --md-sys-color-primary-selected; selected ink == -on-primary; unselected ink == neutral-on-surface-variant', async () => {
    const { group, segments } = mount(HORIZONTAL)
    await userEvent.click(segments[0]!)
    expect(beforeBg(group)).toBe(resolveToken(group, '--md-sys-color-primary-selected'))
    expect(ink(segments[0]!)).toBe(resolveToken(group, '--md-sys-color-primary-on-primary'))
    expect(ink(segments[1]!)).toBe(resolveToken(group, '--md-sys-color-neutral-on-surface-variant'))
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Motion — transition:transform over --ui-motion-fast; reduced-motion jumps
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-segmented-control — motion (both engines)', () => {
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

describe('ui-segmented-control — interaction states (both engines)', () => {
  it('unselected hover repaints to --ui-segmented-control-bg-hover (resolved via the host)', async () => {
    const { segments } = mount(HORIZONTAL)
    const idle = bg(segments[0]!)
    await userEvent.hover(segments[0]!)
    await expect.poll(() => bg(segments[0]!)).not.toBe(idle)
    await userEvent.unhover(segments[0]!)
  })

  it('the SELECTED segment does not wash on hover (holds — a checked segment cannot toggle off)', async () => {
    const { segments } = mount(HORIZONTAL)
    await userEvent.click(segments[0]!)
    const selectedBg = bg(segments[0]!)
    await userEvent.hover(segments[0]!)
    expect(bg(segments[0]!)).toBe(selectedBg) // unchanged — no hover wash on the selected cell
    await userEvent.unhover(segments[0]!)
  })

  it('a disabled control holds at idle — no hover wash', async () => {
    const { group, segments } = mount(HORIZONTAL)
    group.setAttribute('disabled', '')
    const idle = bg(segments[1]!)
    await userEvent.hover(segments[1]!)
    expect(bg(segments[1]!)).toBe(idle)
    await userEvent.unhover(segments[1]!)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Focus ring — reused, unclipped, forced-colors-safe
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ringDrawn = (el: HTMLElement): boolean => {
  const cs = getComputedStyle(el)
  return cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0
}

describe('ui-segmented-control — focus ring (both engines)', () => {
  it('Tab lands on a segment and draws the shared fleet focus ring (not clipped)', async () => {
    const { segments } = mount(HORIZONTAL)
    await userEvent.tab()
    expect(document.activeElement).toBe(segments[0]!)
    expect(ringDrawn(segments[0]! as HTMLElement)).toBe(true)
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

describe('ui-segmented-control — forced-colors (Chromium emulates; WebKit baseline)', () => {
  it('under forced-colors: indicator → Highlight, selected ink → HighlightText, unselected ink → ButtonText, focus ring survives', async () => {
    const { group, segments } = mount(HORIZONTAL)
    await userEvent.click(segments[0]!)
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

      // the actual inversion: indicator fill → Highlight; selected ink → HighlightText;
      // unselected ink → ButtonText — not just "still visible", the SPECIFIC WHCM system colours.
      expect(beforeBg(group)).toBe(resolveKeyword(group, 'Highlight', 'background'))
      expect(ink(segments[0]!)).toBe(resolveKeyword(group, 'HighlightText', 'color')) // selected (segments[0] was clicked)
      expect(ink(segments[1]!)).toBe(resolveKeyword(group, 'ButtonText', 'color')) // unselected
      // anti-vacuous: Highlight/HighlightText genuinely differ from the idle ButtonText/Canvas pairing.
      expect(ink(segments[0]!)).not.toBe(ink(segments[1]!))
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] Per-orientation roving — real focus + real Arrow keys (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-segmented-control — real roving per orientation (both engines)', () => {
  it('horizontal (the class default): ArrowRight moves REAL focus + selection to the next segment', async () => {
    const { group, segments } = mount(HORIZONTAL)
    ;(segments[0] as HTMLElement).focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(segments[1]!)
    expect((segments[1] as unknown as { checked: boolean }).checked).toBe(true)
  })

  it('vertical: ArrowDown moves REAL focus + selection to the next segment', async () => {
    const { group, segments } = mount(VERTICAL)
    ;(segments[0] as HTMLElement).focus()
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(segments[1]!)
    expect((segments[1] as unknown as { checked: boolean }).checked).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] user-invalid leg (ADR-0051) — inherited unchanged from UIRadioGroupElement
// ════════════════════════════════════════════════════════════════════════════════════════════════

const REQUIRED_HORIZONTAL = `
  <ui-segmented-control required>
    <ui-segment value="a">One</ui-segment>
    <ui-segment value="b">Two</ui-segment>
    <ui-segment value="c">Three</ui-segment>
  </ui-segmented-control>
`

describe('ui-segmented-control — user-invalid leg (ADR-0051, inherited)', () => {
  it('a required, unselected control arms :state(user-invalid) + repaints its OWN track border, only AFTER focus+blur', async () => {
    const { group, segments } = mount(REQUIRED_HORIZONTAL)

    expect(group.matches(':state(user-invalid)'), 'user-invalid must not flash before any interaction').toBe(false)
    const idleBorder = getComputedStyle(group).borderColor

    ;(segments[0] as HTMLElement).focus()
    ;(segments[0] as HTMLElement).blur()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    expect(group.matches(':state(user-invalid)'), ':state(user-invalid) was not armed on the control after a segment blur').toBe(true)
    const invalidBorder = getComputedStyle(group).borderColor
    expect(invalidBorder, "the control's OWN track border-color did not repaint under :state(user-invalid)").not.toBe(idleBorder)

    // RECOVERY: selecting a segment clears the constraint.
    await userEvent.click(segments[0]!)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(group.matches(':state(user-invalid)'), 'user-invalid persists after a segment is selected').toBe(false)
  })
})
