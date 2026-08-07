import { describe, it, expect } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { selectionCommit, type SelectionMode } from './selection-commit.ts'

// LLD-C2 — the selection-commit controller (listbox-roving LLD-C2). Single/multi selection model:
// single replaces; multi plain-click replaces; Shift extends range from anchor; Ctrl/Cmd toggles
// without moving anchor. Reflects `aria-selected` on item elements (NOT the host). Emits `select`
// with the committed key(s). Enter commits the focused item. Listeners ride the connection
// AbortSignal (auto-removed on disconnect); release() is idempotent early teardown.
//
// Named probes: sel-single · sel-multi-add · sel-multi-remove · sel-shift-range · sel-ctrl-anchor ·
// sel-aria-selected · sel-event · sel-event-multi · sel-enter · sel-disabled · sel-auto-cleanup · sel-release

class SelectEl extends UIElement {
  releaseFn: (() => void) | null = null
  mode: SelectionMode = 'single'
  lastSelection: string | ReadonlySet<string> | null = null

  protected connected(): void {
    this.releaseFn = selectionCommit(this, {
      mode: this.mode,
      onSelect: (sel) => {
        this.lastSelection = sel
      },
    })
  }
}
customElements.define('ui-sel-commit', SelectEl)

// Build a connected host populated with [role=option] items bearing data-key attributes.
const makeHost = (mode: SelectionMode = 'single', keys: string[] = ['a', 'b', 'c']): SelectEl => {
  const host = new SelectEl()
  host.mode = mode
  for (const k of keys) {
    const li = document.createElement('li')
    li.setAttribute('role', 'option')
    li.dataset['key'] = k
    li.tabIndex = -1 // programmatically focusable (needed for Enter tests)
    host.append(li)
  }
  document.body.append(host)
  return host
}

// Retrieve a specific option item from the host.
const getItem = (host: SelectEl, key: string): HTMLElement =>
  host.querySelector<HTMLElement>(`[data-key="${key}"]`)!

// Dispatch a click on an element with optional Shift/Ctrl modifiers.
const click = (el: Element, mods?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): void => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...mods }))
}

// Dispatch Enter keydown from the given target (bubbles to the host).
const enter = (target: Element): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

const ariaSelected = (el: Element): string | null => el.getAttribute('aria-selected')

describe('selectionCommit — single/multi selection controller (LLD-C2)', () => {
  it('sel-single: each click replaces the selection; aria-selected follows', () => {
    const host = makeHost('single')

    click(getItem(host, 'a'))
    expect(host.lastSelection).toBe('a')
    expect(ariaSelected(getItem(host, 'a'))).toBe('true')
    expect(ariaSelected(getItem(host, 'b'))).toBe('false')
    expect(ariaSelected(getItem(host, 'c'))).toBe('false')

    click(getItem(host, 'b'))
    expect(host.lastSelection).toBe('b')
    expect(ariaSelected(getItem(host, 'a'))).toBe('false')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')

    host.remove()
  })

  it('sel-multi-add: plain click selects one; Ctrl+click adds another', () => {
    const host = makeHost('multi')

    click(getItem(host, 'a'))
    expect(host.lastSelection).toEqual(new Set(['a']))

    click(getItem(host, 'b'), { ctrlKey: true })
    expect(host.lastSelection).toEqual(new Set(['a', 'b']))
    expect(ariaSelected(getItem(host, 'a'))).toBe('true')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')
    expect(ariaSelected(getItem(host, 'c'))).toBe('false')

    host.remove()
  })

  it('sel-multi-remove: Ctrl+click a selected item removes it from the Set', () => {
    const host = makeHost('multi')

    click(getItem(host, 'a'))
    click(getItem(host, 'b'), { ctrlKey: true }) // {a, b}
    click(getItem(host, 'a'), { ctrlKey: true }) // remove a → {b}

    expect(host.lastSelection).toEqual(new Set(['b']))
    expect(ariaSelected(getItem(host, 'a'))).toBe('false')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')

    host.remove()
  })

  it('sel-shift-range: Shift+click extends selection from the anchor to the clicked item (inclusive)', () => {
    const host = makeHost('multi', ['a', 'b', 'c', 'd'])

    click(getItem(host, 'b')) // anchor = b, selected = {b}
    click(getItem(host, 'd'), { shiftKey: true }) // range b → d = {b, c, d}

    expect(host.lastSelection).toEqual(new Set(['b', 'c', 'd']))
    expect(ariaSelected(getItem(host, 'a'))).toBe('false')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')
    expect(ariaSelected(getItem(host, 'c'))).toBe('true')
    expect(ariaSelected(getItem(host, 'd'))).toBe('true')

    host.remove()
  })

  it('sel-ctrl-anchor: Ctrl toggle keeps the anchor; subsequent Shift ranges from the original anchor', () => {
    const host = makeHost('multi', ['a', 'b', 'c', 'd'])

    click(getItem(host, 'b'))                    // anchor = b, selected = {b}
    click(getItem(host, 'a'), { ctrlKey: true }) // anchor still b, selected = {b, a}
    click(getItem(host, 'd'), { shiftKey: true }) // range from anchor b to d = {b, c, d}

    expect(host.lastSelection).toEqual(new Set(['b', 'c', 'd']))

    host.remove()
  })

  it('sel-aria-selected: aria-selected is reflected on the items, never on the host', () => {
    const host = makeHost('single')

    click(getItem(host, 'b'))
    // Host carries NO aria-selected (FACE internals, never host attrs).
    expect(host.getAttribute('aria-selected')).toBeNull()
    // Items carry aria-selected.
    expect(ariaSelected(getItem(host, 'a'))).toBe('false')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')
    expect(ariaSelected(getItem(host, 'c'))).toBe('false')

    host.remove()
  })

  it('sel-event: select event fires with the committed string key in single mode', () => {
    const host = makeHost('single')
    let detail: unknown

    host.addEventListener('select', (e) => {
      detail = (e as CustomEvent).detail
    })
    click(getItem(host, 'c'))

    expect(detail).toBe('c')

    host.remove()
  })

  it('sel-event-multi: select event fires with a ReadonlySet of committed keys in multi mode', () => {
    const host = makeHost('multi')
    let detail: unknown

    host.addEventListener('select', (e) => {
      detail = (e as CustomEvent).detail
    })
    click(getItem(host, 'a'))
    click(getItem(host, 'b'), { ctrlKey: true })

    expect(detail).toEqual(new Set(['a', 'b']))

    host.remove()
  })

  it('sel-enter: Enter commits the currently focused item in single mode', () => {
    const host = makeHost('single')

    // Focus an item (tabIndex=-1 makes it programmatically focusable).
    getItem(host, 'b').focus()
    // Dispatch Enter on the host — the handler reads document.activeElement.
    enter(host)

    expect(host.lastSelection).toBe('b')
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')
    expect(ariaSelected(getItem(host, 'a'))).toBe('false')

    host.remove()
  })

  it('sel-disabled: a disabled option is non-committable via click AND Enter ([disabled] or aria-disabled)', () => {
    const host = makeHost('single')
    let selectEvents = 0
    host.addEventListener('select', () => { selectEvents += 1 })

    const b = getItem(host, 'b')
    b.setAttribute('aria-disabled', 'true') // aria-disabled path
    const c = getItem(host, 'c')
    c.setAttribute('disabled', '') // HTML [disabled] path

    // Click on a disabled option does NOT commit (no onSelect, no select event).
    click(b)
    click(c)
    expect(host.lastSelection).toBeNull()
    expect(selectEvents).toBe(0)

    // Enter on a focused disabled option does NOT commit either.
    c.focus()
    enter(host)
    expect(host.lastSelection).toBeNull()
    expect(selectEvents).toBe(0)

    // Anti-vacuous: a NON-disabled option still commits (the guard isn't blocking everything).
    click(getItem(host, 'a'))
    expect(host.lastSelection).toBe('a')
    expect(selectEvents).toBe(1)

    host.remove()
  })

  it('sel-auto-cleanup: listeners auto-remove on disconnect (ride the connection AbortSignal)', () => {
    const host = makeHost('single')

    host.remove() // disconnect → AbortSignal aborted → listeners removed
    click(getItem(host, 'a')) // no listener fires
    expect(host.lastSelection).toBeNull()
  })

  it('sel-release: release() stops selection while still connected; idempotent', () => {
    const host = makeHost('single')

    host.releaseFn?.()
    host.releaseFn?.() // idempotent — safe to call twice

    click(getItem(host, 'a'))
    expect(host.lastSelection).toBeNull()

    host.remove()
  })
})

// LLD-C4 (multi-select-field.lld.md) — 'multi-toggle' mode: every commit path (plain click AND Enter)
// unconditionally toggles, no modifier keys ever consulted. Additive-only: 'single'/'multi' regression-
// unchanged (proven above, byte-identical, untouched by this mode's addition).
describe("selectionCommit — 'multi-toggle' mode (LLD-C4)", () => {
  it('sel-multi-toggle-click: plain click with NO modifier toggles membership (never replaces)', () => {
    const host = makeHost('multi-toggle')

    click(getItem(host, 'a'))
    expect(host.lastSelection).toEqual(new Set(['a']))

    // A SECOND plain click on a DIFFERENT item ADDS it — a 'multi' plain click would have REPLACED
    // the selection with just {'b'}; 'multi-toggle' must not.
    click(getItem(host, 'b'))
    expect(host.lastSelection).toEqual(new Set(['a', 'b']))

    // A third plain click on an ALREADY-selected item removes it (toggle-off).
    click(getItem(host, 'a'))
    expect(host.lastSelection).toEqual(new Set(['b']))

    host.remove()
  })

  it('sel-multi-toggle-modifiers-ignored: Shift/Ctrl/Meta modifiers on click are ignored — every click still toggles', () => {
    const host = makeHost('multi-toggle', ['a', 'b', 'c', 'd'])

    click(getItem(host, 'a'))
    click(getItem(host, 'c'))
    expect(host.lastSelection).toEqual(new Set(['a', 'c']))

    // Shift+click on 'd' must NOT range-extend (the 'multi' mode behaviour) — it toggles 'd' on alone.
    click(getItem(host, 'd'), { shiftKey: true })
    expect(host.lastSelection).toEqual(new Set(['a', 'c', 'd']))

    // Ctrl+click on an already-selected item still just toggles it off (identical to a plain click).
    click(getItem(host, 'a'), { ctrlKey: true })
    expect(host.lastSelection).toEqual(new Set(['c', 'd']))

    host.remove()
  })

  it('sel-multi-toggle-enter: Enter on the focused option toggles membership — byte-identical outcome to click', () => {
    const host = makeHost('multi-toggle')

    getItem(host, 'b').focus()
    enter(host)
    expect(host.lastSelection).toEqual(new Set(['b']))
    expect(ariaSelected(getItem(host, 'b'))).toBe('true')

    // Enter again on the SAME focused option toggles it back off.
    enter(host)
    expect(host.lastSelection).toEqual(new Set())
    expect(ariaSelected(getItem(host, 'b'))).toBe('false')

    host.remove()
  })

  it('sel-multi-toggle-aria-selected: aria-selected reflects the multiKeys Set (the multi-mode reflection path, unchanged)', () => {
    const host = makeHost('multi-toggle')

    click(getItem(host, 'a'))
    click(getItem(host, 'c'))
    expect(ariaSelected(getItem(host, 'a'))).toBe('true')
    expect(ariaSelected(getItem(host, 'b'))).toBe('false')
    expect(ariaSelected(getItem(host, 'c'))).toBe('true')

    host.remove()
  })

  it('sel-multi-toggle-disabled: a disabled option is non-committable via click AND Enter (the shared backstop, unchanged)', () => {
    const host = makeHost('multi-toggle')
    const b = getItem(host, 'b')
    b.setAttribute('aria-disabled', 'true')

    click(b)
    expect(host.lastSelection).toBeNull()

    b.focus()
    enter(host)
    expect(host.lastSelection).toBeNull()

    host.remove()
  })

  it('sel-multi-toggle-event: the select event detail is a ReadonlySet, matching multi mode exactly', () => {
    const host = makeHost('multi-toggle')
    let detail: unknown
    host.addEventListener('select', (e) => {
      detail = (e as CustomEvent).detail
    })

    click(getItem(host, 'a'))
    expect(detail).toEqual(new Set(['a']))

    host.remove()
  })

  it('sel-multi-toggle-sync: syncSelection re-seeds the internal Set from live external state before each toggle', () => {
    // A bare UIElement host — deliberately NOT `SelectEl` (its own `connected()` auto-wires a SECOND
    // selectionCommit instance, which would double-process every click against this test's manual wire).
    class SyncHost extends UIElement {
      lastSelection: ReadonlySet<string> | null = null
    }
    customElements.define('ui-sel-sync-host', SyncHost)

    const host = new SyncHost()
    for (const k of ['apple', 'banana', 'cherry']) {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.dataset['key'] = k
      li.tabIndex = -1
      host.append(li)
    }
    document.body.append(host)

    let external: ReadonlySet<string> = new Set(['apple']) // simulates an attribute-seeded / externally-written value
    selectionCommit(host, {
      mode: 'multi-toggle',
      syncSelection: () => external,
      onSelect: (sel) => {
        host.lastSelection = sel as ReadonlySet<string>
        external = sel as ReadonlySet<string> // the host's own onSelect would write this back to `value`
      },
    })

    const cherry = host.querySelector<HTMLElement>('[data-key="cherry"]')!
    // Toggling 'cherry' must ADD to the externally-seeded 'apple', not discard it (the trait's own
    // internal Set starts EMPTY — without syncSelection, this would wrongly yield just {'cherry'}).
    click(cherry)
    expect(host.lastSelection).toEqual(new Set(['apple', 'cherry']))

    host.remove()
  })

  it("sel-single/sel-multi regression: 'single' and 'multi' modes stay byte-unchanged after the 'multi-toggle' addition", () => {
    // single — a plain click still REPLACES (unchanged from sel-single above).
    const single = makeHost('single')
    click(getItem(single, 'a'))
    click(getItem(single, 'b'))
    expect(single.lastSelection).toBe('b')
    single.remove()

    // multi — a plain click still REPLACES the whole selection (unchanged from sel-multi-add above).
    const multi = makeHost('multi')
    click(getItem(multi, 'a'))
    click(getItem(multi, 'b')) // plain click, no modifier — REPLACES, not adds
    expect(multi.lastSelection).toEqual(new Set(['b']))
    multi.remove()
  })
})
