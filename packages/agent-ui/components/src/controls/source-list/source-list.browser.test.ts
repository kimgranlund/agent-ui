import { describe, it, expect, afterEach } from 'vitest'

// source-list.browser.test.ts — the real-engine proof for the source-attribution list (ADR-0214, GH
// #1394): jsdom is blind to painted geometry and computed style, so the index→title adjacency, the
// snippet's forced own-line wrap, the gated link's real anchor-ink/underline, and the whole-shape
// bounding box are proven here against real layout — the test-the-whole-shape law: assert the gestalt,
// not just per-part existence.
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module.
import '@agent-ui/components/foundation-styles.css'
import './source-list.css'
import './source-list.ts'
import type { UISourceListElement } from './source-list.ts'
import { whenFlushed } from '../../reactive/index.ts'

const mounted: HTMLElement[] = []
const mount = (width = 480): UISourceListElement => {
  const wrap = document.createElement('div')
  wrap.style.width = `${width}px`
  const el = document.createElement('ui-source-list') as UISourceListElement
  wrap.append(el)
  document.body.append(wrap)
  mounted.push(wrap)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

const SOURCES = [
  { href: 'https://example.com/report', title: 'Q3 Market Report', snippet: 'Revenue grew 12% year over year.' },
  { href: 'javascript:alert(1)', title: 'An untrusted source' },
  { href: 'https://example.com/notes', title: 'Internal notes' },
]

describe('ui-source-list — the list rhythm paints (whole-shape gestalt)', () => {
  it('a populated list paints every row: index then title ADJACENT on the same line', async () => {
    const el = mount()
    el.sources = SOURCES
    await whenFlushed()

    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    expect(rows.length).toBe(3)

    const hostBox = el.getBoundingClientRect()
    expect(hostBox.width, 'the host painted zero width').toBeGreaterThan(0)
    expect(hostBox.height, 'the host painted zero height').toBeGreaterThan(0)

    for (const row of rows) {
      const index = row.querySelector('[data-part="index"]') as HTMLElement
      const title = row.querySelector('[data-part="title"]') as HTMLElement
      const ib = index.getBoundingClientRect()
      const tb = title.getBoundingClientRect()
      expect(ib.width, 'index painted zero width').toBeGreaterThan(0)
      expect(tb.width, 'title painted zero width').toBeGreaterThan(0)

      // same line: the boxes vertically overlap (baseline share, no stacking)
      expect(tb.top).toBeLessThan(ib.bottom)
      expect(tb.bottom).toBeGreaterThan(ib.top)
      // the title sits to the right of the index (reading order IS visual order, LTR)
      expect(tb.left).toBeGreaterThanOrEqual(ib.right)
    }
  })

  it('rows stack vertically at the row-gap token; the WHOLE bounding box is at least the sum of its rows', async () => {
    const el = mount()
    el.sources = SOURCES
    await whenFlushed()

    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    const rowGap = px(getComputedStyle(el).rowGap || getComputedStyle(el).gap)
    expect(rowGap, 'anti-vacuous: the row gap resolves to a real px value').toBeGreaterThan(0)

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.getBoundingClientRect()
      const next = rows[i]!.getBoundingClientRect()
      expect(next.top, `row ${i} does not sit at/after its predecessor's bottom + gap`).toBeGreaterThanOrEqual(prev.bottom + rowGap - 1)
    }

    const total = rows.reduce((s, r) => s + r.getBoundingClientRect().height, 0) + rowGap * (rows.length - 1)
    expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(total - 1)
  })

  it('an ALLOWED href paints a real anchor with the link ink + underline; a DENIED href paints plain text with the body ink', async () => {
    const el = mount()
    el.sources = [
      { href: 'https://example.com/allowed', title: 'Allowed source' },
      { href: 'javascript:evil()', title: 'Denied source' },
    ]
    await whenFlushed()

    const titles = [...el.querySelectorAll('[data-part="title"]')] as HTMLElement[]
    const [allowed, denied] = titles
    expect(allowed!.tagName).toBe('A')
    expect(denied!.tagName).toBe('SPAN')

    const allowedStyle = getComputedStyle(allowed!)
    const deniedStyle = getComputedStyle(denied!)
    expect(allowedStyle.textDecorationLine, 'an allowed link must paint an underline').toContain('underline')
    // the allowed link's ink must differ from the denied plain-text ink (a real, non-decorative signal)
    expect(allowedStyle.color, 'the allowed link ink must differ from the denied plain-text ink').not.toBe(deniedStyle.color)
  })

  it('a snippet forces its OWN line beneath the index+title pair, never inline with the title', async () => {
    const el = mount(320)
    el.sources = [{ href: '', title: 'Short title', snippet: 'A supporting snippet that explains the citation.' }]
    await whenFlushed()

    const row = el.querySelector('[data-part="row"]') as HTMLElement
    const title = row.querySelector('[data-part="title"]') as HTMLElement
    const snippet = row.querySelector('[data-part="snippet"]') as HTMLElement
    expect(snippet.getBoundingClientRect().top, 'the snippet must sit BELOW the title, not beside it').toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom - 1)
    // no horizontal overflow — the row never overflows its host
    expect(row.scrollWidth, 'the row overflows horizontally').toBeLessThanOrEqual(row.clientWidth + 1)
  })

  it('an empty list paints a zero-height, non-intrusive host (no phantom box)', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBe(0)
  })
})
