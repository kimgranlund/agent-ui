import { describe, it, expect } from 'vitest'
import { UIElement } from './element.ts'
import { html, type TemplateResult } from './template.ts'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

// Phase-1 s1 — render-wiring (= G3 DoD box 4 / template D7 html-e2e at the element level). UIElement's
// ONE scope-owned render effect now COMMITS the TemplateResult that render() returns into renderRoot.
// Named probe: render-commits. Zero-residue is covered by element-lifecycle (the effect is unchanged in
// ownership — still the single scope-owned effect); this also re-checks it via reconnect.

const props = { label: prop.string('hi'), cls: prop.string('a') } satisfies PropsSchema
interface RenderEl extends ReactiveProps<typeof props> {}
class RenderEl extends UIElement {
  static props = props
  protected render(): TemplateResult {
    return html`<div class=${this.cls}>${this.label}</div>`
  }
}
customElements.define('ui-render-wired', RenderEl)

describe('s1 render-wiring — render() returns a template; the effect commits it (G3 DoD4)', () => {
  it('render-commits: returning html`` from render() renders into renderRoot on connect', () => {
    const el = new RenderEl()
    document.body.append(el) // connect → the scope-owned render effect runs render() and commits it
    const div = el.querySelector('div')! // renderRoot === el (light DOM default)
    expect(div.getAttribute('class')).toBe('a')
    expect(div.textContent).toBe('hi')
    el.remove()
  })

  it('render-commits: a tracked-prop write re-runs the render effect and updates ONLY the changed hole', async () => {
    const el = new RenderEl()
    document.body.append(el)
    const div = el.querySelector('div')!
    const text = div.firstChild // the label text node

    el.label = 'x' // tracked write → the host render effect re-runs (microtask)
    await el.updateComplete

    expect(el.querySelector('div')).toBe(div) // SAME div — the template instance was reused (cache hit)
    expect(div.textContent).toBe('x') // the changed hole updated
    expect(div.firstChild).toBe(text) // in-place text update (same node) → only the changed hole
    expect(div.getAttribute('class')).toBe('a') // the unchanged attr hole was skipped
    el.remove()
  })

  it('render-commits: the render effect stays scope-owned — connect→disconnect→reconnect re-renders clean', () => {
    const el = new RenderEl()
    document.body.append(el)
    expect(el.querySelector('div')?.textContent).toBe('hi')

    el.remove() // disconnect disposes the render effect (zero residue — see element-lifecycle)
    document.body.append(el) // reconnect installs a FRESH scope-owned render effect → re-commits
    expect(el.querySelector('div')?.textContent).toBe('hi')

    el.label = 'y' // and reactivity is live again after reconnect
    return el.updateComplete.then(() => {
      expect(el.querySelector('div')?.textContent).toBe('y')
      el.remove()
    })
  })
})
