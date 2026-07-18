import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// timeline-family.lld.md §5 · SPEC-R4/R13/R14/R15 — the cross-engine geometry + whole-shape + signifier +
// forced-colors smoke for ui-timeline-item (the button-geometry.browser.test.ts template). Proves the
// marker-system EXPLICIT (scale × size) integer table is RENDERED, not just declared; the status markers
// differ by SHAPE (a structural/computed-style probe, never a pixel diff); a populated rail aligns its
// markers to one axis; forced-colors keeps every marker legible.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'
import '@agent-ui/icons/phosphor' // activates the Phosphor default pack — without it resolveIcon() falls back to an empty <svg data-icon-missing> (the _page.ts shell precedent)

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; item: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, item: wrap.querySelector('ui-timeline-item') as HTMLElement }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const beforeStyle = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::before')
const markerBox = (el: Element): number => px(getComputedStyle(el.querySelector('[data-part="marker"]')!).width)
const dotSize = (el: Element): number => px(beforeStyle(el.querySelector('[data-part="marker"]')!).width)
const connectorWidth = (el: Element): number => px(getComputedStyle(el.querySelector('[data-part="marker"]')!, '::after').width)
const gutter = (el: Element): number => px(getComputedStyle(el).gridTemplateColumns.split(' ')[0]!)
const rowGap = (el: Element): number => px(getComputedStyle(el).marginBlockEnd)

const allDistinct = (xs: number[]): boolean => new Set(xs.map((x) => x.toFixed(2))).size === xs.length

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-timeline-item cross-engine geometry smoke — the marker-system explicit (scale × size) table', () => {
  it('[size] sm→md→lg resolves the EXACT frozen integers at the default [scale] (marker-box/dot/connector/gutter/row-gap)', () => {
    const { item } = mount('<ui-timeline-item status="active" label="x"></ui-timeline-item>')
    const EXPECTED: Record<string, [number, number, number, number, number]> = {
      sm: [14, 6, 2, 18, 8],
      md: [16, 8, 2, 20, 12],
      lg: [20, 10, 2, 24, 16],
    }
    for (const size of ['sm', 'md', 'lg'] as const) {
      item.setAttribute('size', size)
      const [mb, dot, cw, gut, rg] = EXPECTED[size]!
      expect(markerBox(item), `size=${size} marker-box`).toBeCloseTo(mb, 0)
      expect(dotSize(item), `size=${size} dot-size`).toBeCloseTo(dot, 0)
      expect(connectorWidth(item), `size=${size} connector-width`).toBeCloseTo(cw, 0)
      expect(gutter(item), `size=${size} gutter`).toBeCloseTo(gut, 0)
      expect(rowGap(item), `size=${size} row-gap`).toBeCloseTo(rg, 0)
    }
  })

  it('connector-width is deliberately 2 across every size (the ADR-0038 stepping lesson — a probe must not assume all-distinct)', () => {
    const { item } = mount('<ui-timeline-item></ui-timeline-item>')
    const widths: number[] = []
    for (const size of ['sm', 'md', 'lg'] as const) {
      item.setAttribute('size', size)
      widths.push(connectorWidth(item))
    }
    expect(widths.every((w) => Math.round(w) === 2), `connector widths should all be 2: ${widths.join()}`).toBe(true)
    // anti-vacuous companion — marker-box, a DIFFERENT quantity, genuinely DOES step across the same sizes.
    const boxes: number[] = []
    for (const size of ['sm', 'md', 'lg'] as const) {
      item.setAttribute('size', size)
      boxes.push(markerBox(item))
    }
    expect(allDistinct(boxes), `marker-box should step across sizes: ${boxes.join()}`).toBe(true)
  })

  it('[scale] content-sm ≡ ui-md and content-md ≡ ui-lg (Kim\'s band-overlap law) — NOT all 6 tiers distinct', () => {
    const { wrap, item } = mount('<ui-timeline-item size="md"></ui-timeline-item>')
    const read = (scale: string): number => {
      wrap.setAttribute('scale', scale)
      return markerBox(item)
    }
    const uiMd = read('ui-md')
    const contentSm = read('content-sm')
    const uiLg = read('ui-lg')
    const contentMd = read('content-md')
    expect(contentSm, 'content-sm marker-box should equal ui-md (band overlap)').toBeCloseTo(uiMd, 0)
    expect(contentMd, 'content-md marker-box should equal ui-lg (band overlap)').toBeCloseTo(uiLg, 0)

    const all = [read('ui-sm'), uiMd, uiLg, contentSm, contentMd, read('content-lg')]
    expect(new Set(all.map((v) => Math.round(v))).size, 'Kim\'s 6 tiers → 4 distinct marker-box registers').toBe(4)
  })

  it('[density] compact→spacious changes ONLY row-gap (the rhythm quantity) — marker-box/dot/gutter/connector are density-INVARIANT', () => {
    const { wrap, item } = mount('<ui-timeline-item size="md"></ui-timeline-item>')
    const gaps: number[] = []
    const boxes: number[] = []
    for (const density of ['compact', 'comfortable', 'spacious'] as const) {
      wrap.setAttribute('density', density)
      gaps.push(rowGap(item))
      boxes.push(markerBox(item))
    }
    expect(allDistinct(gaps), `row-gap did not change across [density]: ${gaps.join()}`).toBe(true)
    expect(boxes.every((b) => Math.round(b) === Math.round(boxes[0]!)), `marker-box must be density-invariant: ${boxes.join()}`).toBe(true)
  })
})

describe('ui-timeline-item — status markers are DISTINCT by SHAPE, not hue alone (SPEC-R4, ADR-0057)', () => {
  it('pending is a HOLLOW ring (border-style solid, transparent fill) — distinct from active (a FILLED dot, no border)', () => {
    const { item } = mount('<ui-timeline-item></ui-timeline-item>')
    item.setAttribute('status', 'pending')
    const pendingStyle = beforeStyle(item.querySelector('[data-part="marker"]')!)
    expect(pendingStyle.borderStyle).toBe('solid')
    expect(pendingStyle.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)

    item.setAttribute('status', 'active')
    const activeStyle = beforeStyle(item.querySelector('[data-part="marker"]')!)
    expect(activeStyle.borderStyle).toBe('none')
    expect(activeStyle.backgroundColor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  })

  it('done/error each inject a DIFFERENT built-in glyph (check vs x) — structurally distinct SVG markup, not a colour swap', async () => {
    const { item } = mount('<ui-timeline-item></ui-timeline-item>')
    item.setAttribute('status', 'done')
    await new Promise((r) => setTimeout(r, 0))
    const doneSvg = item.querySelector('[data-part="marker"] svg[data-role="marker"]')
    expect(doneSvg).not.toBeNull()
    const doneMarkup = doneSvg!.innerHTML

    item.setAttribute('status', 'error')
    await new Promise((r) => setTimeout(r, 0))
    const errorSvg = item.querySelector('[data-part="marker"] svg[data-role="marker"]')
    expect(errorSvg).not.toBeNull()
    expect(errorSvg!.innerHTML, 'done and error must render DIFFERENT glyph markup').not.toBe(doneMarkup)
  })

  it('prefers-reduced-motion collapses the active pulse to static (no running animation)', async () => {
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      const { item } = mount('<ui-timeline-item status="active"></ui-timeline-item>')
      const anim = beforeStyle(item.querySelector('[data-part="marker"]')!).animationName
      expect(anim, 'the active pulse animation must be disabled under reduced-motion').toBe('none')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  it('a TRUNCATED active entry stops pulsing — the completion invariant must not leave a "still working" cue (SPEC-R11, component-review finding)', async () => {
    const { item } = mount('<ui-timeline-item status="active"></ui-timeline-item>')
    const beforeTruncation = beforeStyle(item.querySelector('[data-part="marker"]')!).animationName
    expect(beforeTruncation, 'anti-vacuous: the active pulse must be running before truncation').not.toBe('none')

    ;(item as unknown as { markTruncated(t: boolean): void }).markTruncated(true)
    await new Promise((r) => setTimeout(r, 0))
    const afterTruncation = beforeStyle(item.querySelector('[data-part="marker"]')!).animationName
    expect(afterTruncation, 'a truncated active entry must stop pulsing — never "still working"').toBe('none')
  })

  it('forced-colors keeps the pending ring + connector visible in CanvasText — Chromium emulates, WebKit asserts baseline', async () => {
    const { item } = mount('<ui-timeline-item status="pending"></ui-timeline-item>')
    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const fcStyle = beforeStyle(item.querySelector('[data-part="marker"]')!)
      expect(fcStyle.borderStyle).toBe('solid') // the ring SHAPE survives
      expect(fcStyle.borderColor).not.toMatch(/rgba\(0, 0, 0, 0\)/) // and is not the invisible transparent it would default to
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-timeline-item — whole-shape (a real rail row, not a collapsed dot; markers align to one axis)', () => {
  it('a single bare item renders at a sensible minimum — a real width/height, never a 0×0 sliver', () => {
    const { item } = mount('<ui-timeline-item label="Solo"></ui-timeline-item>')
    const rect = item.getBoundingClientRect()
    expect(rect.width, 'bare item width collapsed to zero').toBeGreaterThan(0)
    expect(rect.height, 'bare item height collapsed to zero').toBeGreaterThan(0)
  })

  it('several stacked items (same size) align their markers to ONE vertical axis', () => {
    const { wrap } = mount(
      '<div style="display:flex;flex-direction:column;width:320px">' +
        '<ui-timeline-item status="done" label="Placed"></ui-timeline-item>' +
        '<ui-timeline-item status="active" label="Shipped"></ui-timeline-item>' +
        '<ui-timeline-item status="pending" label="Delivered"></ui-timeline-item>' +
        '</div>',
    )
    const markers = Array.from(wrap.querySelectorAll('[data-part="marker"]')) as HTMLElement[]
    expect(markers.length).toBe(3)
    const lefts = markers.map((m) => m.getBoundingClientRect().left)
    expect(new Set(lefts.map((l) => Math.round(l))).size, `markers did not align: ${lefts.join()}`).toBe(1)
  })

  it('the last item in a host-marked rail (`[data-last]`) suppresses its connector', () => {
    const { wrap } = mount(
      '<div style="display:flex;flex-direction:column">' +
        '<ui-timeline-item label="A"></ui-timeline-item>' +
        '<ui-timeline-item label="B" data-last></ui-timeline-item>' +
        '</div>',
    )
    const items = Array.from(wrap.querySelectorAll('ui-timeline-item'))
    const nonLastAfter = getComputedStyle(items[0]!.querySelector('[data-part="marker"]')!, '::after')
    const lastAfter = getComputedStyle(items[1]!.querySelector('[data-part="marker"]')!, '::after')
    expect(nonLastAfter.display).not.toBe('none')
    expect(lastAfter.display).toBe('none')
  })
})

// ── ADR-0143 F4 — recursive nesting: each level paints its own independent rail, zero new CSS ───────────

describe('ui-timeline-item — recursive nesting: each level paints its own independent rail (ADR-0143 F4)', () => {
  it("a nested <ui-timeline>'s items render their OWN complete marker+connector rail, indented from the parent rail by the disclosure body's own padding — timeline-item.css is otherwise UNCHANGED by this build", async () => {
    const { item } = mount(
      '<ui-timeline-item status="active" label="Outer">' +
        '<ui-timeline data-role="nested">' +
        '<ui-timeline-item status="done" label="Inner A"></ui-timeline-item>' +
        '<ui-timeline-item status="active" label="Inner B"></ui-timeline-item>' +
        '</ui-timeline>' +
        '</ui-timeline-item>',
    )
    const disclosure = item.querySelector('ui-disclosure') as HTMLElement & { open: boolean }
    disclosure.open = true // open the accordion — native <details> lays out its content only while open
    await new Promise((r) => setTimeout(r, 0))

    const outerMarker = item.querySelector(':scope > [data-part="marker"]') as HTMLElement
    const innerItems = Array.from(item.querySelectorAll('ui-timeline[data-role="nested"] > ui-timeline-item')) as HTMLElement[]
    expect(innerItems).toHaveLength(2)
    const innerMarkers = innerItems.map((i) => i.querySelector('[data-part="marker"]') as HTMLElement)

    // each nested marker is a REAL, structurally distinct box — its own complete rail, never the parent's
    // marker reused or a collapsed 0×0 sliver.
    for (const m of innerMarkers) {
      expect(m).not.toBe(outerMarker)
      const rect = m.getBoundingClientRect()
      expect(rect.width, 'nested marker collapsed to zero width').toBeGreaterThan(0)
      expect(rect.height, 'nested marker collapsed to zero height').toBeGreaterThan(0)
    }

    // visually INDENTED relative to the outer rail — the disclosure body's own inline padding realizes the
    // indentation; F4's explicit overrule means there is no attempt at cross-level connector continuity.
    const outerLeft = outerMarker.getBoundingClientRect().left
    const innerLeft = innerMarkers[0]!.getBoundingClientRect().left
    expect(innerLeft, 'the nested rail must sit to the right of the outer rail (indented)').toBeGreaterThan(outerLeft)

    // the nested items still align their OWN markers to one vertical axis, exactly like a root rail.
    const innerLefts = innerMarkers.map((m) => m.getBoundingClientRect().left)
    expect(new Set(innerLefts.map((l) => Math.round(l))).size, 'nested markers did not align to one axis').toBe(1)

    // the nested rail's own terminal item suppresses ITS OWN connector, independent of the outer rail's.
    const lastInnerAfter = getComputedStyle(innerMarkers[1]!, '::after')
    expect(lastInnerAfter.display).toBe('none')
  })
})

// ── ADR-0143 F5 — recursive nesting: zero new ARIA machinery ─────────────────────────────────────────────

describe('ui-timeline-item — recursive nesting: zero new ARIA machinery (ADR-0143 F5)', () => {
  it('a CLOSED item keeps its nested descendants STRUCTURALLY present in the DOM (queryable) — the same find-in-page-enabling fact disclosure.md already documents for the flat `detail` case, extended unmodified to `nested`', () => {
    const { item } = mount(
      '<ui-timeline-item status="active" label="Outer">' +
        '<ui-timeline data-role="nested">' +
        '<ui-timeline-item status="done" label="Inner A"></ui-timeline-item>' +
        '</ui-timeline>' +
        '</ui-timeline-item>',
    )
    const disclosure = item.querySelector('ui-disclosure') as HTMLElement & { open: boolean }
    expect(disclosure.open).toBe(false) // the default — collapsed
    expect(item.querySelector('ui-timeline-item[label="Inner A"]')?.getAttribute('status')).toBe('done')
  })

  it('CLOSED excludes the nested list/listitems from the accessibility tree; OPEN exposes a real `list > listitem > list > listitem` AX structure — asserted directly via CDP, not assumed (ADR-0143 F5 — zero bespoke ARIA added)', async () => {
    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP Accessibility domain (the button/card/table forced-colors precedent — the
      // SAME instrument-bridge split: tool substituted; the universal DOM-presence leg above already
      // covers both engines).
      return
    }
    const { item } = mount(
      '<ui-timeline-item status="active" label="Outer">' +
        '<ui-timeline data-role="nested" label="Sub-steps">' +
        '<ui-timeline-item status="done" label="Inner A"></ui-timeline-item>' +
        '</ui-timeline>' +
        '</ui-timeline-item>',
    )
    const disclosure = item.querySelector('ui-disclosure') as HTMLElement & { open: boolean }

    const session = cdp() as unknown as CdpSession
    // `cdp()`'s session targets the TOP-LEVEL vitest runner page; the test's own DOM lives inside a CHILD
    // iframe (`vitest-iframe`) — scope the AX query to that frame (the ui-table AX-probe precedent).
    const frameTree = (await session.send('Page.getFrameTree')) as {
      frameTree: { childFrames?: Array<{ frame: { id: string } }> }
    }
    const frameId = frameTree.frameTree.childFrames?.[0]?.frame.id
    expect(frameId, 'anti-vacuous: the vitest-iframe child frame must be found to scope the AX query').toBeDefined()
    await session.send('Accessibility.enable')

    // CLOSED (the default) — the nested list must NOT appear in the accessibility tree at all.
    const closedAx = (await session.send('Accessibility.getFullAXTree', { frameId })) as {
      nodes: Array<{ role?: { value?: string }; name?: { value?: string } }>
    }
    expect(
      closedAx.nodes.find((n) => n.role?.value === 'list' && n.name?.value === 'Sub-steps'),
      'a CLOSED disclosure must not expose its nested list in the AX tree',
    ).toBeUndefined()

    // OPEN — the nested list > listitem structure is now a real, exposed part of the AX tree.
    disclosure.open = true
    await new Promise((r) => setTimeout(r, 0))
    const openAx = (await session.send('Accessibility.getFullAXTree', { frameId })) as {
      nodes: Array<{ role?: { value?: string }; name?: { value?: string } }>
    }
    await session.send('Accessibility.disable')

    const nestedList = openAx.nodes.find((n) => n.role?.value === 'list' && n.name?.value === 'Sub-steps')
    expect(nestedList, 'no AX node with role=list named "Sub-steps" found — the nested <ui-timeline> must expose its own list role once open').toBeDefined()
    const listItems = openAx.nodes.filter((n) => n.role?.value === 'listitem')
    expect(listItems.length, 'expected at least the outer item + the nested item as listitem AX nodes').toBeGreaterThanOrEqual(2)
  })
})
