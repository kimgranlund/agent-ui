import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// component-preview-radio-segmented.browser.test.ts — the ADR-0086 de-doubling closing step: every batch-A
// ≤5-member enum knob (component-preview.ts's RADIO_GROUP_MAX branch) now renders `ui-radio-group[variant=
// "segmented"]`, not the plain dots-in-a-row layout. jsdom cannot prove any of this (no @scope grid layout, no
// `::before` geometry/transform, no computed cell widths) — this is the REAL-ENGINE proof, both engines, that:
//   (1) the knob carries `variant="segmented"` (+ the resolved `orientation`) — not just the attribute, but the
//       real grid layout it drives;
//   (2) a short 3-member set (`size`) renders HORIZONTAL — equal-width cells in a row, fitting the knob panel
//       with no overflow — and the TIGHTEST horizontal case (`variant`: solid/soft/ghost, 3×5-char labels,
//       clearing the ≤6-char threshold by the thinnest margin) still fits with no overflow either;
//   (3) a wider 5-member set (`align`) renders VERTICAL — equal-height cells in a stack, fitting the knob
//       panel with no overflow either axis;
//   (4) the shared moving indicator actually MOVES (not just paints — opacity alone is already 1 from the
//       seeded selection before any click) between the seeded member and a newly-clicked one, sized to one
//       cell throughout (the "test the whole shape, and bite" law — a pinned or wrongly-sized indicator must
//       fail this, not merely a hidden one).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './component-preview.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

let root: HTMLElement
beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
})
afterEach(() => {
  root.remove()
})

async function mountPreview(mode: string, target: string): Promise<HTMLElement> {
  const preview = document.createElement('component-preview')
  preview.setAttribute('mode', mode)
  preview.setAttribute('target', target)
  root.append(preview)
  await raf()
  return preview
}

/** The knob ROW (label + control) for a named prop — the panel bound a segmented knob must fit inside. */
const knobRow = (preview: HTMLElement, name: string): HTMLElement | undefined =>
  Array.from(preview.querySelectorAll<HTMLElement>('.knob')).find(
    (row) => row.querySelector('.knob-label')?.textContent === name,
  )

const knobRadioGroup = (preview: HTMLElement, name: string): HTMLElement | undefined =>
  knobRow(preview, name)?.querySelector('ui-radio-group') as HTMLElement | undefined

const radiosOf = (group: HTMLElement): HTMLElement[] => [...group.querySelectorAll<HTMLElement>('ui-radio')]

const px = (v: string): number => Number.parseFloat(v)
const before = (el: Element): CSSStyleDeclaration => getComputedStyle(el, '::before')

/** Parse a `matrix(a, b, c, d, tx, ty)` transform string into its translate components (0,0 for 'none') —
 *  mirrors the control's OWN radio-group-segmented.browser.test.ts probe (the ground truth for this shape). */
const translateOf = (transform: string): { tx: number; ty: number } => {
  const m = /matrix\(([^)]+)\)/.exec(transform)
  if (!m) return { tx: 0, ty: 0 }
  const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
  return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
}

describe('component-preview — batch-A radio-group knobs render as a real segmented control (both engines)', () => {
  it('a short 3-member set (ui-button `size`) renders HORIZONTAL: variant=segmented, equal-width adjoining cells, no overflow', async () => {
    const preview = await mountPreview('component', 'ui-button')
    const row = knobRow(preview, 'size')!
    const group = knobRadioGroup(preview, 'size')!
    expect(group.getAttribute('variant'), 'the size knob did not flip to segmented').toBe('segmented')

    const radios = radiosOf(group)
    expect(radios.length).toBe(3) // sm/md/lg

    const cs = getComputedStyle(group)
    expect(cs.display, 'segmented variant must repoint display:grid (radio-group.css)').toBe('grid')

    const groupRect = group.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    // the whole group fits INSIDE its knob row — no horizontal blowout past the panel column.
    expect(groupRect.right).toBeLessThanOrEqual(rowRect.right + 1)
    expect(groupRect.width).toBeGreaterThan(0)

    const rects = radios.map((r) => r.getBoundingClientRect())
    for (const r of rects) expect(r.width).toBeCloseTo(rects[0]!.width, 0) // equal-width cells
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.left).toBeCloseTo(rects[i - 1]!.right, 0) // adjoining, no gap
    // every segment stays within the row's own bounds (no per-cell clipping/overflow either)
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1)
      expect(r.right).toBeLessThanOrEqual(rowRect.right + 1)
    }

    // The shared moving indicator: NOT just opacity (the seeded 'md' selection already makes opacity 1 BEFORE
    // any click — an opacity-only check passes even if the indicator never moves). Prove it is sized to ONE
    // cell and actually TRANSLATES from the seeded index to a newly-clicked one (a pinned indicator fails this).
    const cellWidth = rects[0]!.width
    const seededIndex = radios.findIndex((r) => (r as unknown as { checked: boolean }).checked)
    expect(seededIndex, 'no radio pre-checked from the seeded size default (md)').toBe(1) // sm=0, md=1, lg=2
    const seededTx = translateOf(before(group).transform).tx
    expect(seededTx, 'the indicator is not positioned over the seeded (md) segment before any click').toBeCloseTo(
      seededIndex * cellWidth,
      0,
    )
    expect(px(before(group).width), 'the indicator is not sized to one cell').toBeCloseTo(cellWidth, 0)

    await userEvent.click(radios[2]!) // 'lg' — a real commit AWAY from the seeded 'md' (index 1 → 2)
    // the ::before transitions `transform` over --ui-motion-fast — poll until it SETTLES on the new index's
    // translate rather than sampling a mid-fade interpolated value (the bite: this fails if the indicator is
    // pinned at the seeded position, or sized/placed for the wrong cell).
    await expect
      .poll(() => translateOf(before(group).transform).tx, { timeout: 1500 })
      .toBeCloseTo(2 * cellWidth, 0)
    const afterTx = translateOf(before(group).transform).tx
    expect(afterTx, 'the indicator did not move off its seeded position — it is pinned').not.toBeCloseTo(seededTx, 0)
    expect(px(before(group).opacity)).toBe(1)
    expect(px(before(group).width), 'the indicator is still sized to one cell after moving').toBeCloseTo(cellWidth, 0)
  })

  it('the tightest horizontal case (ui-button `variant`: solid/soft/ghost, 3×5-char labels) still fits the knob row with no overflow', async () => {
    // The reviewer's flagged risk: `variant` clears the ≤3-member/≤6-char threshold by the thinnest margin
    // (5-char labels vs the 6-char cutoff) — this is the real overflow candidate, not the roomier `size` case
    // above. Measure the WHOLE rendered shape, not just the attribute: if this actually overflows, the
    // ≤6-char threshold is too loose for a 3-member set and `variant` should bucket vertical instead.
    const preview = await mountPreview('component', 'ui-button')
    const row = knobRow(preview, 'variant')!
    const group = knobRadioGroup(preview, 'variant')!
    expect(group.getAttribute('variant'), 'the variant knob did not flip to segmented').toBe('segmented')
    expect(group.getAttribute('orientation'), '3-member ≤6-char labels should resolve horizontal').toBe('horizontal')

    const radios = radiosOf(group)
    expect(radios.length).toBe(3) // solid/soft/ghost

    expect(getComputedStyle(group).display, 'segmented variant must repoint display:grid').toBe('grid')

    const groupRect = group.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const rects = radios.map((r) => r.getBoundingClientRect())

    // (a) the DOM-level overflow check: the group's own scroll box must not exceed its client box.
    expect(
      group.scrollWidth,
      `group.scrollWidth=${group.scrollWidth}px > clientWidth=${group.clientWidth}px — real horizontal overflow`,
    ).toBeLessThanOrEqual(group.clientWidth + 1)

    // (b) the box-geometry check: the whole group, and every individual segment, stays within the knob row.
    expect(
      groupRect.right,
      `groupRect.right=${groupRect.right.toFixed(1)} rowRect.right=${rowRect.right.toFixed(1)}`,
    ).toBeLessThanOrEqual(rowRect.right + 1)
    for (const r of rects) expect(r.width).toBeCloseTo(rects[0]!.width, 0) // equal-width cells
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.left).toBeCloseTo(rects[i - 1]!.right, 0) // adjoining, no gap
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1)
      expect(
        r.right,
        `segment right=${r.right.toFixed(1)} rowRect.right=${rowRect.right.toFixed(1)} (cellWidth=${r.width.toFixed(1)})`,
      ).toBeLessThanOrEqual(rowRect.right + 1)
    }
  })

  it('a wider 5-member set (ui-row `align`) renders VERTICAL: variant=segmented, orientation=vertical, a stack that fits the panel', async () => {
    const preview = await mountPreview('component', 'ui-row')
    const row = knobRow(preview, 'align')!
    const group = knobRadioGroup(preview, 'align')!
    expect(group.getAttribute('variant'), 'the align knob did not flip to segmented').toBe('segmented')
    expect(group.getAttribute('orientation'), 'a 5-member set should stack vertical, not squeeze into a row').toBe('vertical')

    const radios = radiosOf(group)
    expect(radios.length).toBe(5) // start/center/end/stretch/baseline

    const groupRect = group.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    expect(groupRect.right, 'the vertical stack must not overflow the knob panel width').toBeLessThanOrEqual(rowRect.right + 1)
    expect(groupRect.width).toBeGreaterThan(0)
    expect(groupRect.height).toBeGreaterThan(0)

    const rects = radios.map((r) => r.getBoundingClientRect())
    for (const r of rects) expect(r.height).toBeCloseTo(rects[0]!.height, 0) // equal-height cells
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.top).toBeCloseTo(rects[i - 1]!.bottom, 0) // stacked, no gap
    for (const r of rects) {
      expect(r.left).toBeGreaterThanOrEqual(rowRect.left - 1)
      expect(r.right).toBeLessThanOrEqual(rowRect.right + 1) // no per-segment clipping past the panel
    }

    // Same bite-check as the horizontal case: the seeded 'start' (index 0) already makes opacity 1 before any
    // click, so prove the indicator is sized to one cell and actually TRANSLATES to the newly-clicked member.
    const cellHeight = rects[0]!.height
    const seededIndex = radios.findIndex((r) => (r as unknown as { checked: boolean }).checked)
    expect(seededIndex, 'no radio pre-checked from the seeded align default (start)').toBe(0)
    const seededTy = translateOf(before(group).transform).ty
    expect(seededTy, 'the indicator is not positioned over the seeded (start) segment before any click').toBeCloseTo(
      seededIndex * cellHeight,
      0,
    )
    expect(px(before(group).height), 'the indicator is not sized to one cell').toBeCloseTo(cellHeight, 0)

    await userEvent.click(radios[1]!) // 'center' — a real commit AWAY from the seeded 'start' (index 0 → 1)
    await expect
      .poll(() => translateOf(before(group).transform).ty, { timeout: 1500 })
      .toBeCloseTo(1 * cellHeight, 0)
    const afterTy = translateOf(before(group).transform).ty
    expect(afterTy, 'the indicator did not move off its seeded position — it is pinned').not.toBeCloseTo(seededTy, 0)
    expect(px(before(group).opacity)).toBe(1)
    expect(px(before(group).height), 'the indicator is still sized to one cell after moving').toBeCloseTo(cellHeight, 0)
  })

  it('a short-but-wide-labelled 2-member set (ui-radio-group’s own `variant` knob) also goes vertical', async () => {
    // radio-group's OWN descriptor exposes `variant` (default/segmented) and `orientation` (horizontal/vertical)
    // as knobs when the control itself is previewed — 2 members, but a long label ("segmented"/"horizontal")
    // that would clip a 2-cell horizontal row; radioGroupOrientation's label-length branch catches this.
    const preview = await mountPreview('component', 'ui-radio-group')
    const group = knobRadioGroup(preview, 'variant')!
    expect(group.getAttribute('variant')).toBe('segmented')
    expect(group.getAttribute('orientation')).toBe('vertical')
  })
})
