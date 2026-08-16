import { describe, it, expect, afterEach } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { listReorder } from './list-reorder.ts'

// list-reorder.browser.test.ts — real-engine proof that the keyboard fallback keeps FOCUS across consecutive
// moves (GH #952 review M1). The unit file proves the jsdom leg (detach+reinsert + explicit re-focus); this
// file proves the whole shape in Chromium AND WebKit: a real focused handle, two real ArrowDown presses, the
// SAME element still `document.activeElement` after each — through whichever move primitive the engine has
// (`Node.moveBefore`, the ADR-0022 atomic move, or the `before`/`after` fallback). Probe [1] records which
// leg each engine took, so a Playwright bump that flips one is visible rather than silent.
//
// Named probes: engine-move-primitive (informational) · keyboard-focus-survives-two-arrowdowns ·
//               keyboard-focus-survives-arrowup-back

class ListReorderBrowserEl extends UIElement {
  rows: HTMLElement[] = []
  handles = new Map<HTMLElement, HTMLElement>()
  commits: Array<{ from: number; to: number }> = []

  buildRows(count: number): void {
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div')
      row.style.cssText = 'display:block;block-size:32px;'
      row.textContent = `row ${i}`
      const handle = document.createElement('button')
      handle.type = 'button'
      handle.setAttribute('aria-label', `Move row ${i}`)
      row.prepend(handle)
      this.append(row)
      this.rows.push(row)
      this.handles.set(row, handle)
    }
  }

  protected connected(): void {
    listReorder(this, {
      items: () => [...this.children] as HTMLElement[],
      armed: () => true,
      handle: (item) => this.handles.get(item) ?? null,
      onCommit: (from, to) => this.commits.push({ from, to }),
    })
  }
}
if (!customElements.get('ui-list-reorder-browser-test')) {
  customElements.define('ui-list-reorder-browser-test', ListReorderBrowserEl)
}

const mounted: ListReorderBrowserEl[] = []
function mount(count = 3): ListReorderBrowserEl {
  const el = new ListReorderBrowserEl()
  document.body.append(el)
  el.buildRows(count)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove()
})

const arrow = (key: 'ArrowDown' | 'ArrowUp'): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

describe('listReorder — keyboard focus survives a move (real engines, GH #952)', () => {
  it('engine-move-primitive: records which leg this engine takes (informational trip-wire)', () => {
    const el = mount()
    const hasMoveBefore = 'moveBefore' in el
    // eslint-disable-next-line no-console
    console.log(`[list-reorder] ${navigator.userAgent.includes('WebKit') && !navigator.userAgent.includes('Chrome') ? 'webkit' : 'chromium'}: moveBefore=${hasMoveBefore}`)
    expect(typeof hasMoveBefore).toBe('boolean')
  })

  it('keyboard-focus-survives-two-arrowdowns: the SAME handle stays document.activeElement after each press', () => {
    const el = mount(3)
    const handle = el.handles.get(el.rows[0])!
    handle.focus()
    expect(document.activeElement).toBe(handle)

    handle.dispatchEvent(arrow('ArrowDown'))
    expect(document.activeElement).toBe(handle) // press 1
    expect([...el.children].indexOf(el.rows[0])).toBe(1)

    handle.dispatchEvent(arrow('ArrowDown'))
    expect(document.activeElement).toBe(handle) // press 2 — the whole point: no re-tab between presses
    expect([...el.children].indexOf(el.rows[0])).toBe(2)

    expect(el.commits).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2 }])
  })

  it('keyboard-focus-survives-arrowup-back: the moveBefore(neighbor) leg keeps focus too', () => {
    const el = mount(3)
    const handle = el.handles.get(el.rows[2])!
    handle.focus()
    handle.dispatchEvent(arrow('ArrowUp'))
    expect(document.activeElement).toBe(handle)
    expect([...el.children].indexOf(el.rows[2])).toBe(1)
    handle.dispatchEvent(arrow('ArrowUp'))
    expect(document.activeElement).toBe(handle)
    expect([...el.children].indexOf(el.rows[2])).toBe(0)
    expect(el.commits).toEqual([{ from: 2, to: 1 }, { from: 1, to: 0 }])
  })
})
