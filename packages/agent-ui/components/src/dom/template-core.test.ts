import { describe, it, expect } from 'vitest'
import { html, render, prepare } from './template.ts'
import { UIElement } from './element.ts'
import { prop, type PropsSchema, type ReactiveProps } from './props.ts'

// G3 slice 1 — the template core (rubric template.md D1 + the child-text/attr halves of D2 + part-skip +
// the D7 seed). Named probes: prepare-cache · child-commit · attr-commit · part-skip · html-e2e.

describe('template core — prepare & cache (D1)', () => {
  it('prepare-cache: same call-site strings ⇒ the same prepared instance (re-parses nothing); identity-keyed', () => {
    const view = (x: unknown) => html`<div>${x}</div>`
    const a = view(1)
    const b = view(2)
    expect(a.strings).toBe(b.strings) // same call site → the same frozen `strings` array (TS guarantee)

    const pa = prepare(a.strings)
    const pb = prepare(b.strings)
    expect(pb).toBe(pa) // the second prepare returns the cache → no second parse

    // identity-keyed (D1=5): an equal-but-DISTINCT array must MISS the cache
    const distinct = ['<div>', '</div>'] as unknown as TemplateStringsArray
    expect(prepare(distinct)).not.toBe(pa)
  })
})

describe('template core — per-part commit (D2: child + attr)', () => {
  it('child-commit: a text child hole and a nested-template child hole each commit', () => {
    const c1 = document.createElement('div')
    render(html`<p>${'hello'}</p>`, c1)
    expect(c1.querySelector('p')?.textContent).toBe('hello')

    const c2 = document.createElement('div')
    render(html`<section>${html`<b>${'x'}</b>`}</section>`, c2)
    expect(c2.querySelector('section b')?.textContent).toBe('x')
  })

  it('attr-commit: a string attribute hole commits; a re-render to null removes it (instance reused)', () => {
    const c = document.createElement('div')
    const view = (cls: string | null, title: string) => html`<div class=${cls} title=${title}></div>`
    render(view('box', 't'), c)
    const el = c.querySelector('div')!
    expect(el.getAttribute('class')).toBe('box')
    expect(el.getAttribute('title')).toBe('t')

    render(view(null, 't'), c) // SAME call site → reuse the instance
    expect(c.querySelector('div')).toBe(el) // the element persisted (not rebuilt)
    expect(el.hasAttribute('class')).toBe(false) // null removed the attribute
    expect(el.getAttribute('title')).toBe('t') // the unchanged attr held
  })

  it('part-skip: an Object.is-equal re-render performs NO DOM mutation (the kernel cutoff through the part)', () => {
    const c = document.createElement('div')
    const view = (label: string, cls: string) => html`<div class=${cls}>${label}</div>`
    render(view('hi', 'a'), c)

    const mo = new MutationObserver(() => {})
    mo.observe(c, { subtree: true, childList: true, attributes: true, characterData: true })

    render(view('hi', 'a'), c) // identical values → every part skips
    expect(mo.takeRecords().length).toBe(0) // zero DOM writes

    render(view('bye', 'a'), c) // label changed → exactly the text hole writes (anti-vacuous: the observer works)
    expect(mo.takeRecords().length).toBeGreaterThan(0)
    mo.disconnect()
  })

  it('unsupported-position fails LOUD, not silent (slice-1 invariant; slice 3 enriches the diagnostics)', () => {
    const c = document.createElement('div')
    // A hole mixed into static attribute text — not a whole-value hole — would otherwise drop the value
    // silently. It throws instead. (Slice 3 enriched the message to NAME the position; see template-positions.test.ts.)
    expect(() => render(html`<div class="a ${'b'}"></div>`, c)).toThrow(/PARTIAL attribute/)
  })
})

// html-e2e (D7 seed): a real UIElement whose render() commits html`` into renderRoot through the host's
// scope-owned render effect. Composes element.ts (G2) + the template engine — NO element.ts change.
const seedProps = { label: prop.string('hi'), cls: prop.string('a') } satisfies PropsSchema
interface SeedEl extends ReactiveProps<typeof seedProps> {}
class SeedEl extends UIElement {
  static props = seedProps
  protected render(): void {
    render(html`<div class=${this.cls}>${this.label}</div>`, this.renderRoot)
  }
}
customElements.define('ui-seed', SeedEl)

describe('template core — html`` end-to-end through UIElement (D7 seed)', () => {
  it('html-e2e: a UIElement renders html`` into renderRoot via the scope-owned render effect', () => {
    const el = new SeedEl()
    document.body.append(el) // connect → the one render effect runs render() synchronously
    const div = el.querySelector('div')! // renderRoot === el (light DOM default)
    expect(div.getAttribute('class')).toBe('a')
    expect(div.textContent).toBe('hi')
    el.remove()
  })

  it('html-e2e: a tracked-prop write re-runs the host render effect and updates ONLY the changed hole', async () => {
    const el = new SeedEl()
    document.body.append(el)
    const div = el.querySelector('div')!
    const text = div.firstChild // the label text node
    expect(div.getAttribute('class')).toBe('a')

    el.label = 'bye' // tracked write → the host render effect re-runs (microtask)
    await el.updateComplete

    expect(el.querySelector('div')).toBe(div) // SAME div — the instance was reused (cache hit), not rebuilt
    expect(div.textContent).toBe('bye') // the changed hole updated
    expect(div.firstChild).toBe(text) // in-place text update (same node) → only the changed hole touched
    expect(div.getAttribute('class')).toBe('a') // the unchanged attr hole was skipped
    el.remove()
  })
})
