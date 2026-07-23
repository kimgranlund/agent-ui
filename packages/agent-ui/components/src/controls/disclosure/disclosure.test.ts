import { describe, it, expect } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { UIDisclosureElement } from './disclosure.ts'

// content-family M1-a — UIDisclosureElement jsdom behaviour probes (content-family.lld.md LLD-C8/C10;
// SPEC-R14…R18; ADR-0113 cl.4). jsdom reality (verified against the installed jsdom, 2026-07-09):
// <details>/<summary> are FULLY live here — a real `_activationBehavior` flips the `open` attribute on a
// `<summary>` click (jsdom's HTMLElement-impl.js), and the platform schedules the `toggle` event via a
// REAL macrotask (`setTimeout(fn, 0)` in HTMLDetailsElement-impl.js — NOT a microtask). So these tests
// drive the REAL platform surface (no stub, unlike ui-modal's <dialog>) and await the queued toggle task
// with `await new Promise((r) => setTimeout(r, 0))` — the fleet's own idiom for a queued platform toggle
// task (select/menu/popover/combo-box browser tests). The one jsdom gap this file does NOT attempt:
// find-in-page auto-expand (SPEC-R15 AC4) — that is disclosure.browser.test.ts's Chromium leg /
// WebKit structural probe (the instrument-bridge pattern; no jsdom substitute exists for a UA text search).

const nextToggle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

function makeDisclosure(markup = ''): { el: UIDisclosureElement; details: HTMLDetailsElement; summary: HTMLElement } {
  const el = document.createElement('ui-disclosure') as UIDisclosureElement
  if (markup) el.innerHTML = markup
  document.body.append(el)
  const details = el.querySelector('[data-part="details"]') as HTMLDetailsElement
  const summary = el.querySelector('[data-part="summary"]') as HTMLElement
  return { el, details, summary }
}

// ── upgrade + the typed prop surface ────────────────────────────────────────────────────────────────────

describe('ui-disclosure — upgrade + typed prop surface', () => {
  it('upgrades to the class with open/summary at their defaults', () => {
    const el = document.createElement('ui-disclosure') as UIDisclosureElement
    expect(el).toBeInstanceOf(UIDisclosureElement)
    expect(el.open).toBe(false)
    expect(el.summary).toBe('')
  })

  it('typed: open is boolean, summary is string (compile-time negative control)', () => {
    const fn = (): void => {
      const el = new UIDisclosureElement()
      el.open = true
      el.summary = 'Details'
      // @ts-expect-error — open is boolean, not string
      el.open = 'yes'
      // @ts-expect-error — summary is string, not boolean
      el.summary = true
    }
    expect(typeof fn).toBe('function') // never invoked; the type errors above are the assertion
  })

  it('self-defines ui-disclosure, guarded against a double-define', () => {
    expect(customElements.get('ui-disclosure')).toBe(UIDisclosureElement)
    expect(() => {
      if (!customElements.get('ui-disclosure')) customElements.define('ui-disclosure', UIDisclosureElement)
    }).not.toThrow()
  })
})

// ── anatomy — the control-owned parts + the children-become-body invariant ─────────────────────────────

describe('ui-disclosure — anatomy (children adopt into the body part)', () => {
  it('creates <details><summary>[chevron, summary-text]</summary><div data-part=body></div></details>; the host carries no role/aria-* attribute', () => {
    const { el, details, summary } = makeDisclosure()
    expect(details).not.toBeNull()
    expect(details.tagName.toLowerCase()).toBe('details')
    expect(summary.tagName.toLowerCase()).toBe('summary')
    expect(summary.querySelector('[data-part="chevron"]')).not.toBeNull()
    expect(summary.querySelector('[data-part="summary-text"]')).not.toBeNull()
    expect(details.querySelector('[data-part="body"]')).not.toBeNull()
    // SPEC-R17 — no internals role, no host ARIA (the native details/summary carry all semantics)
    expect(el.hasAttribute('role')).toBe(false)
    for (const attr of Array.from(el.attributes)) expect(attr.name.startsWith('aria-')).toBe(false)
    el.remove()
  })

  it('the chevron is aria-hidden (decorative — disclosure meaning rides the native part, never the glyph)', () => {
    const { summary } = makeDisclosure()
    expect(summary.querySelector('[data-part="chevron"]')?.getAttribute('aria-hidden')).toBe('true')
    summary.closest('ui-disclosure')?.remove()
  })

  it('render() stays void — the details part is the host’s ONLY element child; created ONCE across reconnect', () => {
    const { el } = makeDisclosure()
    expect(el.children).toHaveLength(1)
    el.remove()
    document.body.append(el) // reconnect re-runs connected()
    expect(el.querySelectorAll('[data-part="details"]')).toHaveLength(1) // not re-created (idempotent guard)
    expect(el.children).toHaveLength(1)
    el.remove()
  })

  it('adopts pre-existing host children into the body part at connect (moved, never cloned — ADR-0022)', () => {
    const el = document.createElement('ui-disclosure') as UIDisclosureElement
    const a = document.createElement('p')
    a.id = 'a'
    a.textContent = 'Body A'
    const b = document.createElement('p')
    b.id = 'b'
    b.textContent = 'Body B'
    el.append(a, b) // pre-existing children BEFORE connect
    document.body.append(el) // connect adopts them

    const details = el.querySelector('[data-part="details"]') as HTMLDetailsElement
    const body = details.querySelector('[data-part="body"]') as HTMLElement
    // the SAME node instances moved (never cloned), order preserved
    expect(Array.from(body.children)).toEqual([a, b])
    expect(a.textContent).toBe('Body A')
    expect(b.textContent).toBe('Body B')
    el.remove()
  })

  it('the `summary` prop writes the summary-text span via textContent only (SPEC-R16 AC2) — never touches `open`', async () => {
    const { el, details } = makeDisclosure()
    el.summary = 'Full log'
    await whenFlushed()
    const summaryText = details.querySelector('[data-part="summary-text"]') as HTMLElement
    expect(summaryText.textContent).toBe('Full log')
    expect(el.open).toBe(false) // untouched
    el.remove()
  })
})

// ── open — two-way, always-announce (SPEC-R15) ─────────────────────────────────────────────────────────

describe('ui-disclosure — open is two-way under the always-announce law', () => {
  it('a user click on the summary settles open=true and fires exactly one toggle with open already true (AC1)', async () => {
    const { el, summary } = makeDisclosure()
    let toggles = 0
    let openAtEmit: boolean | null = null
    el.addEventListener('toggle', () => {
      toggles++
      openAtEmit = el.open
    })

    summary.click() // jsdom's real <summary> activation behaviour flips details.open synchronously
    await nextToggle() // the platform's queued toggle task (setTimeout(0), jsdom HTMLDetailsElement-impl.js)

    expect(el.open).toBe(true)
    expect(el.getAttribute('open')).not.toBeNull() // reflects
    expect(toggles).toBe(1)
    expect(openAtEmit).toBe(true) // settled BEFORE the listener ran (ADR-0101 mechanic 3)
    el.remove()
  })

  it('a second click closes it and fires exactly one more toggle (open=false at emit time)', async () => {
    const { el, summary } = makeDisclosure()
    summary.click()
    await nextToggle()
    expect(el.open).toBe(true)

    let toggles = 0
    let openAtEmit: boolean | null = null
    el.addEventListener('toggle', () => {
      toggles++
      openAtEmit = el.open
    })
    summary.click()
    await nextToggle()

    expect(el.open).toBe(false)
    expect(toggles).toBe(1)
    expect(openAtEmit).toBe(false)
    el.remove()
  })

  it('a model-driven write (`el.open = true`) settles the platform + fires exactly one toggle (AC2)', async () => {
    const { el, details } = makeDisclosure()
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    el.open = true
    await whenFlushed() // the model→platform effect runs
    await nextToggle() // the platform's own queued toggle task

    expect(details.open).toBe(true)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('re-asserting the current value fires NOTHING (the loop-breaker, SPEC-R15 AC2)', async () => {
    const { el } = makeDisclosure()
    el.open = true
    await whenFlushed()
    await nextToggle()

    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    el.open = true // no transition — already open (a same-value prop write, never reaches the effect)
    await whenFlushed()
    await nextToggle()
    expect(toggles).toBe(0)
    el.remove()
  })

  it('an open-on-connect disclosure opens on connect (property-wins, ADR-0005) and fires exactly ONE toggle — a DELIBERATE divergence from native `<details open>` (component-review finding, resolved): a fresh `<details>` part is created closed, and the connected() effect that syncs it to an already-true `open` prop is a genuine closed->open platform transition the sole listener announces, one time, before any consumer listener can have attached. This is consistent with ADR-0101\'s "every genuine transition, model or user driven, announces" — seeding the part open at creation was tried and does NOT suppress the event (the seed write itself is the same closed->open mutation, just performed one statement earlier; the queued `toggle` still fires once a listener exists). Native fidelity (0 toggles) is not attainable without building the part from parsed markup instead of createElement+property-set, which is out of scope for this control.', async () => {
    const el = document.createElement('ui-disclosure') as UIDisclosureElement
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)
    el.open = true // set BEFORE connect
    document.body.append(el)
    await whenFlushed()
    await nextToggle()
    const details = el.querySelector('[data-part="details"]') as HTMLDetailsElement
    expect(details.open).toBe(true)
    expect(toggles, 'open-on-connect deliberately announces exactly once (ADR-0101) — not 0 (native parity), not >1 (a loop)').toBe(1)
    el.remove()
  })
})

// ── the heal invariant (SPEC-R16) ──────────────────────────────────────────────────────────────────────

describe('ui-disclosure — the heal invariant (children streamed in / a destructive clobber)', () => {
  it('adopts a child appended to the host AFTER connect into the body part (order/identity preserved)', async () => {
    const { el, details } = makeDisclosure()
    const p = document.createElement('p')
    p.textContent = 'Streamed in'
    el.appendChild(p) // lands as a host child (mirrors parser-streamed content arriving after connect)
    await new Promise<void>((r) => queueMicrotask(r)) // let the MutationObserver callback (a microtask) run
    const body = details.querySelector('[data-part="body"]') as HTMLElement
    expect(body.contains(p)).toBe(true) // moved into the body, same node identity
    expect(el.children).toHaveLength(1) // the details part is STILL the host's only element child
    el.remove()
  })

  it('a destructive host.textContent write rebuilds the part fresh and lands the new content in the body (AC3)', async () => {
    const { el } = makeDisclosure('<p>original</p>')
    el.summary = 'Label'
    el.open = true
    await whenFlushed()
    await nextToggle()

    el.textContent = 'fresh text' // clobbers EVERY child, including the details part
    await new Promise<void>((r) => queueMicrotask(r)) // the heal observer's callback

    expect(el.children).toHaveLength(1) // rebuilt — exactly one details part again
    const details = el.querySelector('[data-part="details"]') as HTMLDetailsElement
    const body = details.querySelector('[data-part="body"]') as HTMLElement
    expect(body.textContent).toBe('fresh text') // the new content landed in the body
    // the prop-driven state re-converges onto the FRESH parts immediately (not waiting on a future prop change)
    expect(details.querySelector('[data-part="summary-text"]')?.textContent).toBe('Label')
    expect(details.open).toBe(true)
    el.remove()
  })

  it('the rebuilt details part still announces a real toggle (the re-wired listener, not a stale one)', async () => {
    const { el } = makeDisclosure('<p>original</p>')
    el.textContent = 'fresh' // triggers a rebuild
    await new Promise<void>((r) => queueMicrotask(r))

    let toggles = 0
    el.addEventListener('toggle', () => toggles++)
    const summary = el.querySelector('[data-part="summary"]') as HTMLElement
    summary.click()
    await nextToggle()

    expect(el.open).toBe(true)
    expect(toggles).toBe(1)
    el.remove()
  })
})

// ── the summary slot (ADR-0158 — SPEC-R14's foreseen extension, realized; GH #226) ─────────────────────

describe('ui-disclosure — the summary slot (ADR-0158)', () => {
  it('adopts a pre-existing slot="summary" child into the summary part (after the label), never the body', () => {
    const { el, details, summary } = makeDisclosure('<span slot="summary" id="ctl">Ctl</span><p>body</p>')
    const ctl = el.querySelector('#ctl') as HTMLElement
    const body = details.querySelector('[data-part="body"]') as HTMLElement
    expect(summary.contains(ctl)).toBe(true) // moved, never cloned (same node — ADR-0022)
    expect(body.contains(ctl)).toBe(false)
    expect(body.textContent).toBe('body') // the OTHER child still converges into the body
    // append order: chevron, label, THEN the slotted control (the label's flex-grow pushes it inline-end)
    const summaryText = summary.querySelector('[data-part="summary-text"]') as HTMLElement
    expect(ctl.previousElementSibling).toBe(summaryText)
    el.remove()
  })

  it('heals a late-arriving slot="summary" host child into the summary part (the streaming/appendChild case)', async () => {
    const { el, summary } = makeDisclosure('<p>body</p>')
    const ctl = document.createElement('span')
    ctl.setAttribute('slot', 'summary')
    ctl.textContent = 'Late'
    el.appendChild(ctl) // lands on the HOST — the heal observer's slot partition routes it
    await new Promise<void>((r) => queueMicrotask(r))
    expect(summary.contains(ctl)).toBe(true)
    expect(el.children).toHaveLength(1) // the details part stays the host's only element child
    el.remove()
  })

  it('a destructive clobber rebuild RESCUES the slotted control into the FRESH summary part — same node identity (GH #226, ADR-0158 cl.2)', async () => {
    const { el } = makeDisclosure('<span slot="summary" id="ctl">Ctl</span><p>original</p>')
    const ctl = el.querySelector('#ctl') as HTMLElement
    el.summary = 'Label'
    await whenFlushed()

    el.textContent = 'fresh text' // clobbers EVERY child, details part included — the rebuild branch
    await new Promise<void>((r) => queueMicrotask(r))

    const summary = el.querySelector('[data-part="summary"]') as HTMLElement
    expect(summary.contains(ctl)).toBe(true) // the SAME node, rescued from the detached old part
    expect(el.querySelector('[data-part="body"]')?.textContent).toBe('fresh text') // body content replaced
    expect(el.querySelector('[data-part="summary-text"]')?.textContent).toBe('Label') // the prop re-synced too
    el.remove()
  })

  it('a control the author explicitly REMOVED before the clobber stays gone (the detached part is the record — no stale tracking)', async () => {
    const { el } = makeDisclosure('<span slot="summary" id="ctl">Ctl</span><p>original</p>')
    const ctl = el.querySelector('#ctl') as HTMLElement
    ctl.remove() // the author takes the control off the heading row (a summary-part mutation — not host childList)
    el.textContent = 'fresh' // then a clobber rebuild
    await new Promise<void>((r) => queueMicrotask(r))
    expect(el.querySelector('#ctl')).toBeNull() // NOT resurrected
    el.remove()
  })

  it('a click inside a slotted control never folds — the component-owned activation guard (ADR-0158 cl.3); the summary itself still folds', async () => {
    const { el, summary } = makeDisclosure('<span slot="summary" id="ctl">Ctl</span><p>body</p>')
    const ctl = el.querySelector('#ctl') as HTMLElement
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    ctl.click() // the guard preventDefaults the summary's activation behaviour
    await nextToggle()
    expect(el.open).toBe(false)
    expect(toggles).toBe(0)

    summary.click() // the summary's own click is untouched by the guard
    await nextToggle()
    expect(el.open).toBe(true)
    expect(toggles).toBe(1)
    el.remove()
  })

  it('a NESTED ui-disclosure in the slot: clicking the INNER summary toggles the INNER fold — the guard stands down for activation-carrying content (review fix, ADR-0158 cl.3)', async () => {
    // The discriminator the review proved: a click has ONE activation target — the NEAREST activatable
    // ancestor, here the INNER summary. The unscoped first-draft guard preventDefault()ed this click and
    // cancelled exactly the inner fold's toggle (inner.open stayed false) while "protecting" an outer
    // fold that was never at risk. The scoped guard stands down instead.
    const { el: outer, summary: outerSummary } = makeDisclosure(
      '<ui-disclosure slot="summary" summary="Inner"><p>inner body</p></ui-disclosure><p>outer body</p>',
    )
    const inner = outerSummary.querySelector('ui-disclosure') as UIDisclosureElement
    expect(inner).not.toBeNull() // partitioned onto the outer summary row

    let outerToggles = 0
    outer.addEventListener('toggle', (e) => {
      if (e.target === outer) outerToggles++ // the inner fold's own toggle bubbles — count only the outer's
    })

    const innerSummary = inner.querySelector('[data-part="summary"]') as HTMLElement
    innerSummary.click() // the INNER summary is this click's activation target
    await nextToggle()

    expect(inner.open, 'the inner fold toggles — the unscoped guard cancelled exactly this').toBe(true)
    expect(outer.open, 'the outer fold stays').toBe(false)
    expect(outerToggles).toBe(0)
    outer.remove()
  })

  it('a slotted native <button>: its click runs UN-prevented (defaultPrevented false after dispatch — the button is the activation target) and the fold never toggles', async () => {
    const { el, summary } = makeDisclosure('<button slot="summary" id="act">Do</button><p>body</p>')
    const btn = el.querySelector('#act') as HTMLButtonElement
    expect(summary.contains(btn)).toBe(true)

    let captured: Event | null = null
    btn.addEventListener('click', (e) => (captured = e))
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    btn.click() // dispatch is synchronous — after this returns, the event's canceled flag is FINAL
    await nextToggle()

    expect(captured).not.toBeNull()
    expect((captured as unknown as Event).defaultPrevented, 'the guard stood down — no preventDefault reached this click').toBe(false)
    expect(el.open, 'the fold never toggles (the button, not the summary, owned the activation)').toBe(false)
    expect(toggles).toBe(0)
    el.remove()
  })

  it('the guard survives a clobber rebuild (re-wired onto the fresh summary part, like the toggle listener)', async () => {
    const { el } = makeDisclosure('<span slot="summary" id="ctl">Ctl</span><p>original</p>')
    el.textContent = 'fresh' // rebuild
    await new Promise<void>((r) => queueMicrotask(r))

    const ctl = el.querySelector('#ctl') as HTMLElement // rescued, on the fresh summary row
    let toggles = 0
    el.addEventListener('toggle', () => toggles++)
    ctl.click()
    await nextToggle()
    expect(el.open).toBe(false)
    expect(toggles).toBe(0)
    el.remove()
  })

  it('the fold\'s accessible name scopes to the summary-text part — aria-labelledby on the summary, never name-from-content over a slotted control (ADR-0158 cl.4)', () => {
    const { el, summary } = makeDisclosure('<span slot="summary">Agent active</span>')
    el.summary = 'Agent'
    const summaryText = summary.querySelector('[data-part="summary-text"]') as HTMLElement
    expect(summaryText.id).not.toBe('') // a generated, stable id
    expect(summary.getAttribute('aria-labelledby')).toBe(summaryText.id) // the name IS the label span
    expect(summaryText.contains(el.querySelector('[slot="summary"]'))).toBe(false) // the control sits OUTSIDE the name source
    el.remove()
  })
})

// ── zero residue across connect/disconnect ─────────────────────────────────────────────────────────────

describe('ui-disclosure — zero residue across connect/disconnect', () => {
  it('the toggle listener is abort-owned — it dies on disconnect and re-wires exactly once on reconnect (no stacked listener)', async () => {
    const { el, summary } = makeDisclosure()

    let toggles = 0
    el.addEventListener('toggle', () => toggles++)

    summary.click()
    await nextToggle()
    expect(toggles).toBe(1)

    el.remove() // disconnect → the observer disconnects + ac.abort() removes the toggle listener
    const detailsAfterDisconnect = el.querySelector('[data-part="details"]') as HTMLDetailsElement
    detailsAfterDisconnect.open = false // mutate directly — no listener should react (it's gone)
    await nextToggle()
    expect(toggles).toBe(1) // unchanged

    document.body.append(el) // reconnect → connected() re-runs: fresh AbortController, re-wires the listener
    const summaryAfterReconnect = el.querySelector('[data-part="summary"]') as HTMLElement
    summaryAfterReconnect.click()
    await nextToggle()
    expect(toggles).toBe(2) // exactly one MORE — not a leaked old listener stacked atop the new one
    el.remove()
  })
})
