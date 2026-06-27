import { describe, it, expect, vi } from 'vitest'
import { html, render, directive, Directive, NO_COMMIT, type RenderContext, type TemplateResult } from './template.ts'
import { UIElement } from './element.ts'
import { signal, inspect } from '../reactive/index.ts'

// G3 S0 — the opt-in directive seam + the scope_seam (rubric template.md D3 + the scope-ownership half of
// D5). These probe the SEAM ITSELF (state threading · dispose isolation · sub-part driving · ctx threading)
// with throwaway test directives — the shipped `repeat`/`watch` riders land in S1/S2. Named probes:
// directive-seam · directive-teardown-isolation · directive-sub-parts · directive-move-identity · scope_seam.

// A structural view of a sub-`ChildPart` handed to a directive via `createPart()` (the concrete class is
// module-internal — directives reach it only through this public method/return).
interface SubPart {
  commit(value: unknown): void
  dispose(): void
  moveBefore(ref: ChildNode): void
  readonly startNode: ChildNode
}

describe('directive seam — state threads across commits; dispose on leaving the hole (D3)', () => {
  it('directive-seam: a stateful directive threads state across commits of the SAME hole', () => {
    class Counter extends Directive {
      count = 0
      update(): unknown {
        this.count += 1
        return `n=${this.count}`
      }
    }
    const counter = directive(Counter)
    const c = document.createElement('div')
    const view = (v: unknown): TemplateResult => html`<p>${v}</p>`

    render(view(counter()), c)
    expect(c.querySelector('p')?.textContent).toBe('n=1')
    render(view(counter()), c) // same call site + same ctor → the instance is reused → state threads
    expect(c.querySelector('p')?.textContent).toBe('n=2')
    render(view(counter()), c)
    expect(c.querySelector('p')?.textContent).toBe('n=3')
  })

  it('directive-seam: dispose() runs when the hole LEAVES directive mode', () => {
    let disposed = 0
    class D extends Directive {
      update(): unknown {
        return 'dir'
      }
      dispose(): void {
        disposed += 1
      }
    }
    const d = directive(D)
    const c = document.createElement('div')
    const view = (v: unknown): TemplateResult => html`<p>${v}</p>`

    render(view(d()), c)
    expect(c.querySelector('p')?.textContent).toBe('dir')
    render(view('plain'), c) // the hole is no longer a directive → dispose, then commit the plain value
    expect(disposed).toBe(1)
    expect(c.querySelector('p')?.textContent).toBe('plain')
  })
})

describe('directive seam — teardown isolation (D3 = 5)', () => {
  it('directive-teardown-isolation: a throwing disposer does NOT abort a sibling directive teardown', () => {
    let siblingTorn = false
    class ThrowOnDispose extends Directive {
      update(): unknown {
        return 'A'
      }
      dispose(): void {
        throw new Error('boom from the first directive')
      }
    }
    class SiblingDir extends Directive {
      update(): unknown {
        return 'B'
      }
      dispose(): void {
        siblingTorn = true // the unique token: flips true ONLY because the first throw was isolated
      }
    }
    const first = directive(ThrowOnDispose)
    const sibling = directive(SiblingDir)
    const c = document.createElement('div')
    const view = (v: unknown): TemplateResult => html`<div>${v}</div>`

    // An ARRAY hole of two sibling directives — both are disposed together in #clear's forward loop.
    render(view([first(), sibling()]), c)
    expect(c.querySelector('div')?.textContent).toBe('AB')

    // Switch the hole to a non-array value → #clear disposes both sub-parts in order; the FIRST throws.
    // NC: delete the try/catch in ChildPart.#disposeDirective → the throw aborts the loop → siblingTorn stays
    // false (and the second render throws) → RED. The console.error spy swallows the isolated-teardown report.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(view('done'), c)
    errSpy.mockRestore()

    expect(siblingTorn).toBe(true)
    expect(c.querySelector('div')?.textContent).toBe('done')
  })
})

describe('directive seam — a DOM-owning directive drives sub-parts (the part hands itself)', () => {
  it('directive-sub-parts: a NO_COMMIT directive renders/reconciles via createPart sub-parts', () => {
    class ListDir extends Directive {
      readonly #parts: SubPart[] = []
      update(args: readonly unknown[]): unknown {
        const items = args[0] as string[]
        while (this.#parts.length < items.length) this.#parts.push(this.createPart())
        while (this.#parts.length > items.length) this.#parts.pop()!.dispose()
        for (let i = 0; i < items.length; i++) this.#parts[i].commit(items[i])
        return NO_COMMIT // the directive owns its DOM → the host part commits nothing
      }
      dispose(): void {
        for (const p of this.#parts) p.dispose()
      }
    }
    const list = directive(ListDir)
    const c = document.createElement('div')
    const view = (xs: string[]): TemplateResult => html`<ul>${list(xs)}</ul>`

    render(view(['a', 'b', 'c']), c)
    expect(c.querySelector('ul')?.textContent).toBe('abc')
    render(view(['a', 'b']), c) // same ctor → instance reused → the sub-part list shrinks
    expect(c.querySelector('ul')?.textContent).toBe('ab')
  })

  it('directive-move-identity: moveBefore relocates a sub-part by IDENTITY (node preserved across reorder)', () => {
    // Renders one <span data-k> per key and reorders by moving sub-parts (the move-by-identity primitive
    // `repeat` builds on). NC: replace moveBefore/startNode reorder with dispose+recreate → the captured
    // node `===` checks fail → RED.
    class KeyedDir extends Directive {
      readonly #parts = new Map<string, SubPart>()
      update(args: readonly unknown[]): unknown {
        const keys = args[0] as string[]
        for (const k of keys) {
          if (!this.#parts.has(k)) {
            const p = this.createPart()
            p.commit(html`<span data-k=${k}>${k}</span>`)
            this.#parts.set(k, p)
          }
        }
        let ref: ChildNode = this.endNode // order each key's sub-part before the next one's start
        for (let i = keys.length - 1; i >= 0; i--) {
          const p = this.#parts.get(keys[i])!
          p.moveBefore(ref)
          ref = p.startNode
        }
        return NO_COMMIT
      }
      dispose(): void {
        for (const p of this.#parts.values()) p.dispose()
      }
    }
    const keyed = directive(KeyedDir)
    const c = document.createElement('div')
    const view = (keys: string[]): TemplateResult => html`<div>${keyed(keys)}</div>`

    render(view(['a', 'b', 'c']), c)
    const spanA = c.querySelector('[data-k="a"]')
    const spanB = c.querySelector('[data-k="b"]')
    const spanC = c.querySelector('[data-k="c"]')
    expect(c.querySelector('div')?.textContent).toBe('abc')

    render(view(['c', 'a', 'b']), c) // reorder
    expect(c.querySelector('div')?.textContent).toBe('cab')
    expect(c.querySelector('[data-k="a"]')).toBe(spanA) // the SAME node was moved, not re-created
    expect(c.querySelector('[data-k="b"]')).toBe(spanB)
    expect(c.querySelector('[data-k="c"]')).toBe(spanC)
  })
})

describe('the scope_seam — the host threads its connection scope into the render path', () => {
  it('scope_seam: a bare 2-arg render passes NO ctx to the directive', () => {
    let seen: unknown = 'unset'
    class CtxProbe extends Directive {
      update(_args: readonly unknown[], ctx?: RenderContext): unknown {
        seen = ctx
        return 'x'
      }
    }
    const probe = directive(CtxProbe)
    const c = document.createElement('div')
    render(html`<p>${probe()}</p>`, c) // 2-arg render → ctx is undefined
    expect(seen).toBeUndefined()
  })

  it('scope_seam: rendering through UIElement threads `this` as ctx; an effect via ctx.effect is scope-owned', async () => {
    const sig = signal('first')
    let installs = 0
    class ScopedEffectDir extends Directive {
      readonly #inner = this.createPart()
      #installed = false
      update(_args: readonly unknown[], ctx?: RenderContext): unknown {
        if (!this.#installed && ctx) {
          installs += 1
          // ctx.effect = the host's scope-owned effect — so this per-hole effect is owned by the CONNECTION
          // scope (dies on disconnect), not by the transient render effect that is currently running.
          ctx.effect(() => {
            this.#inner.commit(sig.value) // tracked by THIS effect, NOT the host render effect
            return () => {
              this.#installed = false
            }
          })
          this.#installed = true
        }
        return NO_COMMIT
      }
      dispose(): void {
        this.#inner.dispose()
      }
    }
    const scoped = directive(ScopedEffectDir)

    class ScopeSeamHost extends UIElement {
      protected render(): TemplateResult {
        return html`<p>${scoped()}</p>`
      }
    }
    customElements.define('ui-scope-seam-probe', ScopeSeamHost)

    const el = new ScopeSeamHost()
    document.body.append(el) // connect → render effect runs → ctx threaded → ctx.effect installed + ran once
    expect(el.querySelector('p')?.textContent).toBe('first')
    expect(installs).toBe(1)
    expect(inspect(sig).subscribers).toBe(1) // the directive effect subscribes the signal; the host did not

    sig.value = 'second' // wakes ONLY the directive's scope-owned effect (the host effect has no source on it)
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('second')

    el.remove() // disconnect disposes the connection scope → the directive effect dies with it
    expect(inspect(sig).subscribers).toBe(0) // zero residue → the per-hole effect WAS scope-owned (the scope_seam)
  })
})
