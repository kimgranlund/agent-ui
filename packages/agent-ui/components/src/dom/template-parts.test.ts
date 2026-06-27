import { describe, it, expect, vi } from 'vitest'
import { html, render, type TemplateResult } from './template.ts'

// G3 slice 2 — the rest of the part family (rubric template.md D2 ≥4): child array (position reconcile),
// nested-template update-vs-replace, ?bool, .prop, @event (stable listener identity), each honoring the
// per-part Object.is skip. Named probes: child-array · nested-template · bool-toggle · prop-set ·
// event-stable-identity · part-skip-extended.

describe('template parts — child array & nested template (D2)', () => {
  it('child-array: an array child renders each item and reconciles by position (update/append/remove)', () => {
    const c = document.createElement('div')
    const view = (xs: unknown[]) => html`<ul>${xs}</ul>`
    render(view(['a', 'b', 'c']), c)
    const ul = c.querySelector('ul')!
    expect(ul.textContent).toBe('abc')

    render(view(['a', 'B', 'c', 'd']), c) // update item 1, append item 3
    expect(ul.textContent).toBe('aBcd')

    render(view(['a']), c) // shrink
    expect(ul.textContent).toBe('a')
    expect(c.querySelector('ul')).toBe(ul) // the instance was reused throughout
  })

  it('child-array: an array of templates reconciles (items are themselves templates)', () => {
    const c = document.createElement('div')
    const row = (x: string) => html`<li>${x}</li>`
    const view = (xs: string[]) => html`<ul>${xs.map(row)}</ul>`
    render(view(['x', 'y']), c)
    expect(c.querySelectorAll('li').length).toBe(2)
    expect(c.querySelector('ul')!.textContent).toBe('xy')

    render(view(['x', 'y', 'z']), c)
    expect(c.querySelectorAll('li').length).toBe(3)
    expect(c.querySelector('ul')!.textContent).toBe('xyz')
  })

  it('nested-template: the same template updates in place; a different template replaces', () => {
    const c = document.createElement('div')
    const aView = (t: string) => html`<b>${t}</b>`
    const bView = (t: string) => html`<i>${t}</i>`
    const view = (inner: TemplateResult) => html`<div>${inner}</div>`

    render(view(aView('1')), c)
    const bold = c.querySelector('b')!
    expect(bold.textContent).toBe('1')

    render(view(aView('2')), c) // SAME call site → update in place
    expect(c.querySelector('b')).toBe(bold)
    expect(bold.textContent).toBe('2')

    render(view(bView('3')), c) // DIFFERENT template → replace
    expect(c.querySelector('b')).toBeNull()
    expect(c.querySelector('i')?.textContent).toBe('3')
  })
})

describe('template parts — attribute family ?bool / .prop / @event (D2)', () => {
  it('bool-toggle: ?bool toggles the boolean attribute presence (truthy adds, falsy removes)', () => {
    const c = document.createElement('div')
    const view = (on: boolean) => html`<button ?disabled=${on}></button>`
    render(view(true), c)
    const btn = c.querySelector('button')!
    expect(btn.hasAttribute('disabled')).toBe(true)

    render(view(false), c)
    expect(c.querySelector('button')).toBe(btn) // reused
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('prop-set: .prop sets the DOM property (not the attribute), with the source camelCase name preserved', () => {
    const c = document.createElement('div')
    render(html`<input .value=${'hi'} />`, c)
    const input = c.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('hi') // the DOM property
    expect(input.getAttribute('value')).toBeNull() // NOT reflected to an attribute

    // camelCase preserved: `.tabIndex` must hit the real property, not a lowercased `tabindex` expando.
    const c2 = document.createElement('div')
    const view = (v: number) => html`<span .tabIndex=${v}></span>`
    render(view(3), c2)
    const span = c2.querySelector('span')!
    expect(span.tabIndex).toBe(3)
    render(view(7), c2)
    expect(span.tabIndex).toBe(7)
  })

  it('event-stable-identity: @event keeps ONE stable listener; re-render swaps the inner handler, no churn', () => {
    const c = document.createElement('div')
    const view = (h: ((e: Event) => void) | null) => html`<button @click=${h}></button>`

    render(view(() => {}), c) // first render attaches the single stable listener
    const btn = c.querySelector('button')!
    const addSpy = vi.spyOn(btn, 'addEventListener')
    const removeSpy = vi.spyOn(btn, 'removeEventListener')

    let calls1 = 0
    const h1 = (): void => {
      calls1++
    }
    let calls2 = 0
    const h2 = (): void => {
      calls2++
    }
    render(view(h1), c) // swap handler
    render(view(h2), c) // swap handler again
    render(view(h2), c) // SAME handler → Object.is no-op

    expect(addSpy).not.toHaveBeenCalled() // never re-attached across re-renders
    expect(removeSpy).not.toHaveBeenCalled() // no churn

    btn.dispatchEvent(new Event('click'))
    expect(calls2).toBe(1) // the CURRENT handler fired exactly once (one listener)
    expect(calls1).toBe(0) // the swapped-out handler did not

    removeSpy.mockClear()
    render(view(null), c) // clearing the handler detaches the listener
    expect(removeSpy).toHaveBeenCalledTimes(1)
    calls2 = 0
    btn.dispatchEvent(new Event('click'))
    expect(calls2).toBe(0)
  })
})

describe('template parts — Object.is skip across kinds (D2=5)', () => {
  it('part-skip-extended: an equal re-render writes no DOM and re-attaches no listener (bool/prop/event)', () => {
    const c = document.createElement('div')
    const h = (): void => {}
    const view = (on: boolean, v: number, fn: () => void) =>
      html`<button ?disabled=${on} .tabIndex=${v} @click=${fn}></button>`
    render(view(true, 2, h), c)
    const btn = c.querySelector('button')!

    const mo = new MutationObserver(() => {})
    mo.observe(c, { subtree: true, childList: true, attributes: true, characterData: true })
    const addSpy = vi.spyOn(btn, 'addEventListener')

    render(view(true, 2, h), c) // identical values → every part skips

    expect(mo.takeRecords().length).toBe(0) // no attribute write (?bool + .tabIndex-reflected skip)
    expect(addSpy).not.toHaveBeenCalled() // no @event re-attach
    mo.disconnect()
  })
})
