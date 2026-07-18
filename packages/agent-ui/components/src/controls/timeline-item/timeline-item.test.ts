import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UITimelineItemElement } from './timeline-item.ts'
import { UIDisclosureElement } from '../disclosure/disclosure.ts'

// timeline-family.lld.md §2 · SPEC-R1…R5 — ui-timeline-item jsdom behaviour probes. Mirrors the
// disclosure/toast test template (upgrade → anatomy → status/marker glyph → the wrapper-trap regression →
// the composed detail/toggle re-emit → the completion-invariant markTruncated escape hatch).

function makeItem(markup = ''): { el: UITimelineItemElement; marker: HTMLElement } {
  const el = document.createElement('ui-timeline-item') as UITimelineItemElement
  if (markup) el.innerHTML = markup
  document.body.append(el)
  const marker = el.querySelector('[data-part="marker"]') as HTMLElement
  return { el, marker }
}

// ── upgrade + the typed prop surface ────────────────────────────────────────────────────────────────────

describe('ui-timeline-item — upgrade + typed prop surface', () => {
  it('upgrades to the class, NOT form-associated, with every prop at its default', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    expect(el).toBeInstanceOf(UITimelineItemElement)
    expect(el.status).toBe('')
    expect(el.label).toBe('')
    expect(el.description).toBe('')
    expect(el.timestamp).toBe('')
    expect(el.icon).toBe('')
    expect(el.size).toBe('md')
  })

  it('self-defines ui-timeline-item, guarded against a double-define', () => {
    expect(customElements.get('ui-timeline-item')).toBe(UITimelineItemElement)
    expect(() => {
      if (!customElements.get('ui-timeline-item')) customElements.define('ui-timeline-item', UITimelineItemElement)
    }).not.toThrow()
  })

  it('internals.role is "listitem", set BEFORE insertion (constructor-time, the toast role precedent), no host role attribute', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    // @ts-expect-error — internals is a protected field; the test reaches in to assert the pre-insertion contract
    expect(el.internals.role).toBe('listitem')
    document.body.append(el)
    expect(el.hasAttribute('role')).toBe(false)
    el.remove()
  })

  it('status/size reflect (SPEC-R2 AC2) — a JS-set value round-trips through getAttribute; fail-open to values[0] on garbage', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.status = 'active'
    expect(el.getAttribute('status')).toBe('active')
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')

    el.setAttribute('status', 'bogus')
    expect(el.status).toBe('') // fail-open to values[0] (STATUS[0] === '')
    el.setAttribute('size', 'bogus')
    expect(el.size).toBe('sm') // fail-open to values[0] (the enumType codec snaps to values[0], never `default` — SIZE[0] === 'sm', the button.ts/select.ts precedent)
  })

  it('typed: status/size are literal unions, label/description/timestamp/icon are string (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UITimelineItemElement()
      el.status = 'done'
      el.size = 'sm'
      // @ts-expect-error — status is a closed enum, not an arbitrary string
      el.status = 'bogus'
      // @ts-expect-error — size is a closed enum, not an arbitrary string
      el.size = 'xl'
      // @ts-expect-error — label is string, not boolean
      el.label = true
    }
    expect(typeof fn).toBe('function')
  })
})

// ── anatomy — marker + content cells + empty-cell collapse ─────────────────────────────────────────────

describe('ui-timeline-item — anatomy (marker + content roles)', () => {
  it('builds a marker part + label/description/timestamp/trailing content cells, ONCE (idempotent across reconnect)', () => {
    const { el } = makeItem()
    expect(el.querySelector('[data-part="marker"]')).not.toBeNull()
    for (const role of ['label', 'description', 'timestamp', 'trailing']) {
      expect(el.querySelector(`[data-role="${role}"]`), role).not.toBeNull()
    }
    const before = el.children.length
    el.remove()
    document.body.append(el) // reconnect
    expect(el.children.length).toBe(before) // not re-created
    expect(el.querySelectorAll('[data-part="marker"]')).toHaveLength(1)
    el.remove()
  })

  it('stamps label/description/timestamp from props reactively', async () => {
    const { el } = makeItem()
    el.label = 'Order placed'
    el.description = '42 files matched'
    el.timestamp = 'Apr 15, 2:30 PM'
    await whenFlushed()
    expect(el.querySelector('[data-role="label"]')?.textContent).toBe('Order placed')
    expect(el.querySelector('[data-role="description"]')?.textContent).toBe('42 files matched')
    expect(el.querySelector('[data-role="timestamp"]')?.textContent).toBe('Apr 15, 2:30 PM')
    el.remove()
  })

  it('the wrapper-trap regression: a pre-existing [data-role="label"] child is adopted and NEVER re-stamped by the label prop', async () => {
    const { el } = makeItem('<span data-role="label"><strong>Custom</strong> markup</span>')
    const consumerLabel = el.querySelector('[data-role="label"]') as HTMLElement
    expect(consumerLabel.querySelector('strong')).not.toBeNull() // the rich markup survived (not replaced)
    el.label = 'this must NOT overwrite the consumer markup'
    await whenFlushed()
    expect(el.querySelector('[data-role="label"]')?.querySelector('strong')).not.toBeNull()
    expect(el.querySelector('[data-role="label"]')?.textContent).toContain('Custom')
    el.remove()
  })

  it('empty cells exist but collapse visually (CSS :empty) — no phantom cell is omitted from the DOM', () => {
    const { el } = makeItem()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('')
    el.remove()
  })
})

// ── the marker glyph — icon prop / status-driven built-in glyph / consumer marker ──────────────────────

describe('ui-timeline-item — the marker glyph (icon prop wins over status; done/error get a built-in glyph)', () => {
  it('a consumer [data-role="marker"] child is adopted and the item never touches it', async () => {
    const { el, marker } = makeItem('<span data-role="marker">★</span>')
    expect(marker.querySelector('[data-role="marker"]')?.textContent).toBe('★')
    el.status = 'done' // would normally inject a check glyph — must NOT for a consumer marker
    await whenFlushed()
    expect(marker.querySelector('[data-role="marker"]')?.textContent).toBe('★')
    el.remove()
  })

  it('setting `icon` injects an svg tagged [data-role="marker"], suppressing the plain dot', async () => {
    const { el, marker } = makeItem()
    expect(marker.querySelector('svg')).toBeNull()
    el.icon = 'check'
    await whenFlushed()
    const svg = marker.querySelector('svg[data-role="marker"]')
    expect(svg).not.toBeNull()
  })

  it('status="done"/"error" inject a built-in check/x glyph when no icon/consumer marker is set', async () => {
    const { el, marker } = makeItem()
    el.status = 'done'
    await whenFlushed()
    expect(marker.querySelector('svg[data-role="marker"]')).not.toBeNull()

    el.status = 'error'
    await whenFlushed()
    expect(marker.querySelector('svg[data-role="marker"]')).not.toBeNull()
  })

  it('status="warning" (ADR-0146 F7) requests its OWN distinct glyph, never done\'s/error\'s (the browser suite proves the rendered shapes differ)', async () => {
    const { el, marker } = makeItem()
    // In jsdom no Phosphor pack is registered, so resolveIcon returns a fallback svg tagged
    // `data-icon-missing="<name>"` — which proves the STATUS→glyph MAPPING requests the correct, DISTINCT
    // name per resolved-outcome status (the real logic under test); rendered-shape distinctness is the
    // browser suite's job (it imports the pack).
    const glyphName = (): string | null =>
      marker.querySelector('svg[data-role="marker"]')?.getAttribute('data-icon-missing') ?? null

    el.status = 'warning'
    await whenFlushed()
    expect(marker.querySelector('svg[data-role="marker"]'), 'warning must inject a built-in glyph').not.toBeNull()
    expect(glyphName(), 'warning requests its own triangle glyph').toBe('warning')

    el.status = 'error'
    await whenFlushed()
    expect(glyphName(), 'error requests the x glyph — distinct from warning').toBe('x')

    el.status = 'done'
    await whenFlushed()
    expect(glyphName(), 'done requests the check glyph — distinct from warning').toBe('check')
    el.remove()
  })

  it('status="pending"/"active"/"" clear any glyph — pure CSS paints the dot/ring/pulse', async () => {
    const { el, marker } = makeItem()
    el.status = 'done'
    await whenFlushed()
    expect(marker.querySelector('svg')).not.toBeNull()

    el.status = 'active'
    await whenFlushed()
    expect(marker.querySelector('svg')).toBeNull()
    el.remove()
  })
})

// ── the collapsible detail — ui-disclosure reuse, toggle re-emit, one nesting level ─────────────────────

describe('ui-timeline-item — the collapsible detail (ui-disclosure composition, ADR-0122 F6)', () => {
  it('a pre-existing [data-role="detail"] child is moved into a composed <ui-disclosure data-part="detail">', () => {
    const { el } = makeItem('<span data-role="detail">Carrier: UPS</span>')
    const disclosure = el.querySelector('[data-part="detail"]')
    expect(disclosure?.tagName.toLowerCase()).toBe('ui-disclosure')
    expect(disclosure?.textContent).toContain('Carrier: UPS')
  })

  it('an item with NO detail content composes no disclosure at all', () => {
    const { el } = makeItem()
    expect(el.querySelector('[data-part="detail"]')).toBeNull()
    el.remove()
  })

  it('toggleDetail() opens/closes the composed disclosure; a no-op when there is no detail', () => {
    const { el } = makeItem('<span data-role="detail">detail text</span>')
    const disclosure = el.querySelector('[data-part="detail"]') as UIDisclosureElement
    expect(disclosure.open).toBe(false)
    el.toggleDetail(true)
    expect(disclosure.open).toBe(true)
    el.toggleDetail()
    expect(disclosure.open).toBe(false)
    el.remove()

    const bare = document.createElement('ui-timeline-item') as UITimelineItemElement
    document.body.append(bare)
    expect(() => bare.toggleDetail(true)).not.toThrow() // no-op, no detail
    bare.remove()
  })

  it('toggling the composed disclosure re-emits EXACTLY one `toggle` on the item host — no other event name', async () => {
    const { el } = makeItem('<span data-role="detail">detail text</span>')
    let toggles = 0
    const seen = new Set<string>()
    for (const type of ['toggle', 'change', 'input', 'select', 'open', 'close']) {
      el.addEventListener(type, () => {
        seen.add(type)
        if (type === 'toggle') toggles++
      })
    }
    el.toggleDetail(true)
    await whenFlushed() // the disclosure's model→platform effect runs, writing details.open
    await new Promise((r) => setTimeout(r, 0)) // the native <details> `toggle` macrotask (disclosure.test.ts's own idiom)
    expect(toggles).toBe(1)
    expect([...seen]).toEqual(['toggle'])
    el.remove()
  })
})

// ── the completion-invariant escape hatch — markTruncated (SPEC-R11) ────────────────────────────────────

describe('ui-timeline-item — markTruncated (the completion-invariant custom state, ui-status-stream\'s seam)', () => {
  it('toggles the :state(truncated) custom state without touching status or emitting an event', () => {
    const { el } = makeItem()
    el.status = 'active'
    let events = 0
    for (const type of ['toggle', 'change', 'input', 'select', 'open', 'close']) el.addEventListener(type, () => events++)

    expect(() => el.markTruncated(true)).not.toThrow()
    expect(el.status).toBe('active') // status is untouched — truncation is a pure CSS/state override
    expect(events).toBe(0)

    expect(() => el.markTruncated(false)).not.toThrow()
    el.remove()
  })
})
