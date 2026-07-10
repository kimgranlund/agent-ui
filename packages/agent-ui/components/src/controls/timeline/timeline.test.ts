import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UITimelineElement } from './timeline.ts'
import '../timeline-item/timeline-item.ts'

// timeline-family.lld.md §3 · SPEC-R6/R7 — ui-timeline jsdom behaviour probes (the durable host):
// upgrade → role=list via internals → authored-children DOM order → terminal-connector marking
// (data-last, re-marked on childList mutation) → accessible name → the static negative control.

function makeTimeline(markup = ''): { el: UITimelineElement } {
  const el = document.createElement('ui-timeline') as UITimelineElement
  if (markup) el.innerHTML = markup
  document.body.append(el)
  return { el }
}

describe('ui-timeline — upgrade + typed prop surface', () => {
  it('upgrades to the class, extends UIContainerElement, props at their defaults', () => {
    const el = document.createElement('ui-timeline') as UITimelineElement
    expect(el).toBeInstanceOf(UITimelineElement)
    expect(el.size).toBe('md')
    expect(el.label).toBe('')
  })

  it('self-defines ui-timeline, guarded against a double-define', () => {
    expect(customElements.get('ui-timeline')).toBe(UITimelineElement)
    expect(() => {
      if (!customElements.get('ui-timeline')) customElements.define('ui-timeline', UITimelineElement)
    }).not.toThrow()
  })

  it('internals.role is "list" (set in the constructor, before insertion) — no host role attribute', () => {
    const el = document.createElement('ui-timeline') as UITimelineElement
    // @ts-expect-error — internals is protected; the test reaches in to assert the pre-insertion contract
    expect(el.internals.role).toBe('list')
    document.body.append(el)
    expect(el.hasAttribute('role')).toBe(false)
    el.remove()
  })

  it('size/label reflect; size fails open to values[0] on garbage', () => {
    const el = document.createElement('ui-timeline') as UITimelineElement
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
    el.label = 'Order status'
    expect(el.getAttribute('label')).toBe('Order status')
    el.setAttribute('size', 'bogus')
    expect(el.size).toBe('sm') // enumType.from snaps to values[0] (['sm','md','lg'][0]) — the button.ts/select.ts precedent
  })

  it('a non-empty label sets internals.ariaLabel; empty clears it to null', async () => {
    const { el } = makeTimeline()
    el.label = 'Order status'
    await whenFlushed()
    // @ts-expect-error — internals is protected; asserted directly (the toolbar.ts precedent)
    expect(el.internals.ariaLabel).toBe('Order status')
    el.label = ''
    await whenFlushed()
    // @ts-expect-error
    expect(el.internals.ariaLabel).toBeNull()
    el.remove()
  })

  it('dispatches NO event on any interaction (events: [] — display-first, SPEC-R7 AC2)', () => {
    const { el } = makeTimeline('<ui-timeline-item label="A"></ui-timeline-item>')
    let events = 0
    for (const type of ['toggle', 'change', 'input', 'select', 'open', 'close']) el.addEventListener(type, () => events++)
    el.size = 'lg'
    el.label = 'x'
    expect(events).toBe(0)
    el.remove()
  })
})

describe('ui-timeline — authored-children ingress (DOM order, no auto-sort)', () => {
  it('renders authored ui-timeline-item children in DOM order, unchanged', () => {
    const { el } = makeTimeline(
      '<ui-timeline-item label="First"></ui-timeline-item>' +
        '<ui-timeline-item label="Second"></ui-timeline-item>' +
        '<ui-timeline-item label="Third"></ui-timeline-item>',
    )
    const items = Array.from(el.querySelectorAll('ui-timeline-item'))
    expect(items.map((i) => i.getAttribute('label'))).toEqual(['First', 'Second', 'Third'])
    el.remove()
  })
})

describe('ui-timeline — terminal-connector suppression (data-last)', () => {
  it('marks ONLY the last authored item data-last', () => {
    const { el } = makeTimeline(
      '<ui-timeline-item label="First"></ui-timeline-item>' +
        '<ui-timeline-item label="Second"></ui-timeline-item>' +
        '<ui-timeline-item label="Third"></ui-timeline-item>',
    )
    const items = Array.from(el.querySelectorAll('ui-timeline-item'))
    expect(items.map((i) => i.hasAttribute('data-last'))).toEqual([false, false, true])
    el.remove()
  })

  it('re-marks the terminal item when a new one is appended after connect', async () => {
    const { el } = makeTimeline('<ui-timeline-item label="First"></ui-timeline-item>')
    const first = el.querySelector('ui-timeline-item')!
    expect(first.hasAttribute('data-last')).toBe(true)

    const second = document.createElement('ui-timeline-item')
    second.setAttribute('label', 'Second')
    el.appendChild(second)
    await new Promise<void>((r) => queueMicrotask(r)) // the MutationObserver callback (a microtask)

    expect(first.hasAttribute('data-last')).toBe(false)
    expect(second.hasAttribute('data-last')).toBe(true)
    el.remove()
  })

  it('a single authored item is marked data-last (the terminal IS the only one)', () => {
    const { el } = makeTimeline('<ui-timeline-item label="Solo"></ui-timeline-item>')
    expect(el.querySelector('ui-timeline-item')?.hasAttribute('data-last')).toBe(true)
    el.remove()
  })
})

describe('ui-timeline — the static negative control (SPEC-R6 AC3)', () => {
  it('has no bespoke `update`/`finalize` method (the ui-status-stream imperative API is absent here) and role stays "list", never "log"', () => {
    const el = document.createElement('ui-timeline') as UITimelineElement
    // NOTE: `.append` is native Element.prototype.append (every element has it) — the negative control is
    // specifically the ABSENCE of ui-status-stream's bespoke keyed update()/finalize() contract, not append.
    expect((el as unknown as { update?: unknown }).update).toBeUndefined()
    expect((el as unknown as { finalize?: unknown }).finalize).toBeUndefined()
    document.body.append(el)
    // @ts-expect-error — internals is protected; asserted directly
    expect(el.internals.role).toBe('list')
    el.remove()
  })
})
