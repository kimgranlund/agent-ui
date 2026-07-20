import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UITimelineItemElement } from './timeline-item.ts'
import { UIDisclosureElement } from '../disclosure/disclosure.ts'
import '../timeline/timeline.ts' // registers ui-timeline — needed for the terminal-connector no-op regression (n8)

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

// ── the GROUP marker glyph — GROUP_STATUS_GLYPH is a DISTINCT set from the leaf's STATUS_GLYPH, keyed off
// `#nested` (ADR-0146 F5), and the shared `data-glyph` stamp is what CSS keys the group-active spin off of
// (code-review coverage gap: this logic shipped with zero tests) ─────────────────────────────────────────

describe('ui-timeline-item — the GROUP marker glyph (ensureNestedSlot sets #nested; GROUP_STATUS_GLYPH is distinct from the leaf set)', () => {
  const glyphOf = (marker: HTMLElement): string | null => marker.querySelector('svg[data-role="marker"]')?.getAttribute('data-glyph') ?? null

  it('a LEAF item (never nested) resolves through STATUS_GLYPH — done/error/warning keep their bare leaf glyphs', async () => {
    const { el, marker } = makeItem()
    el.status = 'done'
    await whenFlushed()
    expect(glyphOf(marker)).toBe('check')

    el.status = 'error'
    await whenFlushed()
    expect(glyphOf(marker)).toBe('x')
  })

  it('ensureNestedSlot() re-paints the marker SYNCHRONOUSLY through GROUP_STATUS_GLYPH — done/error/active each get their OWN distinct group glyph, never the leaf set', () => {
    const { el, marker } = makeItem()
    el.status = 'done'
    el.ensureNestedSlot(() => document.createElement('ui-timeline')) // no `await whenFlushed()` — the repaint is synchronous
    expect(glyphOf(marker), 'a group parent must NOT reuse the leaf check glyph').toBe('check-circle')
    el.remove()
  })

  it("error and warning stay SHAPE-distinct at the group level too (component-review's own fix: error must NOT reuse warning's triangle)", () => {
    const { el: errorEl, marker: errorMarker } = makeItem()
    errorEl.status = 'error'
    errorEl.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(glyphOf(errorMarker)).toBe('x-circle')

    const { el: warnEl, marker: warnMarker } = makeItem()
    warnEl.status = 'warning'
    warnEl.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(glyphOf(warnMarker), 'warning keeps its own triangle, distinct from error\'s x-circle').toBe('warning')

    expect(glyphOf(errorMarker)).not.toBe(glyphOf(warnMarker))
    errorEl.remove()
    warnEl.remove()
  })

  it('status="active" on a group parent requests circle-notch (the CSS spin-animation hook, [data-glyph="circle-notch"])', () => {
    const { el, marker } = makeItem()
    el.status = 'active'
    el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(glyphOf(marker)).toBe('circle-notch')
    el.remove()
  })

  it('a pre-existing [data-role="nested"] child at connect ALSO drives GROUP_STATUS_GLYPH (not just the lazy ensureNestedSlot path)', async () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.status = 'done'
    el.innerHTML = '<ui-timeline data-role="nested"></ui-timeline>'
    document.body.append(el)
    await whenFlushed()
    const marker = el.querySelector('[data-part="marker"]') as HTMLElement
    expect(glyphOf(marker)).toBe('check-circle')
    el.remove()
  })

  // GH #147/ADR-0153 Fork 3 — an all-pending group (every child still "Planned", none started) is a REAL,
  // reachable state (unlike status-stream.ts's own stream-level HEADER_STATUS_GLYPH.pending, whose comment
  // documents why THAT one currently is not) — status-stream.ts's `#recomputeGroups` escalates a group of
  // all-pending children to `escalateStatus`'s `pending` rank the moment they're appended, before any child
  // starts. Previously this fell through to the plain leaf-style CSS hollow-ring (no prominent card-level
  // glyph, unlike active/done/error/warning); `clock` closes that gap.
  it('status="pending" on a group parent requests clock — the same prominent-glyph treatment active/done/error/warning already get', () => {
    const { el, marker } = makeItem()
    el.status = 'pending'
    el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(glyphOf(marker)).toBe('clock')
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

// ── recursive nesting — the [data-role="nested"] slot + the shared disclosure (ADR-0143 F1/F2, TKT-0091) ──

describe('ui-timeline-item — the nested slot adoption (ADR-0143 F1)', () => {
  it('a pre-existing [data-role="nested"] <ui-timeline> child is moved into the composed <ui-disclosure data-part="detail">', () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="step 1"></ui-timeline-item></ui-timeline>')
    const disclosure = el.querySelector('[data-part="detail"]')
    expect(disclosure?.tagName.toLowerCase()).toBe('ui-disclosure')
    const nested = disclosure?.querySelector('ui-timeline')
    expect(nested?.tagName.toLowerCase()).toBe('ui-timeline')
    expect(nested?.querySelector('ui-timeline-item')?.getAttribute('label')).toBe('step 1')
    el.remove()
  })

  it('an item with NEITHER detail nor nested composes no disclosure at all (unchanged from today)', () => {
    const { el } = makeItem()
    expect(el.querySelector('[data-part="detail"]')).toBeNull()
    el.remove()
  })
})

describe('ui-timeline-item — the shared disclosure adopts detail THEN nested, one caret (ADR-0143 F2)', () => {
  it('detail-only composes a disclosure with just that content', () => {
    const { el } = makeItem('<span data-role="detail">detail text</span>')
    const disclosure = el.querySelector('[data-part="detail"]')!
    expect(disclosure.textContent).toContain('detail text')
    expect(disclosure.querySelector('ui-timeline')).toBeNull()
    el.remove()
  })

  it('nested-only composes a disclosure with just the nested <ui-timeline>', () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="a"></ui-timeline-item></ui-timeline>')
    const disclosure = el.querySelector('[data-part="detail"]')!
    expect(disclosure.querySelector('ui-timeline')).not.toBeNull()
    el.remove()
  })

  it('BOTH detail and nested compose into ONE disclosure, detail content before nested, in DOM order', () => {
    const { el } = makeItem(
      '<span data-role="detail">detail text</span><ui-timeline data-role="nested"><ui-timeline-item label="a"></ui-timeline-item></ui-timeline>',
    )
    const disclosures = el.querySelectorAll('[data-part="detail"]')
    expect(disclosures.length).toBe(1) // exactly ONE shared disclosure, never two
    const disclosure = disclosures[0]!
    const body = disclosure.querySelector('[data-part="body"]')! // ui-disclosure adopts its light children into its own body part
    const children = [...body.children]
    expect(children.length).toBe(2)
    expect(children[0]?.getAttribute('data-role')).toBe('detail')
    expect(children[1]?.tagName.toLowerCase()).toBe('ui-timeline')
    el.remove()
  })
})

describe('ui-timeline-item — arbitrary recursion depth, no cap, no new mechanism per level (ADR-0143 F3 "no infinite-loop guard needed")', () => {
  it('a 3-level-deep authored nesting connects cleanly with no error', () => {
    const markup = `
      <ui-timeline data-role="nested">
        <ui-timeline-item label="depth 1">
          <ui-timeline data-role="nested">
            <ui-timeline-item label="depth 2">
              <ui-timeline data-role="nested">
                <ui-timeline-item label="depth 3"></ui-timeline-item>
              </ui-timeline>
            </ui-timeline-item>
          </ui-timeline>
        </ui-timeline-item>
      </ui-timeline>`
    expect(() => makeItem(markup)).not.toThrow()
    const { el } = makeItem(markup)
    const depth3 = el.querySelector('[label="depth 3"]')
    expect(depth3).not.toBeNull()
    el.remove()
  })
})

// ── the confirmed no-op — timeline.ts terminal-connector marking self-scopes per nesting level (n8) ────────

describe('ui-timeline-item — terminal-connector [data-last] self-scopes per nesting level (a confirmed no-op, no code change to timeline.ts)', () => {
  it("a nested ui-timeline's own last child gets [data-last], independent of the OUTER timeline's own last-item marking", () => {
    const outer = document.createElement('ui-timeline')
    outer.innerHTML = `
      <ui-timeline-item label="outer 1"></ui-timeline-item>
      <ui-timeline-item label="outer 2">
        <ui-timeline data-role="nested">
          <ui-timeline-item label="inner 1"></ui-timeline-item>
          <ui-timeline-item label="inner 2"></ui-timeline-item>
        </ui-timeline>
      </ui-timeline-item>`
    document.body.append(outer)

    const outerItems = outer.querySelectorAll(':scope > ui-timeline-item')
    expect(outerItems[0]?.hasAttribute('data-last')).toBe(false)
    expect(outerItems[1]?.hasAttribute('data-last')).toBe(true) // "outer 2" is the OUTER timeline's own last child

    const innerTimeline = outer.querySelector('[data-role="nested"] ui-timeline, ui-timeline [data-role="nested"]') ?? outer.querySelector('ui-timeline-item[label="outer 2"] ui-timeline')
    const inner = innerTimeline ?? outer.querySelector('ui-timeline ui-timeline')!
    const innerItems = inner.querySelectorAll(':scope > ui-timeline-item')
    expect(innerItems[0]?.hasAttribute('data-last')).toBe(false)
    expect(innerItems[1]?.hasAttribute('data-last')).toBe(true) // "inner 2" is the NESTED timeline's OWN last child — self-scoped, un-interfered-with

    outer.remove()
  })
})

// ── the collapsed-summary preview — last-descendant resolution, live-updating, the trailing paint gate ────
// (ADR-0143 F3)

describe('ui-timeline-item — last-descendant resolution (last child wins, no status-priority)', () => {
  it('resolves to the LAST of 3 nested items', async () => {
    const { el } = makeItem(
      '<ui-timeline data-role="nested"><ui-timeline-item label="a" status="done"></ui-timeline-item><ui-timeline-item label="b" status="active"></ui-timeline-item><ui-timeline-item label="c" status="pending"></ui-timeline-item></ui-timeline>',
    )
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('c')
    el.remove()
  })

  it('a 2-level-deep nesting resolves to the DEEPEST leaf, not the intermediate item', async () => {
    const { el } = makeItem(`
      <ui-timeline data-role="nested">
        <ui-timeline-item label="outer-last">
          <ui-timeline data-role="nested">
            <ui-timeline-item label="inner-leaf" status="done"></ui-timeline-item>
          </ui-timeline>
        </ui-timeline-item>
      </ui-timeline>`)
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('inner-leaf')
    expect(trailing.textContent).not.toContain('outer-last')
    el.remove()
  })

  it('an item with no nested slot never attempts resolution — trailing stays a plain, unwritten cell', async () => {
    const { el } = makeItem()
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toBe('')
    el.remove()
  })
})

describe('ui-timeline-item — the MutationObserver keeps the preview live', () => {
  it('appending a new last item to the nested timeline AFTER connect updates the resolved preview source', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="first"></ui-timeline-item></ui-timeline>')
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('first')

    const nested = el.querySelector('ui-timeline')!
    const extra = document.createElement('ui-timeline-item')
    extra.setAttribute('label', 'second')
    nested.append(extra)
    await new Promise((r) => setTimeout(r, 0)) // MutationObserver callbacks fire as a microtask after the mutation
    expect(trailing.textContent).toContain('second')
    el.remove()
  })

  it("changing the current last item's status or label attribute updates the preview", async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="step" status="active"></ui-timeline-item></ui-timeline>')
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toBe('● step')

    const item = el.querySelector('ui-timeline-item[label="step"]')!
    item.setAttribute('status', 'done')
    await new Promise((r) => setTimeout(r, 0))
    expect(trailing.textContent).toBe('✓ step')

    item.setAttribute('label', 'renamed')
    await new Promise((r) => setTimeout(r, 0))
    expect(trailing.textContent).toBe('✓ renamed')
    el.remove()
  })

  it('the observer disconnects on disconnected() (the toast-region/disclosure heal-observer teardown precedent) — no error on a mutation after removal', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="a"></ui-timeline-item></ui-timeline>')
    await whenFlushed()
    const nested = el.querySelector('ui-timeline')!
    el.remove()
    expect(() => {
      const extra = document.createElement('ui-timeline-item')
      extra.setAttribute('label', 'b')
      nested.append(extra)
    }).not.toThrow()
  })
})

describe('ui-timeline-item — the trailing paint gate (open/closed, consumer-owned never overwritten)', () => {
  it('while the disclosure is OPEN, trailing stays empty (the real nested content is directly visible instead)', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="a" status="done"></ui-timeline-item></ui-timeline>')
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('a') // closed by default — painted

    el.toggleDetail(true)
    await whenFlushed()
    expect(trailing.textContent).toBe('') // open — cleared, no duplicate
    el.remove()
  })

  it('closing the disclosure (re-closing after open) re-paints the resolved preview', async () => {
    const { el } = makeItem('<ui-timeline data-role="nested"><ui-timeline-item label="a" status="done"></ui-timeline-item></ui-timeline>')
    await whenFlushed()
    el.toggleDetail(true)
    await whenFlushed()
    el.toggleDetail(false)
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('a')
    el.remove()
  })

  it('a consumer-authored [data-role="trailing"] child is NEVER overwritten by the preview effect, at any open/closed state', async () => {
    const { el } = makeItem(
      '<span data-role="trailing">consumer text</span><ui-timeline data-role="nested"><ui-timeline-item label="a" status="done"></ui-timeline-item></ui-timeline>',
    )
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toBe('consumer text') // closed — still untouched

    el.toggleDetail(true)
    await whenFlushed()
    expect(trailing.textContent).toBe('consumer text') // open — still untouched

    el.toggleDetail(false)
    await whenFlushed()
    expect(trailing.textContent).toBe('consumer text') // re-closed — still untouched
    el.remove()
  })
})

// ── size does NOT cascade into a nested <ui-timeline> (ADR-0143 F7, n19) ────────────────────────────────

describe('ui-timeline-item — size does not cascade into a nested <ui-timeline> (ADR-0143 F7)', () => {
  it('a parent size="lg" item hosting an UNAUTHORED nested <ui-timeline> (no size attribute) resolves the nested items to the DEFAULT "md" register, not "lg"', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.setAttribute('size', 'lg')
    el.innerHTML = '<ui-timeline data-role="nested"><ui-timeline-item label="a"></ui-timeline-item></ui-timeline>'
    document.body.append(el)
    const nestedItem = el.querySelector('ui-timeline-item[label="a"]') as UITimelineItemElement
    expect(nestedItem.size).toBe('md') // the shipped default — no forwarding mechanism exists
    el.remove()
  })

  it('a nested <ui-timeline size="sm"> resolves its own items to "sm" regardless of the parent\'s size — each level is independently authored', () => {
    const el = document.createElement('ui-timeline-item') as UITimelineItemElement
    el.setAttribute('size', 'lg')
    el.innerHTML = '<ui-timeline data-role="nested" size="sm"><ui-timeline-item label="a"></ui-timeline-item></ui-timeline>'
    document.body.append(el)
    const nested = el.querySelector('ui-timeline') as HTMLElement & { size: string }
    expect(nested.size).toBe('sm')
    el.remove()
  })
})

// ── ensureNestedSlot — the LAZY late-mount seam (ADR-0146 F5, the ADR-0143 2026-07-18 amendment) ─────────
// Kim ratified ONE new public method so ui-status-stream's grouping can mount a nested <ui-timeline> into an
// ALREADY-connected item, composing the SAME disclosure + nested slot + preview `#ensureAnatomy` builds at
// connect — just lazily. These probes assert the seam's contract directly on the item (grouping-via-the-stream
// is proven in status-stream.test.ts).

describe('ui-timeline-item — ensureNestedSlot lazy composition (branch: no disclosure yet)', () => {
  it('composes a fresh <ui-disclosure data-part="detail"> with the nested host in its body, SYNCHRONOUSLY, for an item authored WITHOUT detail/nested', () => {
    const { el } = makeItem() // no detail, no nested → no disclosure at connect
    expect(el.querySelector('[data-part="detail"]')).toBeNull()

    const nested = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(nested.getAttribute('data-role')).toBe('nested')
    expect(nested.tagName.toLowerCase()).toBe('ui-timeline')

    const disclosure = el.querySelector('[data-part="detail"]')!
    expect(disclosure.tagName.toLowerCase()).toBe('ui-disclosure')
    // the nested host is adopted into the disclosure's own body part synchronously (compose-before-connect)
    const body = disclosure.querySelector('[data-part="body"]')!
    expect(body.querySelector('ui-timeline')).toBe(nested)
    el.remove()
  })

  it('is idempotent — a second call returns the SAME node and never composes a second disclosure', () => {
    const { el } = makeItem()
    const first = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    const second = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(second).toBe(first)
    expect(el.querySelectorAll('[data-part="detail"]')).toHaveLength(1) // exactly ONE shared disclosure, never two
    expect(el.querySelectorAll('[data-role="nested"]')).toHaveLength(1)
    el.remove()
  })
})

describe('ui-timeline-item — ensureNestedSlot lazy composition (branch: a detail-only disclosure already exists)', () => {
  it('appends the nested host into the EXISTING shared disclosure (the ADR-0143 F2 two-hop, healed into the body)', async () => {
    const { el } = makeItem('<span data-role="detail">Carrier: UPS</span>')
    const disclosure = el.querySelector('[data-part="detail"]')!
    expect(disclosure.tagName.toLowerCase()).toBe('ui-disclosure')
    expect(disclosure.querySelector('ui-timeline')).toBeNull() // detail-only so far

    const nested = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    expect(el.querySelectorAll('[data-part="detail"]')).toHaveLength(1) // still ONE shared disclosure, never a second

    // the disclosure's own childList heal observer relocates the late-appended nested host into its body part
    await new Promise((r) => setTimeout(r, 0))
    const body = disclosure.querySelector('[data-part="body"]')!
    expect(body.querySelector('ui-timeline')).toBe(nested)
    // detail content is preserved alongside the nested host (both live under the ONE disclosure)
    expect(disclosure.textContent).toContain('Carrier: UPS')
    el.remove()
  })
})

describe('ui-timeline-item — ensureNestedSlot arms the collapsed-summary preview + observer EXACTLY like the connect-time path', () => {
  it('a child appended to the LATE-mounted nested host updates the trailing preview (the MutationObserver is live)', async () => {
    const { el } = makeItem() // connected, no nested at connect
    const nested = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    await whenFlushed()
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toBe('') // empty nested host → nothing to preview yet

    const child = document.createElement('ui-timeline-item')
    child.setAttribute('label', 'step 1')
    child.setAttribute('status', 'active')
    nested.append(child)
    await new Promise((r) => setTimeout(r, 0)) // the observer fires as a microtask after the mutation
    expect(trailing.textContent).toBe('● step 1') // the closed-disclosure preview paints the last descendant

    // a status change on the last descendant re-paints the preview (same observer path as the authored case)
    child.setAttribute('status', 'warning')
    await new Promise((r) => setTimeout(r, 0))
    expect(trailing.textContent).toBe('▲ step 1') // ADR-0146 F7 — warning's distinct triangle shape, never hue alone
    el.remove()
  })

  it('the late-mounted preview honours the open/closed paint gate (cleared while the disclosure is OPEN)', async () => {
    const { el } = makeItem()
    const nested = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    const child = document.createElement('ui-timeline-item')
    child.setAttribute('label', 'a')
    child.setAttribute('status', 'done')
    nested.append(child)
    await new Promise((r) => setTimeout(r, 0))
    const trailing = el.querySelector('[data-role="trailing"]')!
    expect(trailing.textContent).toContain('a') // closed → painted

    el.toggleDetail(true)
    await whenFlushed()
    expect(trailing.textContent).toBe('') // open → cleared, no duplicate (the real nested content is visible)
    el.remove()
  })

  it('the late-armed observer disconnects on disconnected() — no error on a mutation after removal', async () => {
    const { el } = makeItem()
    const nested = el.ensureNestedSlot(() => document.createElement('ui-timeline'))
    await whenFlushed()
    el.remove()
    expect(() => {
      const extra = document.createElement('ui-timeline-item')
      extra.setAttribute('label', 'b')
      nested.append(extra)
    }).not.toThrow()
  })
})
