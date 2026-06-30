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
// sel-aria-selected · sel-event · sel-event-multi · sel-enter · sel-auto-cleanup · sel-release

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
