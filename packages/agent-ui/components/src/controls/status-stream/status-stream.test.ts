import { describe, it, expect, vi, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIStatusStreamElement, escalateStatus, formatElapsed, formatTotalElapsed, HEADER_STATUS_GLYPH, type ItemStatus } from './status-stream.ts'
import { UITimelineItemElement } from '../timeline-item/timeline-item.ts'
import { UITimelineElement } from '../timeline/timeline.ts'

// jsdom has real setTimeout/clearInterval, so the Fork 1 ticking-interval mechanism is pinned directly
// here (vi.useFakeTimers, the toast.test.ts precedent) — the REAL cross-engine, real-wall-clock proof is
// status-stream.browser.test.ts's.
afterEach(() => {
  vi.useRealTimers()
})

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

  it('issue #26 — finalize() re-escalates a GROUP parent, not just the stream header, accounting for truncation', () => {
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', status: 'active', label: 'group' })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'still working' })
    expect(group.status).toBe('active')
    el.finalize() // truncates the still-active child — its EFFECTIVE status becomes 'warning'
    expect(group.status).toBe('warning') // the group parent must reflect that, not stay frozen at 'active'
    el.remove()
  })

  it('issue #27 — a duplicate-keyed re-append that wires a cycle into #parentOf terminates instead of hanging', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'a', label: 'a' })
    el.appendEntry({ key: 'b', parent: 'a', label: 'b' })
    // Re-appending 'a' with parent 'b' would have wired #parentOf to a -> b -> a — a genuine cycle in the
    // ancestor registry — before the #37 duplicate-key guard rejected the re-append outright. Kept as a
    // belt-and-suspenders regression: even if the #37 guard were ever removed, an unguarded #recomputeGroups
    // walk must terminate rather than hang the main thread.
    expect(() => {
      el.appendEntry({ key: 'a', parent: 'b', label: 'a again' })
    }).not.toThrow()
    el.remove()
  })

  it('issue #37 — a duplicate-keyed re-append never leaves two live elements for the same key', () => {
    const { el } = makeStream()
    const first = el.appendEntry({ key: 'a', label: 'a' })
    el.appendEntry({ key: 'b', parent: 'a', label: 'b' })
    // The exact #37 repro: re-append 'a', now naming the already-nested 'b' as its parent.
    const dup = el.appendEntry({ key: 'a', parent: 'b', label: 'a again' })

    expect(dup).toBe(first) // the duplicate call is rejected — it returns the EXISTING item, not a new one
    expect(first.label).toBe('a') // untouched — the duplicate call's fields are fully ignored, not partially applied

    const topLevel = el.querySelectorAll(':scope > ui-timeline-item')
    expect(topLevel).toHaveLength(1) // only ONE live top-level element for key 'a' — never an orphaned second
    expect(topLevel[0]).toBe(first)

    // The registry still points at the ORIGINAL item — update('a', …) reaches the one visible element.
    el.update('a', { status: 'done' })
    expect(first.status).toBe('done')
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

// ── GH #147/ADR-0153 Fork 1 — formatElapsed, the pure duration-formatter ────────────────────────────────

describe('formatElapsed — the pure ms → short-duration formatter (32s/8s Figma shape)', () => {
  it('under a minute reads bare seconds', () => {
    expect(formatElapsed(0)).toBe('0s')
    expect(formatElapsed(32000)).toBe('32s')
    expect(formatElapsed(8000)).toBe('8s')
  })

  it('rounds to the nearest second', () => {
    expect(formatElapsed(500)).toBe('1s') // rounds up
    expect(formatElapsed(499)).toBe('0s') // rounds down
  })

  it('at/past a minute reads `{m}m {s}s`', () => {
    expect(formatElapsed(59999)).toBe('1m 0s') // rounds to 60s exactly, so it crosses into minutes
    expect(formatElapsed(72000)).toBe('1m 12s')
    expect(formatElapsed(125000)).toBe('2m 5s')
  })

  it('clamps a negative duration to 0 (never a negative display)', () => {
    expect(formatElapsed(-500)).toBe('0s')
  })
})

// ── GH #147/ADR-0153 Fork 3 — HEADER_STATUS_GLYPH's own pending entry (a direct object-shape check; see
// its own in-file comment for why this specific member is not reachable through a live #overallStatus()
// call, unlike timeline-item.ts's GROUP_STATUS_GLYPH.pending, which IS live-tested via a real group) ─────

describe('HEADER_STATUS_GLYPH — closes the pending glyph gap (GH #147/ADR-0153 Fork 3)', () => {
  it('maps pending to clock, alongside the pre-existing done/error/warning', () => {
    expect(HEADER_STATUS_GLYPH).toEqual({ pending: 'clock', done: 'check', error: 'x', warning: 'warning' })
  })
})

// ── GH #147/ADR-0153 Fork 1 — the elapsed-timer ticking display (fake timers, the toast.test.ts precedent) ─

describe('ui-status-stream — startedAt ticks a live elapsed display into the timestamp cell while active', () => {
  it('ticks "1s", "2s"… once per second for a top-level active entry, and freezes the instant it resolves', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el } = makeStream()
    const item = el.appendEntry({ key: 't1', status: 'active', label: 'Working', startedAt: now.toISOString() })

    expect(item.timestamp, 'painted immediately on append, not after the first full interval').toBe('0s')
    vi.advanceTimersByTime(1000)
    expect(item.timestamp).toBe('1s')
    vi.advanceTimersByTime(2000)
    expect(item.timestamp).toBe('3s')

    el.update('t1', { status: 'done' }) // resolves — ticking must stop
    const frozenAt = item.timestamp
    vi.advanceTimersByTime(10000)
    expect(item.timestamp, 'frozen at resolution — never keeps counting past done').toBe(frozenAt)
    el.remove()
  })

  it('a GROUP header ticks while ANY child is active (the escalated .status), and freezes once the group resolves', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el } = makeStream()
    const group = el.appendEntry({ key: 'g', status: 'active', label: 'Task Group', startedAt: now.toISOString() })
    el.appendEntry({ key: 'c1', parent: 'g', status: 'active', label: 'step 1' })

    vi.advanceTimersByTime(5000)
    expect(group.timestamp).toBe('5s')

    el.update('c1', { status: 'done' }) // the group's OWN escalated status resolves to done too (worst-child)
    const frozenAt = group.timestamp
    vi.advanceTimersByTime(5000)
    expect(group.timestamp, 'the group froze the instant its escalation left active').toBe(frozenAt)
    el.remove()
  })

  it('finalize() force-stops every ticking display, even one whose raw .status prop still reads active (truncation is a custom state, not a status write)', () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-20T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el } = makeStream()
    const item = el.appendEntry({ key: 't1', status: 'active', label: 'Working', startedAt: now.toISOString() })
    vi.advanceTimersByTime(4000)
    expect(item.timestamp).toBe('4s')

    el.finalize()
    const frozenAt = item.timestamp
    vi.advanceTimersByTime(20000)
    expect(item.timestamp, 'finalize() freezes the display outright, regardless of the truncated item\'s raw .status').toBe(frozenAt)
    el.remove()
  })

  it('an unparsable startedAt is tolerated — never ticks, never throws', () => {
    vi.useFakeTimers()
    const { el } = makeStream()
    expect(() => el.appendEntry({ key: 't1', status: 'active', label: 'x', startedAt: 'not-a-date' })).not.toThrow()
    const item = el.querySelector('[data-key="t1"]') as UITimelineItemElement
    expect(item.timestamp).toBe('') // never painted — an unparsable anchor is skipped, not a throw
    vi.advanceTimersByTime(5000)
    expect(item.timestamp).toBe('')
    el.remove()
  })

  it('an entry with no startedAt never ticks (the ticking mechanism is fully opt-in)', () => {
    vi.useFakeTimers()
    const { el } = makeStream()
    const item = el.appendEntry({ key: 't1', status: 'active', label: 'x', timestamp: 'author-set' })
    vi.advanceTimersByTime(5000)
    expect(item.timestamp, 'a plain author-set timestamp is never touched by the ticking mechanism').toBe('author-set')
    el.remove()
  })
})

// ── GH #147/ADR-0153 Fork 2 — the inline retry/action affordance ───────────────────────────────────────────

describe('ui-status-stream — StatusEntry.action renders a <ui-button> in [data-role="action"] while status is error', () => {
  it('an error entry with `action` renders a labelled ui-button; a click emits `action` on the STREAM host with { key }', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'error', label: 'Patch step', description: 'Merge conflict', action: { label: 'Retry' } })

    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    const cell = item.querySelector(':scope > [data-role="action"]') as HTMLElement
    expect(cell, 'the action cell exists on an error entry carrying action').not.toBeNull()
    const button = cell.querySelector('ui-button') as HTMLElement
    expect(button).not.toBeNull()
    expect(button.textContent).toBe('Retry')

    let detail: { key: string } | undefined
    el.addEventListener('action', (e) => {
      detail = (e as CustomEvent<{ key: string }>).detail
    })
    button.dispatchEvent(new Event('click', { bubbles: true }))
    expect(detail).toEqual({ key: 'r1' })
    el.remove()
  })

  it('an active (non-error) entry with `action` renders NO button — shown only while status is error', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'active', label: 'Working', action: { label: 'Retry' } })
    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    expect(item.querySelector(':scope > [data-role="action"]')).toBeNull()
    el.remove()
  })

  it('an entry with no `action` never grows an action cell, even on error', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'error', label: 'Failed' })
    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    expect(item.querySelector(':scope > [data-role="action"]')).toBeNull()
    el.remove()
  })

  it('update() can arm `action` on an already-appended error entry — the button appears live', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'error', label: 'Failed' })
    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    expect(item.querySelector(':scope > [data-role="action"]')).toBeNull()

    el.update('r1', { action: { label: 'Retry' } })
    expect(item.querySelector(':scope > [data-role="action"] ui-button')?.textContent).toBe('Retry')
    el.remove()
  })

  it('a consumer-driven retry (status flips back to active via update) removes the button — the component itself never re-runs anything', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'error', label: 'Failed', action: { label: 'Retry' } })
    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    expect(item.querySelector(':scope > [data-role="action"]')).not.toBeNull()

    el.update('r1', { status: 'active', description: 'Retrying…' }) // the CONSUMER'S OWN doing, never automatic
    expect(item.querySelector(':scope > [data-role="action"]'), 'the button hides once status leaves error').toBeNull()
    el.remove()
  })

  it('an unrelated update (description only) does not disturb an already-shown action button', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'r1', status: 'error', label: 'Failed', action: { label: 'Retry' } })
    el.update('r1', { description: 'more detail' })
    const item = el.querySelector('[data-key="r1"]') as UITimelineItemElement
    expect(item.querySelector(':scope > [data-role="action"] ui-button')?.textContent).toBe('Retry')
    el.remove()
  })
})

// ── GH #238/#239/ADR-0159 — the receipt pattern (oneline + receipt, both OPT-IN) ──────────────────────────

describe('formatTotalElapsed — the receipt total (GH #239/ADR-0159)', () => {
  it('keeps one decimal under ten seconds (the "3.2s" receipt shape) and clamps negatives to 0.0s', () => {
    expect(formatTotalElapsed(3200)).toBe('3.2s')
    expect(formatTotalElapsed(0)).toBe('0.0s')
    expect(formatTotalElapsed(-50)).toBe('0.0s')
    expect(formatTotalElapsed(9949)).toBe('9.9s')
  })

  it('delegates to formatElapsed at/past ten seconds — ONE display vocabulary with the ticking entries', () => {
    expect(formatTotalElapsed(10_000)).toBe(formatElapsed(10_000))
    expect(formatTotalElapsed(32_000)).toBe('32s')
    expect(formatTotalElapsed(72_000)).toBe('1m 12s')
  })
})

/** A stream with the receipt-pattern opt-ins already materialized (the effect runs on connect, flushed). */
async function makeReceiptStream(opts: { oneline?: boolean; receipt?: boolean; label?: string }): Promise<{
  el: UIStatusStreamElement
  header: () => HTMLElement | null
  labelCell: () => HTMLElement | null
  meta: () => HTMLElement | null
}> {
  const el = document.createElement('ui-status-stream') as UIStatusStreamElement
  el.label = opts.label ?? 'Agent activity'
  if (opts.oneline) el.oneline = true
  if (opts.receipt) el.receipt = true
  document.body.append(el)
  await whenFlushed()
  return {
    el,
    header: () => el.querySelector('[data-part="header"]'),
    labelCell: () => el.querySelector('[data-part="header-label"]'),
    meta: () => el.querySelector('[data-part="header-meta"]'),
  }
}

describe('ui-status-stream — the opt-in default-off guarantee (GH #239: absent props ⇒ byte-identical)', () => {
  it('a default stream renders NO header, NO meta/caret cells, NO disclosure semantics', () => {
    const { el } = makeStream()
    el.appendEntry({ key: 'a', status: 'active', label: 'Working…' })
    expect(el.querySelector('[data-part="header"]')).toBeNull()
    expect(el.querySelector('[data-part="header-meta"]')).toBeNull()
    expect(el.querySelector('[data-part="header-caret"]')).toBeNull()
    el.remove()
  })

  it('a header-prop-only stream keeps its F8 shape byte-identically: marker + label, no role/tabindex/aria-expanded, no meta/caret', async () => {
    const { el, header } = await makeHeaderStream()
    el.appendEntry({ key: 'a', status: 'active', label: 'Working…' })
    const h = header()!
    expect(h.hasAttribute('role')).toBe(false)
    expect(h.hasAttribute('tabindex')).toBe(false)
    expect(h.hasAttribute('aria-expanded')).toBe(false)
    expect([...h.children].map((c) => c.getAttribute('data-part'))).toEqual(['header-marker', 'header-label'])
    // and clicking the header does nothing observable — no state, no attribute change
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.hasAttribute('aria-expanded')).toBe(false)
    el.remove()
  })
})

describe('ui-status-stream — oneline: the LIVE one-morphing-line mode (GH #239/ADR-0159)', () => {
  it('materializes the header row even when `header` is false, as a real collapsed disclosure (role=button, tabindex=0, aria-expanded=false)', async () => {
    const { el, header } = await makeReceiptStream({ oneline: true })
    const h = header()
    expect(h, 'oneline materializes the header row — it IS the one line').not.toBeNull()
    expect(h!.getAttribute('role')).toBe('button')
    expect(h!.getAttribute('tabindex')).toBe('0')
    expect(h!.getAttribute('aria-expanded'), 'starts collapsed while live').toBe('false')
    expect(el.querySelector('[data-part="header-caret"]'), 'the expand affordance exists').not.toBeNull()
    el.remove()
  })

  it('the line MORPHS: it shows the current active step\'s live label, following each transition, and never creates new label nodes (the no-double-fire discipline)', async () => {
    const { el, labelCell } = await makeReceiptStream({ oneline: true })
    const cell = labelCell()!
    expect(cell.textContent, 'no entry yet — the static label').toBe('Agent activity')

    el.appendEntry({ key: 's1', status: 'active', label: 'Validating…' })
    expect(cell.textContent).toBe('Validating…')

    el.update('s1', { status: 'done', label: 'Validated' })
    el.appendEntry({ key: 's2', status: 'active', label: 'Opening a new surface…' })
    expect(cell.textContent, 'morphs to the newest active step').toBe('Opening a new surface…')

    expect(labelCell(), 'the SAME cell node throughout — textContent mutations only, which role=log additions-relevance never announces').toBe(cell)
    el.remove()
  })

  it('click expands mid-turn (aria-expanded=true) and a second click collapses again; Enter and Space work on the focused header row', async () => {
    const { el, header } = await makeReceiptStream({ oneline: true })
    el.appendEntry({ key: 's1', status: 'active', label: 'Working…' })
    const h = header()!
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.getAttribute('aria-expanded'), 'click expands the full step list while still running').toBe('true')
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.getAttribute('aria-expanded')).toBe('false')

    h.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(h.getAttribute('aria-expanded'), 'Enter toggles').toBe('true')
    h.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(h.getAttribute('aria-expanded'), 'Space toggles').toBe('false')
    el.remove()
  })

  it('the meta cell ticks the TURN elapsed (anchored at the first appendEntry) once per second, sharing the ADR-0153 interval', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-23T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el, meta } = await makeReceiptStream({ oneline: true })
    expect(meta()!.textContent, 'no entry yet — no clock (never fabricated)').toBe('')

    el.appendEntry({ key: 's1', status: 'active', label: 'Working…' })
    expect(meta()!.textContent, 'painted immediately at the anchor').toBe('0s')
    vi.advanceTimersByTime(2000)
    expect(meta()!.textContent).toBe('2s')
    el.remove()
  })

  it('a settled oneline stream WITHOUT receipt auto-EXPANDS (the always-expanded terminal shape)', async () => {
    const { el, header } = await makeReceiptStream({ oneline: true })
    el.appendEntry({ key: 's1', status: 'active', label: 'Working…' })
    expect(header()!.getAttribute('aria-expanded')).toBe('false')
    el.finalize()
    expect(header()!.getAttribute('aria-expanded'), 'no receipt ⇒ the settled trace expands').toBe('true')
    el.remove()
  })

  it('a user\'s explicit mid-turn expand is respected — later entries never yank it shut', async () => {
    const { el, header } = await makeReceiptStream({ oneline: true })
    el.appendEntry({ key: 's1', status: 'active', label: 'Working…' })
    const h = header()!
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.getAttribute('aria-expanded')).toBe('true')
    el.appendEntry({ key: 's2', status: 'active', label: 'Next step…' })
    el.update('s2', { status: 'done' })
    expect(h.getAttribute('aria-expanded'), 'stays expanded through appends/updates').toBe('true')
    el.remove()
  })
})

describe('ui-status-stream — receipt: the TERMINAL one-line receipt (GH #239/ADR-0159)', () => {
  it('stays expanded while live (no oneline), then finalize() auto-collapses to label + "N steps · total" + the settled glyph', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-23T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el, header, labelCell, meta } = await makeReceiptStream({ receipt: true })
    const h = header()!
    expect(h.getAttribute('aria-expanded'), 'receipt-only: live phase stays expanded').toBe('true')

    el.appendEntry({ key: 's1', status: 'active', label: 'Validating…' })
    el.update('s1', { status: 'done', label: 'Validated' })
    el.appendEntry({ key: 's2', status: 'active', label: 'Opening a new surface…' })
    el.update('s2', { status: 'done', label: 'Opened a new surface' })
    vi.advanceTimersByTime(3200)
    el.finalize()

    expect(h.getAttribute('aria-expanded'), 'terminal auto-collapse').toBe('false')
    expect(labelCell()!.textContent, 'the receipt line reads the static label, not a step label').toBe('Agent activity')
    expect(meta()!.textContent, 'step count + total elapsed, from the real turn clock').toBe('2 steps · 3.2s')
    expect(h.getAttribute('data-status'), 'the settled outcome glyph state').toBe('done')
    el.remove()
  })

  it('click re-expands the settled trace (and collapses it again) — the receipt is a real disclosure', async () => {
    const { el, header } = await makeReceiptStream({ receipt: true })
    el.appendEntry({ key: 's1', status: 'done', label: 'Validated' })
    el.finalize()
    const h = header()!
    expect(h.getAttribute('aria-expanded')).toBe('false')
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.getAttribute('aria-expanded'), 'the full trace re-opens').toBe('true')
    h.dispatchEvent(new Event('click', { bubbles: true }))
    expect(h.getAttribute('aria-expanded')).toBe('false')
    el.remove()
  })

  it('fail() collapses to a LOUD receipt — the header keeps its forced error state', async () => {
    const { el, header } = await makeReceiptStream({ receipt: true })
    el.appendEntry({ key: 's1', status: 'active', label: 'Working…' })
    el.fail()
    const h = header()!
    expect(h.getAttribute('aria-expanded')).toBe('false')
    expect(h.getAttribute('data-status'), 'error stays loud on the receipt line').toBe('error')
    el.remove()
  })

  it('a single step reads the singular "1 step · …"; an empty settled stream shows no fabricated count', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T00:00:00.000Z'))
    const { el, meta } = await makeReceiptStream({ receipt: true })
    el.appendEntry({ key: 'only', status: 'done', label: 'Validated' })
    vi.advanceTimersByTime(500)
    el.finalize()
    expect(meta()!.textContent).toBe('1 step · 0.5s')
    el.remove()

    const empty = await makeReceiptStream({ receipt: true })
    empty.el.finalize()
    expect(empty.meta()!.textContent, 'zero entries ⇒ an empty meta, never "0 steps" of invented work').toBe('')
    empty.el.remove()
  })

  it('oneline + receipt together: collapsed while live (morphing), collapsed at terminal (receipt) — the full claude.ai arc', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T00:00:00.000Z'))
    const { el, header, labelCell, meta } = await makeReceiptStream({ oneline: true, receipt: true })
    const h = header()!
    expect(h.getAttribute('aria-expanded')).toBe('false')
    el.appendEntry({ key: 's1', status: 'active', label: 'Validating…' })
    expect(labelCell()!.textContent).toBe('Validating…')
    vi.advanceTimersByTime(1000)
    expect(meta()!.textContent).toBe('1s')

    el.update('s1', { status: 'done', label: 'Validated' })
    el.finalize()
    expect(h.getAttribute('aria-expanded'), 'still one line — now the receipt').toBe('false')
    expect(labelCell()!.textContent).toBe('Agent activity')
    expect(meta()!.textContent).toBe('1 step · 1.0s')
    el.remove()
  })

  it('the ADR-0153 per-entry ticking and the SPEC-R12 no-event law are unbroken in receipt mode', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-07-23T00:00:00.000Z')
    vi.setSystemTime(now)
    const { el } = await makeReceiptStream({ oneline: true, receipt: true })
    let events = 0
    for (const type of ['toggle', 'change', 'input', 'select', 'open', 'close']) el.addEventListener(type, () => events++)
    const item = el.appendEntry({ key: 't1', status: 'active', label: 'Working', startedAt: now.toISOString() })
    vi.advanceTimersByTime(2000)
    expect(item.timestamp, 'the ADR-0153 entry timer still ticks under the opt-in modes').toBe('2s')
    el.finalize()
    const frozen = item.timestamp
    vi.advanceTimersByTime(5000)
    expect(item.timestamp, 'still freezes at settle').toBe(frozen)
    expect(events, 'collapse/expand emits nothing — the closed event vocabulary is untouched').toBe(0)
    el.remove()
  })
})
