import { describe, it, expect, afterEach } from 'vitest'
import type { UIStatusStreamElement } from './status-stream.ts'

// mixed-entries-type.browser.test.ts — GH #722 candidate 5's live repro (the issue's own findings named
// this needs-live-repro: "not provable from source alone which entries were grouped in the screenshotted
// turn"). The claim under test: a strip mixing FLAT entries with GROUPED ones renders two type registers
// side by side (the screenshot's "Request sent" visibly larger than its followers). Measured at the
// conversation narration's own pinned 0.78rem ambient (conversation.css), the exact mount the report
// came from.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const raf2 = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function mountNarrationLike(): UIStatusStreamElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'max-width:400px; font-size:0.78rem;' // the narration mount's own pinned register
  const stream = document.createElement('ui-status-stream') as UIStatusStreamElement
  stream.setAttribute('header', '')
  stream.setAttribute('label', 'Agent activity')
  wrap.append(stream)
  document.body.append(wrap)
  mounted.push(wrap)
  return stream
}

const labelFontSize = (item: Element): string => {
  const label = item.querySelector('[data-role="label"]')
  return label ? getComputedStyle(label).fontSize : ''
}

describe('GH #722 candidate 5 — mixed flat + grouped entries: ONE type register, measured live', () => {
  it('a flat entry, a group parent, and a nested child all render their labels at the SAME computed font-size', async () => {
    const stream = mountNarrationLike()
    stream.appendEntry({ key: 'flat-1', status: 'done', label: 'Request sent' })
    stream.appendEntry({ key: 'group', status: 'active', label: 'Reasoning', description: 'in progress' })
    stream.appendEntry({ key: 'child-1', status: 'done', label: 'Read the file', parent: 'group' })
    stream.appendEntry({ key: 'flat-2', status: 'active', label: 'Writing the response…' })
    await raf2()

    const flat1 = stream.querySelector('ui-timeline-item[data-key="flat-1"]')!
    const group = stream.querySelector('ui-timeline-item[data-key="group"]')!
    const child = stream.querySelector('ui-timeline-item[data-key="child-1"]')!
    const flat2 = stream.querySelector('ui-timeline-item[data-key="flat-2"]')!

    const sizes = {
      flat1: labelFontSize(flat1),
      group: labelFontSize(group),
      child: labelFontSize(child),
      flat2: labelFontSize(flat2),
    }
    // the ambient register: 0.78rem — every label must read exactly it (one register, never two)
    for (const [name, size] of Object.entries(sizes)) {
      expect(size, `${name}'s label font-size (all: ${JSON.stringify(sizes)})`).toBe(sizes.flat1)
    }
    // and the register IS the ambient one (anti-vacuous: not all uniformly wrong together)
    expect(parseFloat(sizes.flat1)).toBeCloseTo(0.78 * 16, 1)
  })

  it('the header label shares that same register (the strip is one voice)', async () => {
    const stream = mountNarrationLike()
    stream.appendEntry({ key: 'a', status: 'done', label: 'Request sent' })
    await raf2()
    const headerLabel = stream.querySelector('[data-part="header-label"]')!
    const entryLabel = stream.querySelector('ui-timeline-item [data-role="label"]')!
    expect(getComputedStyle(headerLabel).fontSize).toBe(getComputedStyle(entryLabel).fontSize)
  })
})
