import { describe, it, expect } from 'vitest'
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../dom/index.ts'
import { tabbable } from './tabbable.ts'
import { ROVING_ITEM_ATTR } from './roving-focus.ts'

// Phase-1 — the tabbable trait (ADR-0010). tabIndex=0 while enabled; removeAttribute('tabindex') while
// disabled (native `<button disabled>` parity); the rule rides a scope-owned `host.effect` so it REACTS to
// the disabled signal, dies with the connection scope, and re-installs on reconnect; release() is idempotent
// early teardown. Named probes: tab-default · tab-disabled-removes · tab-reactive · tab-leak-free · tab-release.
//
// The host carries `disabled` as a real signal-backed prop (not a plain field) — the trait's reactivity is
// the point, so the effect must re-run when the signal toggles.

const props = {
  disabled: prop.boolean(false),
} satisfies PropsSchema

interface TabEl extends ReactiveProps<typeof props> {}
class TabEl extends UIElement {
  static props = props
  releaseFn: (() => void) | null = null
  protected connected(): void {
    this.releaseFn = tabbable(this, { disabled: () => this.disabled })
  }
}
customElements.define('ui-tab', TabEl)

describe('tabbable — focusability + disabled tab-order (ADR-0010)', () => {
  it('tab-default: enabled host is keyboard-focusable (tabindex=0) by default', () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // role=button focus parity
    expect(el.tabIndex).toBe(0)
    el.remove()
  })

  it('tab-disabled-removes: a disabled host leaves the tab order (no tabindex attribute)', () => {
    const el = new TabEl()
    el.disabled = true
    document.body.append(el)
    expect(el.hasAttribute('tabindex')).toBe(false) // native <button disabled> parity — out of the tab order
    el.remove()
  })

  it('tab-reactive: toggling the disabled signal re-applies the rule (effect reacts)', async () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0') // enabled at connect (initial effect run is synchronous)

    el.disabled = true
    await el.updateComplete // effect re-runs are microtask-batched — wait for the flush
    expect(el.hasAttribute('tabindex')).toBe(false) // disabled → removed reactively

    el.disabled = false
    await el.updateComplete
    expect(el.getAttribute('tabindex')).toBe('0') // re-enabled → focusable again
    el.remove()
  })

  it('tab-leak-free: the effect dies on disconnect and re-installs on reconnect (no leak)', async () => {
    const el = new TabEl()
    document.body.append(el)
    el.disabled = true
    await el.updateComplete
    expect(el.hasAttribute('tabindex')).toBe(false) // effect live: disabled removed the attribute

    el.remove() // disconnect → connection scope disposed → the effect dies
    el.disabled = false // mutate the signal while disconnected
    await el.updateComplete // give any leaked effect a chance to flush
    expect(el.hasAttribute('tabindex')).toBe(false) // a leaked effect would re-add tabindex; none does → leak-free

    document.body.append(el) // reconnect → connected() re-runs → a FRESH effect installs (synchronous first run)
    expect(el.getAttribute('tabindex')).toBe('0') // re-applied from the current (enabled) signal value
    el.remove()
  })

  it('tab-release: release() detaches the effect early and is idempotent', () => {
    const el = new TabEl()
    document.body.append(el)
    expect(el.getAttribute('tabindex')).toBe('0')

    el.releaseFn?.() // early teardown
    el.releaseFn?.() // idempotent — safe to call twice (no throw)

    el.disabled = true
    expect(el.getAttribute('tabindex')).toBe('0') // released → the effect no longer reacts
    el.remove()
  })
})

// ── the ROVING-MARKER CONTRACT (ADR-0121 amendment) — tabbable.ts defers under an external roving owner ──
//
// traits/roving-focus.ts stamps ROVING_ITEM_ATTR ('data-roving') on every item it manages; this trait must
// defer its own tabIndex=0 write while that marker is present, on EVERY effect run (not just the first —
// covering a later re-enable mid-session), and stay BYTE-IDENTICAL to the pre-amendment rule whenever the
// marker is absent (the overwhelming majority of tabbable() consumers — this is the non-regression pin).

describe('tabbable — the roving-marker contract (ADR-0121 amendment)', () => {
  it('identity: a bare (never-marked) host is byte-identical to the pre-amendment rule — enabled→0, disabled→removed, reactive', async () => {
    // The exact tab-default/tab-disabled-removes/tab-reactive assertions above, replayed to pin that NO
    // marker present means NO behavior change at all.
    const a = new TabEl()
    document.body.append(a)
    expect(a.getAttribute('tabindex')).toBe('0')
    a.disabled = true
    await a.updateComplete
    expect(a.hasAttribute('tabindex')).toBe(false)
    a.disabled = false
    await a.updateComplete
    expect(a.getAttribute('tabindex')).toBe('0')
    expect(a.hasAttribute(ROVING_ITEM_ATTR)).toBe(false) // anti-vacuous — genuinely never marked
    a.remove()
  })

  it('a host carrying the roving marker never receives tabIndex=0 from this trait, even while enabled', () => {
    const el = new TabEl()
    el.setAttribute(ROVING_ITEM_ATTR, '') // simulates an external roving-focus host having claimed it
    document.body.append(el) // tabbable's synchronous first effect run happens here
    expect(el.getAttribute('tabindex')).not.toBe('0') // deferred — not the roving-focus trait's job to assert what it IS
    el.remove()
  })

  it('a re-enable WHILE still roving-owned stays deferred (no "two tab stops" regression)', async () => {
    const el = new TabEl()
    el.setAttribute(ROVING_ITEM_ATTR, '')
    el.disabled = true
    document.body.append(el)
    expect(el.hasAttribute('tabindex')).toBe(false) // disabled → removed (this trait's own concern, unaffected by the marker)

    el.disabled = false // re-enable mid-session — the effect re-runs
    await el.updateComplete
    // Still deferred: the marker is re-checked on EVERY run, not just the first, so re-enabling never
    // reclaims a tab stop the roving owner is still managing.
    expect(el.getAttribute('tabindex')).not.toBe('0')
    el.remove()
  })

  it('removing the marker (the roving host releasing ownership) is NOT this trait\'s concern — it never re-checks reactively on a plain attribute mutation (disabled must toggle to re-run)', async () => {
    // Documents the boundary precisely: tabbable's effect tracks the `disabled` SIGNAL only — a bare
    // setAttribute/removeAttribute('data-roving') is not itself reactive to this trait. The roving-focus
    // trait's own settle pass / release path is what re-asserts a correct tabindex for the item once it
    // is truly independent again (out of THIS trait's scope).
    const el = new TabEl()
    el.setAttribute(ROVING_ITEM_ATTR, '')
    document.body.append(el)
    expect(el.getAttribute('tabindex')).not.toBe('0')

    el.removeAttribute(ROVING_ITEM_ATTR)
    await el.updateComplete // no `disabled` toggle occurred — the effect never re-runs on its own
    expect(el.getAttribute('tabindex')).not.toBe('0') // unchanged — by design, not a defect
    el.remove()
  })
})
