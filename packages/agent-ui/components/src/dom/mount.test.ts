import { describe, it, expect, afterEach } from 'vitest'
import { mount, repeat, watch, Directive, directive, NO_COMMIT, type RenderContext } from './index.ts'
import { html } from './template.ts' // the PRIVATE template tag — used ONLY to build the keyed item template in
// the reactive-repeat probe below; the public-surface-only path (mount WITHOUT html``) is proven in mount-commit.
import { signal, effect, createScope, inspect, whenFlushed } from '../reactive/index.ts'

// ADR-0023 — the public `mount()` directive-host seam + the directive-authoring trio. These probe the seam
// THROUGH THE PUBLIC dom barrel (`./index.ts`) — the exact surface an external package (the a2ui renderer)
// reaches — NOT template.ts directly, so they double as the contract-widening proof: an imperative consumer
// can INVOKE a kernel directive (`mount(repeat(...))`) and AUTHOR its own (`directive(class extends Directive
// …)`), all without the still-private `html``/`render` template entry. Named probes: mount-commit ·
// mount-cleanup · mount-authoring · mount-ctx-scope · mount-ctx-teardown · mount-repeat-reactive. The seam
// stands ALONE (decoupled from the parked a2ui list.ts) — every probe drives a real public directive
// (`repeat`/`watch`) or a throwaway; the last hosts repeat reactively (the actual #137 use case) under mount.

function host(): HTMLElement {
  const c = document.createElement('div')
  document.body.append(c)
  return c
}
afterEach(() => {
  document.body.replaceChildren()
})

describe('mount — commit a kernel directive into a container (ADR-0023)', () => {
  it('mount-commit: mount(repeat(...)) renders the item nodes inside the container (no html`` entry)', () => {
    const c = host()
    // A real public directive whose item template returns the key as TEXT — so NO `html``/`render` is touched;
    // the only render path used is the directive host. repeat reconciles three sub-parts into the container.
    const cleanup = mount(repeat(['a', 'b', 'c'], (k) => k, (k) => k), c)
    const texts = Array.from(c.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE)
    expect(texts.map((t) => t.textContent)).toEqual(['a', 'b', 'c']) // the three item nodes, inside the container
    expect(c.textContent).toBe('abc')
    cleanup()
  })
})

describe('mount — the returned teardown disposes (ADR-0023)', () => {
  it('mount-cleanup: the teardown removes the directive content AND the mount anchor (load-bearing)', () => {
    const c = host()
    const cleanup = mount(repeat(['a', 'b', 'c'], (k) => k, (k) => k), c)
    // BEFORE cleanup the content is LIVE — the NC framing: the empty state below is caused BY the teardown, not
    // by nothing having rendered (skip cleanup and the list stays in the DOM → the teardown is load-bearing).
    expect(c.textContent).toBe('abc')
    expect(c.childNodes.length).toBeGreaterThan(0)

    cleanup()
    // AFTER cleanup: content gone AND the mount anchor removed → zero residual nodes. (repeat owns no effect, so
    // its residue is purely DOM; the scope-owned-effect subscriber-residue is proven in mount-ctx-teardown.)
    expect(c.textContent).toBe('')
    expect(c.childNodes.length).toBe(0)
  })
})

describe('mount — the public authoring trio is usable by an external-style consumer (ADR-0023)', () => {
  it('mount-authoring: a CUSTOM directive (public Directive/directive/NO_COMMIT) runs update on mount, dispose on cleanup', () => {
    // The load-bearing proof of the contract widening: subclass the public `Directive`, wrap it with the public
    // `directive()`, drive OWN DOM via the protected `createPart()` + `NO_COMMIT`, and `mount()` it — exactly
    // the shape a2ui's per-item custom directive needs, with no template entry exposed.
    let updates = 0
    let disposes = 0
    class Probe extends Directive {
      readonly #inner = this.createPart()
      update(): unknown {
        updates += 1
        this.#inner.commit('probe-ran')
        return NO_COMMIT // a DOM-owning directive — the host part commits nothing
      }
      dispose(): void {
        disposes += 1
        this.#inner.dispose()
      }
    }
    const probe = directive(Probe)
    const c = host()

    const cleanup = mount(probe(), c)
    expect(updates).toBe(1) // update() ran on mount
    expect(c.textContent).toBe('probe-ran') // the directive's self-driven DOM rendered inside the container

    cleanup()
    expect(disposes).toBe(1) // dispose() ran on cleanup — authoring teardown works through mount()
    expect(c.textContent).toBe('')
    expect(c.childNodes.length).toBe(0)
  })
})

describe('mount — ctx threads the connection scope (ADR-0023)', () => {
  it('mount-ctx-scope: a scope-owned effect (via ctx) wakes on change and DIES when the ctx scope disposes', async () => {
    const sig = signal('one')
    const scope = createScope()
    // The RenderContext a host threads — mirrors UIElement.effect: install the effect UNDER the scope so the
    // scope owns it (createScope().run(() => effect(fn))). The a2ui renderer passes its own connection scope here.
    const ctx: RenderContext = { effect: (fn) => scope.run(() => effect(fn)) }
    const c = host()

    // Mount the PUBLIC `watch` directive imperatively — a real scope-owned-effect consumer of ctx. (Proves the
    // SAME directive runs through mount() as through html`/render`: one engine, not two.)
    const cleanup = mount(watch(sig), c, ctx)
    expect(c.textContent).toBe('one')
    expect(inspect(sig).subscribers).toBe(1) // the watch effect subscribed — owned by the ctx scope

    sig.value = 'two' // ctx threaded → wakes the scope-owned effect (no host render effect exists on this signal)
    await whenFlushed()
    expect(c.textContent).toBe('two')

    // OWNERSHIP: disposing the CTX SCOPE (not the mount teardown) kills the effect → zero residual subscribers.
    // That is what "owned by ctx" means — the effect's lifetime is the scope's, exactly as on a host disconnect.
    scope.dispose()
    expect(inspect(sig).subscribers).toBe(0)

    cleanup() // hygiene — also remove the mounted DOM (idempotent with the already-disposed effect)
    expect(c.childNodes.length).toBe(0)
  })

  it('mount-ctx-teardown: the mount cleanup tears down a scope-owned-effect directive — zero subscriber residue', () => {
    const sig = signal('x')
    const scope = createScope()
    const ctx: RenderContext = { effect: (fn) => scope.run(() => effect(fn)) }
    const c = host()

    const cleanup = mount(watch(sig), c, ctx)
    expect(inspect(sig).subscribers).toBe(1)

    // The mount teardown disposes the directive → watch.dispose() stops its OWN effect → zero residue WITHOUT
    // disposing the whole scope. NC: skip cleanup and the effect survives (subscribers stays 1).
    cleanup()
    expect(inspect(sig).subscribers).toBe(0)
    expect(c.textContent).toBe('')
    expect(c.childNodes.length).toBe(0)
  })
})

describe('mount — hosts the real `repeat` directive reactively (the a2ui #137 use case)', () => {
  it('mount-repeat-reactive: a signal change delta-updates the keyed list (reuse/move by identity); cleanup → zero residue', async () => {
    const items = signal(['a', 'b', 'c'])
    const scope = createScope()
    const ctx: RenderContext = { effect: (fn) => scope.run(() => effect(fn)) }
    const c = host()

    // The minimal reactive-list shape the parked #137 list.ts will take: a custom directive that, on each
    // scope-owned effect run, re-commits `repeat(items.value)` into ONE inner sub-part → repeat reconciles by
    // key. Proves the mount seam hosts repeat's REACTIVE delta path (reuse/move by key), not just a one-shot
    // commit. It captures + disposes its own effect (the canonical watch.ts discipline) so cleanup is leak-free.
    class ReactiveList extends Directive {
      readonly #inner = this.createPart()
      #installed = false
      #disposeEffect: (() => void) | undefined
      update(_args: readonly unknown[], rctx?: RenderContext): unknown {
        if (!this.#installed && rctx) {
          this.#disposeEffect = rctx.effect(() => {
            this.#installed = true
            this.#inner.commit(repeat(items.value, (k) => k, (k) => html`<li data-k=${k}>${k}</li>`))
            return () => {
              this.#installed = false
            }
          })
        }
        return NO_COMMIT
      }
      dispose(): void {
        this.#disposeEffect?.() // stop the effect before tearing down the inner part (no commit into a dead part)
        this.#disposeEffect = undefined
        this.#inner.dispose()
      }
    }
    const list = directive(ReactiveList)
    const order = (): (string | null)[] => Array.from(c.querySelectorAll('li')).map((l) => l.getAttribute('data-k'))

    const cleanup = mount(list(), c, ctx)
    expect(order()).toEqual(['a', 'b', 'c'])
    expect(inspect(items).subscribers).toBe(1) // the list driver's scope-owned effect tracks the items signal
    const liB = c.querySelector('[data-k="b"]') // capture a survivor's node to prove reuse-by-identity below

    items.value = ['c', 'a', 'b'] // a reorder repeat resolves by key (move, not re-create)
    await whenFlushed()
    expect(order()).toEqual(['c', 'a', 'b']) // delta-updated order
    expect(c.querySelector('[data-k="b"]')).toBe(liB) // the SAME node moved — keyed reuse/move under mount

    items.value = ['c', 'a'] // drop a key → repeat removes that sub-part
    await whenFlushed()
    expect(order()).toEqual(['c', 'a'])

    cleanup() // the mount teardown disposes the list directive → its effect stops + its DOM clears
    expect(c.querySelector('li')).toBe(null) // content removed
    expect(c.childNodes.length).toBe(0) // mount anchor removed too
    expect(inspect(items).subscribers).toBe(0) // zero residue — the scope-owned effect died with the part
  })
})
