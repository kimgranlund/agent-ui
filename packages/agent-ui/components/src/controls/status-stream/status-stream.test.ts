import { describe, it, expect, vi } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIStatusStreamElement, escalateStatus, type ItemStatus } from './status-stream.ts'
import { UITimelineItemElement } from '../timeline-item/timeline-item.ts'
import { UITimelineElement } from '../timeline/timeline.ts'

// timeline-family.lld.md §4 · SPEC-R8/R9/R11/R12 — ui-status-stream jsdom behaviour probes (the live
// host): upgrade → role=log via internals → appendEntry/keyed-update/finalize → the text-growth cell → the
// completion invariant → the static/live divergence proof against the SAME content under ui-timeline.
// `scrollIntoView` is absent in jsdom (a real browser always has it) — status-stream.ts guards it, so
// appendEntry/update never throw here; the REAL tail-follow proof is status-stream.browser.test.ts's.

function makeStream(): { el: UIStatusStreamElement } {
  const el = document.createElement('ui-status-stream') as UIStatusStreamElement
  document.body.append(el)
  return { el }
}

/** A stream with the opt-in header already materialized (the effect runs on connect, then flushed). */
async function makeHeaderStream(label = 'Agent activity'): Promise<{ el: UIStatusStreamElement; header: () => HTMLElement | null }> {
  const el = document.createElement('ui-status-stream') as UIStatusStreamElement
  el.label = label
  el.header = true
  document.body.append(el)
  await whenFlushed()
  return { el, header: () => el.querySelector('[data-part="header"]') }
}

const headerStatus = (el: UIStatusStreamElement): string | null =>
  el.querySelector('[data-part="header"]')?.getAttribute('data-status') ?? null

// ── the escalation ladder (ADR-0146 F6) — the pure reduce, directly unit-tested ────────────────────────

describe('escalateStatus — worst-child-wins over the closed ADR-0146 F6 ladder', () => {
  it('[done, warning] reads warning (warning outranks done)', () => {
    expect(escalateStatus(['done', 'warning'])).toBe('warning')
  })

  it('[active, error] reads error — the error-beats-active case, asserted explicitly', () => {
    expect(escalateStatus(['active', 'error'])).toBe('error')
    expect(escalateStatus(['error', 'active'])).toBe('error') // order-independent
  })

  it('neutral "" contributes nothing (a strip of only-neutral reads "")', () => {
    expect(escalateStatus(['', 'done'])).toBe('done')
    expect(escalateStatus(['', '', ''])).toBe('')
    expect(escalateStatus([])).toBe('')
  })

  it('the full total order error > warning > active > pending > done', () => {
    const ladder: ItemStatus[] = ['done', 'pending', 'active', 'warning', 'error']
    // each step outranks all lower ones
    expect(escalateStatus(['done', 'pending'])).toBe('pending')
    expect(escalateStatus(['pending', 'active'])).toBe('active')
    expect(escalateStatus(['active', 'warning'])).toBe('warning')
    expect(escalateStatus(['warning', 'error'])).toBe('error')
    expect(escalateStatus(ladder)).toBe('error') // the whole ladder escalates to its worst
  })
})

describe('ui-status-stream — upgrade + typed prop surface', () => {
  it('upgrades to the class, extends UIContainerElement, props at their defaults', () => {
    const el = document.createElement('ui-status-stream') as UIStatusStreamElement
    expect(el).toBeInstanceOf(UIStatusStreamElement)
    expect(el.size).toBe('md')
    expect(el.label).toBe('')
  })

  it('self-defines ui-status-stream, guarded against a double-define', () => {
    expect(customElements.get('ui-status-stream')).toBe(UIStatusStreamElement)
    expect(() => {
      if (!customElements.get('ui-status-stream')) customElements.define('ui-status-stream', UIStatusStreamElement)
    }).not.toThrow()
  })

  it('internals.role is "log" (set in the constructor, before insertion) — a POLITE live region, no host role attribute', () => {
    const el = document.createElement('ui-status-stream') as UIStatusStreamElement
    // @ts-expect-error — internals is protected; the test reaches in to assert the pre-insertion contract
    expect(el.internals.role).toBe('log')
    document.body.append(el)
    expect(el.hasAttribute('role')).toBe(false)
    el.remove()
  })

  it('dispatches NO event on appendEntry/update/finalize (SPEC-R12 — streamed state rides role=log, not events)', () => {
    const { el } = makeStream()
    let events = 0
    for (const type of ['toggle', 'change', 'input', 'select', 'open', 'close']) el.addEventListener(type, () => events++)
    el.appendEntry({ key: 'a', status: 'active', label: 'Searching…' })
    el.update('a', { status: 'done' })
    el.finalize()
    expect(events).toBe(0)
    el.remove()
  })
})

describe('ui-status-stream — the SAME content authored under ui-timeline vs appended here yields a DIFFERENT ARIA role (SPEC-R8 AC2)', () => {
  it('role differs: list (durable) vs log (live) — the mechanical proof the two are distinct controls', () => {
    const timeline = document.createElement('ui-timeline') as UITimelineElement
    document.body.append(timeline)
    const { el: stream } = makeStream()
    // @ts-expect-error — internals is protected
    expect(timeline.internals.role).toBe('list')
    // @ts-expect-error
    expect(stream.internals.role).toBe('log')
    timeline.remove()
    stream.remove()
  })
})

describe('ui-status-stream — appendEntry (SPEC-R9 AC1)', () => {
  it('creates a ui-timeline-item with the entry\'s fields, appends it, and returns the SAME element', () => {
    const { el } = makeStream()
    const item = el.appendEntry({ key: 'a', status: 'active', label: 'search', description: '', timestamp: '' })
    expect(item).toBeInstanceOf(UITimelineItemElement)
    expect(item.status).toBe('active')
    expect(item.label).toBe('search')
    expect(el.contains(item)).toBe(true)
    expect(item.dataset.key).toBe('a')
    el.remove()
  })

  it('appending two entries preserves arrival order', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'a', label: 'first' })
    el.appendEntry({ key: 'b', label: 'second' })
    const items = Array.from(el.querySelectorAll('ui-timeline-item')) as UITimelineItemElement[]
    expect(items.map((i) => i.label)).toEqual(['first', 'second']) // `label` does not reflect — read via the typed property
    el.remove()
  })
})

describe('ui-status-stream — keyed update (SPEC-R9 AC1/AC2)', () => {
  it('transitions the SAME element in place — no second element appended for the same key', () => {
    const { el } = makeStream()
    const item = el.appendEntry({ key: 'a', status: 'active', label: 'search' })
    el.update('a', { status: 'done' })
    expect(el.querySelectorAll('ui-timeline-item')).toHaveLength(1)
    expect(el.querySelector('ui-timeline-item')).toBe(item) // identity — the SAME node, not a new one
    expect(item.status).toBe('done')
    el.remove()
  })

  it('update("missing", ...) with no such key is a silent no-op — never a throw, no element created', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'a', label: 'x' })
    expect(() => el.update('missing', { status: 'done' })).not.toThrow()
    expect(el.querySelectorAll('ui-timeline-item')).toHaveLength(1)
    el.remove()
  })

  it('a partial patch touches ONLY the provided fields — untouched fields are unchanged', () => {
    const { el } = makeStream()
    const item = el.appendEntry({ key: 'a', status: 'active', label: 'search', description: 'orig' })
    el.update('a', { status: 'done' })
    expect(item.label).toBe('search') // untouched
    expect(item.description).toBe('orig') // untouched
    el.remove()
  })
})

describe('ui-status-stream — streamed text (SPEC-R9 AC3): grown in place, never parsed', () => {
  it('update(key,{text}) find-or-creates a [data-role="text"] cell and sets it verbatim', () => {
    const { el } = makeStream()
    const item = el.appendEntry({ key: 'a', status: 'active' })
    el.update('a', { text: 'Reasoning: the failure is in the reconcile…' })
    const cell = item.querySelector('[data-role="text"]')
    expect(cell?.textContent).toBe('Reasoning: the failure is in the reconcile…')

    el.update('a', { text: 'Reasoning: the failure is in the reconcile loop specifically…' })
    expect(item.querySelectorAll('[data-role="text"]')).toHaveLength(1) // the SAME cell, not a new one each call
    expect(item.querySelector('[data-role="text"]')?.textContent).toBe('Reasoning: the failure is in the reconcile loop specifically…')
    el.remove()
  })

  it('never tokenizes/parses the text — HTML-looking content lands as literal text, not markup', () => {
    const { el } = makeStream()
    const item = el.appendEntry({ key: 'a' })
    el.update('a', { text: '<b>not bold</b>' })
    const cell = item.querySelector('[data-role="text"]') as HTMLElement
    expect(cell.textContent).toBe('<b>not bold</b>')
    expect(cell.querySelector('b')).toBeNull() // never parsed as markup
    el.remove()
  })
})

describe('ui-status-stream — the completion invariant (SPEC-R11)', () => {
  it('finalize() marks every still-active/pending entry TRUNCATED via the item\'s own markTruncated escape hatch', () => {
    const { el } = makeStream()
    const active = el.appendEntry({ key: 'a', status: 'active' })
    const pending = el.appendEntry({ key: 'b', status: 'pending' })
    const done = el.appendEntry({ key: 'c', status: 'done' })
    const error = el.appendEntry({ key: 'd', status: 'error' })

    const spies = [active, pending, done, error].map((item) => vi.spyOn(item, 'markTruncated'))
    el.finalize()

    expect(spies[0]).toHaveBeenCalledWith(true) // active → truncated
    expect(spies[1]).toHaveBeenCalledWith(true) // pending → truncated
    expect(spies[2]).not.toHaveBeenCalled() // done — already resolved, untouched
    expect(spies[3]).not.toHaveBeenCalled() // error — already resolved, untouched
    el.remove()
  })

  it('a torn stream (finalize after an update mid-entry) truncates the affected entry, not the resolved ones', () => {
    const { el } = makeStream()
    const a = el.appendEntry({ key: 'a', status: 'active', label: 'Generating the patch…' })
    el.update('a', { text: 'partial reasoning…' }) // the stream tears here — never resolves
    const spy = vi.spyOn(a, 'markTruncated')
    el.finalize()
    expect(spy).toHaveBeenCalledWith(true)
    el.remove()
  })

  it('a late update after finalize/truncation is tolerated (never a throw) — SPEC-R11 tolerant-resolve', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'a', status: 'active' })
    el.finalize()
    expect(() => el.update('a', { status: 'done' })).not.toThrow()
    el.remove()
  })
})

describe('ui-status-stream — the opt-in streaming header (ADR-0146 F8)', () => {
  it('header:false (default) renders NO header DOM — byte-identical to a headerless strip (regression guard)', () => {
    const { el } = makeStream()
    expect(el.querySelector('[data-part="header"]')).toBeNull()
    el.appendEntry({ key: 'a', status: 'active', label: 'x' })
    el.finalize()
    expect(el.querySelector('[data-part="header"]'), 'no header DOM ever appears when header is unset').toBeNull()
    el.remove()
  })

  it('header:true shows the label VISIBLY (today aria-only) + an overall-status marker', async () => {
    const { el } = await makeHeaderStream('Agent activity')
    expect(el.querySelector('[data-part="header"]')).not.toBeNull()
    expect(el.querySelector('[data-part="header-label"]')?.textContent).toBe('Agent activity')
    expect(el.querySelector('[data-part="header-marker"]')).not.toBeNull()
    el.remove()
  })

  it('an EMPTY un-finalized header reads WORKING (active) from construction — the blank-bubble ROOT fix', async () => {
    const { el } = await makeHeaderStream()
    expect(headerStatus(el), 'an empty un-finalized strip must read active from t=0').toBe('active')
    el.remove()
  })

  it('a mid-turn error entry flips the header to error immediately (F6 monotone-truth — error outranks active)', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'active', label: 'working' })
    expect(headerStatus(el), 'an all-active strip still reads active — escalation does NOT outrank active').toBe('active')
    el.appendEntry({ key: 'b', status: 'error', label: 'boom' })
    expect(headerStatus(el), 'a mid-turn error flips the header immediately').toBe('error')
    el.remove()
  })

  it('a mid-turn warning entry outranks active too (the header reads warning)', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'active' })
    el.appendEntry({ key: 'b', status: 'warning' })
    expect(headerStatus(el)).toBe('warning')
    el.remove()
  })

  it('a status transition via update() re-escalates the header live', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'active' })
    expect(headerStatus(el)).toBe('active')
    el.update('a', { status: 'error' })
    expect(headerStatus(el), 'update-to-error re-escalates the header').toBe('error')
    el.remove()
  })

  it('finalize() settles the header to the escalated FINAL status (all-done → done)', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'done' })
    el.appendEntry({ key: 'b', status: 'done' })
    el.finalize()
    expect(headerStatus(el)).toBe('done')
    el.remove()
  })

  it('finalize() on a TORN strip (an active entry remaining) settles to warning — the truncated entry contributes warning', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'done' })
    el.appendEntry({ key: 'b', status: 'active' }) // never resolves — the stream tears
    el.finalize()
    expect(headerStatus(el), 'a torn (truncated) entry settles the header to warning, never active').toBe('warning')
    el.remove()
  })

  it('fail() forces the header to error regardless of the entries own escalation', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'done' })
    el.fail()
    expect(headerStatus(el), 'fail() forces error even when every entry is done').toBe('error')
    el.remove()
  })

  it('toggling header off removes the header DOM entirely (back to byte-identical headerless)', async () => {
    const { el } = await makeHeaderStream()
    expect(el.querySelector('[data-part="header"]')).not.toBeNull()
    el.header = false
    await whenFlushed()
    expect(el.querySelector('[data-part="header"]'), 'header DOM must be gone when the prop is unset').toBeNull()
    el.remove()
  })

  it('the label prop updates the visible header text reactively', async () => {
    const { el } = await makeHeaderStream('first')
    expect(el.querySelector('[data-part="header-label"]')?.textContent).toBe('first')
    el.label = 'second'
    await whenFlushed()
    expect(el.querySelector('[data-part="header-label"]')?.textContent).toBe('second')
    el.remove()
  })
})

// ── ADR-0146 F5 — grouped entries (the ADR-0143 nested-slot mechanism, reused, never duplicated) ──────────

describe('ui-status-stream — grouped entries via StatusEntry.parent (ADR-0146 F5)', () => {
  it('appendEntry({parent}) nests the child INSIDE a nested <ui-timeline> mounted in the parent item\'s [data-role="nested"] slot', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', status: 'active', label: 'Reasoning' })
    const child = el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step 1' })
    // the child is a descendant of the group item, inside a nested ui-timeline (ADR-0143's slot) — NOT a top-level sibling
    expect(group.contains(child)).toBe(true)
    expect(child.closest('ui-timeline')).not.toBeNull()
    expect(el.querySelectorAll(':scope > ui-timeline-item')).toHaveLength(1) // only the group is a direct strip child
    // the nested host lives inside the parent's shared disclosure (ADR-0143 F1/F2), never a bespoke container
    expect(group.querySelector('[data-part="detail"] ui-timeline')).not.toBeNull()
    el.remove()
  })

  it('the nested <ui-timeline> is created LAZILY, ONCE per parent — a second grouped child reuses the SAME nested host', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'g', label: 'group' })
    const c1 = el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step 1' })
    const c2 = el.appendEntry({ key: 'c2', parent: 'g', status: 'pending', label: 'step 2' })
    const nestedTimelines = el.querySelectorAll('ui-timeline')
    expect(nestedTimelines).toHaveLength(1) // ONE nested host for the group, not one per child
    expect(c1.closest('ui-timeline')).toBe(nestedTimelines[0])
    expect(c2.closest('ui-timeline')).toBe(nestedTimelines[0])
    el.remove()
  })

  it('the keyed registry stays FLAT — update(childKey, patch) reaches the nested entry identically', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'g', label: 'group' })
    const child = el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step' })
    el.update('c1', { status: 'done', label: 'step done' })
    expect(child.status).toBe('done')
    expect(child.label).toBe('step done')
    el.remove()
  })

  it('finalize() truncation reaches nested pending/active entries (fail-closed through the group)', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'g', label: 'group' })
    const child = el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step' })
    const spy = vi.spyOn(child, 'markTruncated')
    el.finalize()
    expect(spy).toHaveBeenCalledWith(true) // a still-active NESTED entry is truncated, never left "still working"
    el.remove()
  })

  it('an UNKNOWN parent key degrades to a flat top-level append — never a throw, no orphaned child', () => {
    const { el } = makeStream()
    let child: UITimelineItemElement | undefined
    expect(() => {
      child = el.appendEntry({ key: 'c1', parent: 'nonexistent', status: 'active', label: 'orphan' })
    }).not.toThrow()
    expect(child!.parentElement).toBe(el) // appended flat at the strip level (graceful fallback)
    expect(el.querySelectorAll(':scope > ui-timeline-item')).toHaveLength(1)
    el.remove()
  })

  it('a SELF-referencing parent (entry.key === entry.parent) degrades to a flat top-level append — never a throw', () => {
    const { el } = makeStream()
    let self: UITimelineItemElement | undefined
    expect(() => {
      self = el.appendEntry({ key: 'x', parent: 'x', status: 'active', label: 'self-parent' })
    }).not.toThrow()
    expect(self!.parentElement).toBe(el) // the not-yet-connected item can never be its own parent
    expect(el.querySelectorAll(':scope > ui-timeline-item')).toHaveLength(1)
    el.remove()
  })

  it('the nested group host is a real <ui-timeline> (role=list) inside the outer role=log — one live region, no bespoke aria-live', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'g', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step' })
    const nested = el.querySelector('ui-timeline') as UITimelineElement
    expect(nested).not.toBeNull()
    // @ts-expect-error — internals is protected; the probe asserts the nested host is role=list, NOT a second live region
    expect(nested.internals.role).toBe('list')
    expect(nested.hasAttribute('aria-live')).toBe(false) // no bespoke live-region on the nested host — the outer log is the sole announcer
    el.remove()
  })
})

// ── ADR-0146 F6 — worst-child-wins status escalation (mediated through the host's own calls, no observer) ──

describe('ui-status-stream — worst-child-wins group escalation (ADR-0146 F6)', () => {
  it('a group with children [done, warning] reads `warning` (warning outranks done)', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'done' })
    el.appendEntry({ key: 'c2', parent: 'g', status: 'warning' })
    expect(group.status).toBe('warning')
    el.remove()
  })

  it('a group with children [active, error] reads `error` — the error-beats-active case asserted explicitly', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active' })
    el.appendEntry({ key: 'c2', parent: 'g', status: 'error' })
    expect(group.status).toBe('error') // the truth that something already failed outranks "still working"
    el.remove()
  })

  it('neutral "" children contribute nothing to the escalation', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: '' })
    el.appendEntry({ key: 'c2', parent: 'g', status: 'pending' })
    expect(group.status).toBe('pending') // '' is rank 0 — pending wins
    el.remove()
  })

  it('escalation recomputes LIVE on a child status change (update), monotone-truthful as children settle', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active' })
    expect(group.status).toBe('active')
    el.update('c1', { status: 'warning' })
    expect(group.status).toBe('warning') // recomputed live from the child's new status
    el.appendEntry({ key: 'c2', parent: 'g', status: 'error' })
    expect(group.status).toBe('error') // a later error outranks the warning — never reads calmer than the worst child
    el.remove()
  })

  it('escalation BUBBLES through nested groups — a deep grandchild error escalates both its group and the enclosing group', () => {
    const { el } = makeStream()
    const outer = el.appendEntry({ key: 'g', status: 'active', label: 'outer' })
    const inner = el.appendEntry({ key: 'gi', parent: 'g', status: 'active', label: 'inner group' })
    el.appendEntry({ key: 'leaf', parent: 'gi', status: 'error', label: 'boom' })
    expect(inner.status).toBe('error') // the inner group escalates to its worst child
    expect(outer.status).toBe('error') // and it bubbles to the outer group (monotone-truth up the chain)
    el.remove()
  })
})

describe('ui-status-stream — a mid-turn NESTED child escalation flips the pinned header (ADR-0146 F8 × F6)', () => {
  it('an error on a nested child escalates its group to error, which the header (escalating over top-level entries) reflects immediately', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'g', status: 'active', label: 'Reasoning' })
    expect(headerStatus(el), 'an all-active strip reads active').toBe('active')
    el.appendEntry({ key: 'c1', parent: 'g', status: 'error', label: 'sub-step failed' })
    expect(headerStatus(el), 'a nested-child error escalates the group, and the header flips to error').toBe('error')
    el.remove()
  })

  it('an update() to error on an already-nested child flips the header live too', async () => {
    const { el } = await makeHeaderStream()
    el.appendEntry({ key: 'g', status: 'active', label: 'Reasoning' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'working' })
    expect(headerStatus(el)).toBe('active')
    el.update('c1', { status: 'error' })
    expect(headerStatus(el), 'a nested-child update-to-error re-escalates the group + header').toBe('error')
    el.remove()
  })
})

describe('ui-status-stream — no transport of its own (appendEntry/update never throw in jsdom, where scrollIntoView is absent)', () => {
  it('appendEntry + update never throw even though scrollIntoView does not exist in this test environment', () => {
    const { el } = makeStream()
    expect(() => el.appendEntry({ key: 'a', status: 'active', label: 'x' })).not.toThrow()
    expect(() => el.update('a', { status: 'done' })).not.toThrow()
    el.remove()
  })
})
