import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UITimelineItemElement } from './timeline-item.ts'
import { UIDisclosureElement } from '../disclosure/disclosure.ts'
import '../timeline/timeline.ts' // registers ui-timeline — ADR-0143's nested slot composes a genuine <ui-timeline> child

// timeline-family.lld.md §2 · SPEC-R1…R5 — ui-timeline-item jsdom behaviour probes. Mirrors the
// disclosure/toast test template (upgrade → anatomy → status/marker glyph → the wrapper-trap regression →
// the composed detail/toggle re-emit → the completion-invariant markTruncated escape hatch). ADR-0143's
// recursive nesting + shared accordion + collapsed-summary preview probes live at the end of this file.

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

// ── ADR-0143 F1/F2/F4 — recursive nesting via [data-role="nested"] + the shared accordion ──────────────

describe('ui-timeline-item — recursive nesting (ADR-0143 F1: a genuine nested <ui-timeline>, adopted like detail)', () => {
  it('adopts a pre-existing [data-role="nested"] <ui-timeline> child, moved (not cloned) into the composed disclosure exactly once at connect', () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="Sub A"></ui-timeline-item></ui-timeline>')
    const disclosure = el.querySelector('[data-part="detail"]')
    expect(disclosure?.tagName.toLowerCase()).toBe('ui-disclosure')
    // the disclosure's OWN #ensureParts() adopts pre-existing children into its [data-part="body"] part
    // (disclosure.ts) — so the nested <ui-timeline> is a DESCENDANT of the disclosure, not necessarily its
    // direct child.
    const nested = disclosure?.querySelector('ui-timeline')
    expect(nested).not.toBeNull()
    expect(nested?.querySelector('ui-timeline-item')?.getAttribute('label')).toBe('Sub A')

    const before = el.children.length
    el.remove()
    document.body.append(el) // reconnect
    expect(el.children.length).toBe(before) // idempotent — not re-adopted a second time
    expect(el.querySelectorAll('ui-disclosure')).toHaveLength(1)
    el.remove()
  })

  it('an item with ONLY detail composes a disclosure with just that content (regression — byte-identical to today\'s shipped behavior)', () => {
    const { el } = makeItem('<span data-role="detail">Carrier: UPS</span>')
    const disclosure = el.querySelector('[data-part="detail"]')!
    expect(disclosure.querySelector('ui-timeline')).toBeNull()
    expect(disclosure.textContent).toContain('Carrier: UPS')
    el.remove()
  })

  it('an item with ONLY nested composes a disclosure with just the nested <ui-timeline>', () => {
    const { el } = makeItem('<ui-timeline data-role="nested"></ui-timeline>')
    const disclosure = el.querySelector('[data-part="detail"]')!
    const body = disclosure.querySelector('[data-part="body"]')!
    expect(body.children).toHaveLength(1)
    expect(disclosure.querySelector('ui-timeline')).not.toBeNull()
    el.remove()
  })

  it('an item with BOTH detail and nested composes ONE shared disclosure, detail FIRST then nested, in that order', () => {
    const { el } = makeItem('<span data-role="detail">detail text</span><ui-timeline data-role="nested"></ui-timeline>')
    const disclosures = el.querySelectorAll('ui-disclosure')
    expect(disclosures).toHaveLength(1) // ONE shared disclosure, never two
    const body = disclosures[0]!.querySelector('[data-part="body"]')!
    expect(body.children).toHaveLength(2)
    expect(body.children[0]?.getAttribute('data-role')).toBe('detail')
    expect(body.children[1]?.tagName.toLowerCase()).toBe('ui-timeline')
    el.remove()
  })

  it('an item with NEITHER detail nor nested composes no disclosure at all (unchanged from today)', () => {
    const { el } = makeItem()
    expect(el.querySelector('ui-disclosure')).toBeNull()
    el.remove()
  })

  it('supports arbitrary authored recursion depth — a 3-level-deep nesting connects cleanly, no cap, no error, no infinite-loop guard needed', () => {
    const markup =
      '<ui-timeline data-role="nested"><ui-timeline-item label="L1">' +
      '<ui-timeline data-role="nested"><ui-timeline-item label="L2">' +
      '<ui-timeline data-role="nested"><ui-timeline-item label="L3"></ui-timeline-item></ui-timeline>' +
      '</ui-timeline-item></ui-timeline>' +
      '</ui-timeline-item></ui-timeline>'
    expect(() => makeItem(markup)).not.toThrow()
    const { el } = makeItem(markup)
    const l3 = el.querySelector('ui-timeline-item[label="L1"] ui-timeline-item[label="L2"] ui-timeline-item[label="L3"]')
    expect(l3).not.toBeNull()
    el.remove()
  })
})

// ── the confirmed no-op — terminal-connector marking already self-scopes per nesting level ──────────────

describe('ui-timeline-item — the confirmed no-op: [data-last] marking self-scopes per nesting level (ADR-0143)', () => {
  it("a nested ui-timeline's own last child gets [data-last], independent of and un-interfered-with by the OUTER timeline's own last-item marking", async () => {
    const outer = document.createElement('ui-timeline')
    outer.innerHTML =
      '<ui-timeline-item label="Outer A"></ui-timeline-item>' +
      '<ui-timeline-item label="Outer B">' +
      '<ui-timeline data-role="nested">' +
      '<ui-timeline-item label="Inner A"></ui-timeline-item>' +
      '<ui-timeline-item label="Inner B"></ui-timeline-item>' +
      '</ui-timeline>' +
      '</ui-timeline-item>'
    document.body.append(outer)
    await new Promise((r) => setTimeout(r, 0))

    const outerItems = outer.querySelectorAll(':scope > ui-timeline-item')
    expect(outerItems[0]!.hasAttribute('data-last')).toBe(false)
    expect(outerItems[1]!.hasAttribute('data-last')).toBe(true) // the OUTER's own last item

    const nested = outer.querySelector('ui-timeline[data-role="nested"]')!
    const innerItems = nested.querySelectorAll(':scope > ui-timeline-item')
    expect(innerItems[0]!.hasAttribute('data-last')).toBe(false)
    expect(innerItems[1]!.hasAttribute('data-last')).toBe(true) // the NESTED timeline's OWN last item — unaffected by the outer

    outer.remove()
  })
})

// ── ADR-0143 F3 — the collapsed-summary preview (last-descendant resolution) ────────────────────────────

describe('ui-timeline-item — collapsed-summary preview: last-descendant resolution ("last child wins", no status-priority)', () => {
  it('resolves to the LAST item of a 3-item nested timeline', () => {
    const { el } = makeItem(
      '<ui-timeline data-role="nested">' +
        '<ui-timeline-item label="Picked" status="done"></ui-timeline-item>' +
        '<ui-timeline-item label="Packing" status="active"></ui-timeline-item>' +
        '<ui-timeline-item label="Shipping" status="pending"></ui-timeline-item>' +
        '</ui-timeline>',
    )
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('Shipping')
    el.remove()
  })

  it("recurses to the DEEPEST leaf when the nested timeline's own last item itself has a further-nested timeline", () => {
    const { el } = makeItem(
      '<ui-timeline data-role="nested">' +
        '<ui-timeline-item label="A" status="done"></ui-timeline-item>' +
        '<ui-timeline-item label="B" status="active">' +
        '<ui-timeline data-role="nested">' +
        '<ui-timeline-item label="B1" status="done"></ui-timeline-item>' +
        '<ui-timeline-item label="B2" status="pending"></ui-timeline-item>' +
        '</ui-timeline>' +
        '</ui-timeline-item>' +
        '</ui-timeline>',
    )
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('B2') // the DEEPEST leaf, not "B" the intermediate item
    el.remove()
  })

  it('an item with no nested slot never attempts resolution — a plain no-op, not an error, trailing stays empty', () => {
    expect(() => makeItem()).not.toThrow()
    const { el } = makeItem()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('')
    el.remove()
  })
})

// ── ADR-0143 F3 — the MutationObserver keeps the resolved source current ────────────────────────────────

describe('ui-timeline-item — collapsed-summary preview: the MutationObserver recomputes on relevant nested-subtree changes', () => {
  it('appending a new last item to the nested timeline AFTER connect updates the resolved preview', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="First" status="done"></ui-timeline-item></ui-timeline>')
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('First')

    const nested = el.querySelector('ui-timeline[data-role="nested"]')!
    const item2 = document.createElement('ui-timeline-item')
    item2.setAttribute('label', 'Second')
    item2.setAttribute('status', 'active')
    nested.append(item2)
    await new Promise((r) => setTimeout(r, 0)) // the MutationObserver callback is microtask-scheduled

    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('Second')
    el.remove()
  })

  it("changing the current last item's status or label attribute updates the preview too", async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="First" status="active"></ui-timeline-item></ui-timeline>')
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('First')

    const item = el.querySelector('ui-timeline-item[label="First"]')!
    item.setAttribute('label', 'Renamed')
    item.setAttribute('status', 'done')
    await new Promise((r) => setTimeout(r, 0))

    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('Renamed')
    el.remove()
  })

  it('the nested observer is disconnected on disconnect — a later subtree mutation never throws and never re-paints a removed host', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="X"></ui-timeline-item></ui-timeline>')
    const nested = el.querySelector('ui-timeline[data-role="nested"]')!
    el.remove() // disconnects — the observer must tear down
    expect(() => nested.querySelector('ui-timeline-item')!.setAttribute('label', 'Y')).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })
})

// ── ADR-0143 F3 — the paint gate (open clears, closed paints, consumer-owned trailing is untouched) ─────

describe('ui-timeline-item — collapsed-summary preview: the paint gate', () => {
  it('while the composed disclosure is OPEN, trailing stays empty — the real nested content is directly visible instead', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="Sub" status="done"></ui-timeline-item></ui-timeline>')
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('Sub')
    el.toggleDetail(true)
    await whenFlushed()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('')
    el.remove()
  })

  it('closing the disclosure (re-)paints the resolved label + a non-color status-shape glyph into trailing', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="Sub" status="done"></ui-timeline-item></ui-timeline>')
    el.toggleDetail(true)
    await whenFlushed()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('')
    el.toggleDetail(false)
    await whenFlushed()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toContain('Sub')
    el.remove()
  })

  it('a consumer-authored [data-role="trailing"] child is NEVER overwritten by the preview effect, at any open/closed state', async () => {
    const { el } = makeItem(
      '<span data-role="trailing">Consumer text</span>' +
        '<ui-timeline data-role="nested"><ui-timeline-item label="Sub" status="done"></ui-timeline-item></ui-timeline>',
    )
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('Consumer text')
    el.toggleDetail(true)
    await whenFlushed()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('Consumer text')
    el.toggleDetail(false)
    await whenFlushed()
    expect(el.querySelector('[data-role="trailing"]')?.textContent).toBe('Consumer text')
    el.remove()
  })
})

// ── ADR-0143 F7 — size does NOT cascade into a nested <ui-timeline> ──────────────────────────────────────

describe('ui-timeline-item — size does NOT cascade into a nested <ui-timeline> (ADR-0143 F7)', () => {
  it('a parent item with size="lg" hosting an UNAUTHORED nested item resolves that item\'s OWN default size ("md"), not "lg"', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.setAttribute('size', 'lg')
    el.innerHTML = '<ui-timeline data-role="nested"><ui-timeline-item label="Sub"></ui-timeline-item></ui-timeline>'
    document.body.append(el)
    const nestedItem = el.querySelector('ui-timeline-item[label="Sub"]') as UITimelineItemElement
    expect(nestedItem.size).toBe('md') // never forwarded/inherited from the ancestor's "lg" — a negative control
    el.remove()
  })

  it('a nested item explicitly authored size="sm" resolves "sm" regardless of the parent\'s size="lg" — each level is independently authored', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.setAttribute('size', 'lg')
    el.innerHTML = '<ui-timeline data-role="nested"><ui-timeline-item label="Sub" size="sm"></ui-timeline-item></ui-timeline>'
    document.body.append(el)
    const nestedItem = el.querySelector('ui-timeline-item[label="Sub"]') as UITimelineItemElement
    expect(nestedItem.size).toBe('sm')
    el.remove()
  })
})
