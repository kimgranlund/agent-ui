import { describe, it, expect } from 'vitest'
import { html, type TemplateResult } from './template.ts'
import { UIElement } from './element.ts'
import { watch } from './watch.ts'
import { signal, inspect } from '../reactive/index.ts'

// G3 S2 — the `watch` directive (rubric template.md D5). `watch(source)` binds ONE child hole to a reactive
// source via ONE connection-scope-owned effect (installed through the scope_seam `ctx.effect`). The headline
// proof: a watched-signal change wakes ONLY that hole — the host render effect gains no source on the signal
// and does NOT re-run. The reconnect proof: the effect dies with the connection scope (zero residue) and
// respawns on reconnect via the `installed` flag. Named probes: watch-value · watch-thunk · watch-mapper ·
// watch-isolated-rerender · watch-reconnect. Each headline NC is anchored on a unique token (grep-confirmed).

describe('watch — value-producing per-hole binding (D5)', () => {
  it('watch-value: a signal source drives the hole; later writes update only that hole', async () => {
    const name = signal('alpha')
    class ValueHost extends UIElement {
      protected render(): TemplateResult {
        return html`<p>${watch(name)}</p>`
      }
    }
    customElements.define('ui-watch-value', ValueHost)

    const el = new ValueHost()
    document.body.append(el) // connect → render effect runs → watch installs + runs once (synchronously)
    expect(el.querySelector('p')?.textContent).toBe('alpha')

    name.value = 'beta'
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('beta')
    el.remove()
  })

  it('watch-thunk: a getter source is read under the watch effect and tracks whatever it reads', async () => {
    const a = signal(1)
    const b = signal(10)
    class ThunkHost extends UIElement {
      protected render(): TemplateResult {
        return html`<i>${watch(() => a.value + b.value)}</i>`
      }
    }
    customElements.define('ui-watch-thunk', ThunkHost)

    const el = new ThunkHost()
    document.body.append(el)
    expect(el.querySelector('i')?.textContent).toBe('11')

    a.value = 4 // the thunk read both signals → both wake the watch effect
    await el.updateComplete
    expect(el.querySelector('i')?.textContent).toBe('14')

    b.value = 20
    await el.updateComplete
    expect(el.querySelector('i')?.textContent).toBe('24')
    el.remove()
  })

  it('watch-mapper: the mapper transforms the value before it is committed', async () => {
    const n = signal(2)
    class MapHost extends UIElement {
      protected render(): TemplateResult {
        return html`<b>${watch(n, (v) => `x${v * 10}`)}</b>`
      }
    }
    customElements.define('ui-watch-mapper', MapHost)

    const el = new MapHost()
    document.body.append(el)
    expect(el.querySelector('b')?.textContent).toBe('x20')

    n.value = 5
    await el.updateComplete
    expect(el.querySelector('b')?.textContent).toBe('x50')
    el.remove()
  })
})

describe('watch — scoped waking: the host render effect does NOT re-run (D5 headline)', () => {
  it('watch-isolated-rerender: a watched-signal change updates only the watch hole; hostRenders is unchanged', async () => {
    const hostSig = signal('host-a')
    const watched = signal('watchedOnly7')
    let hostRenders = 0

    // The host reads `hostSig` in a STATIC hole and `watch(watched)` in a watch hole. The watch hole's value
    // is read INSIDE the watch effect, so the host render effect never subscribes to `watched`.
    class IsolatedHost extends UIElement {
      protected render(): TemplateResult {
        hostRenders += 1
        return html`<span class="host">${hostSig.value}</span><span class="watched">${watch(watched)}</span>`
      }
    }
    customElements.define('ui-watch-isolated', IsolatedHost)

    const el = new IsolatedHost()
    document.body.append(el)
    expect(hostRenders).toBe(1)
    expect(el.querySelector('.host')?.textContent).toBe('host-a')
    expect(el.querySelector('.watched')?.textContent).toBe('watchedOnly7')
    expect(inspect(watched).subscribers).toBe(1) // the watch effect subscribes; the host render effect did NOT

    // Change `watched` → ONLY the watch effect wakes. The host render effect has no source on it.
    // NC: read `watched.value` directly in render() (route it through the host) → the host effect subscribes
    // → this write re-runs render() → hostRenders becomes 2 → the `toBe(1)` below goes RED. Token: `hostRenders`.
    watched.value = 'watched-b'
    await el.updateComplete
    expect(el.querySelector('.watched')?.textContent).toBe('watched-b')
    expect(hostRenders).toBe(1)

    // A host-signal change DOES re-run the host render effect — and re-running `update` must NOT re-install
    // the watch effect (the `installed` flag): the watched signal still has exactly one subscriber.
    hostSig.value = 'host-b'
    await el.updateComplete
    expect(el.querySelector('.host')?.textContent).toBe('host-b')
    expect(hostRenders).toBe(2)
    expect(inspect(watched).subscribers).toBe(1) // no double-install across the host re-render
    el.remove()
  })
})

describe('watch — the per-hole effect is connection-scope-owned (the scope_seam, D5 = 5)', () => {
  it('watch-scoped-rerender-install: a watch hole appearing on a RE-RENDER is still scope-owned (no leak)', async () => {
    // The load-bearing case for `ctx.effect`: the watch hole is absent on the FIRST render and appears on a
    // later re-render. The host render effect's FIRST run is synchronous inside `scope.run`, so anything
    // installed then is scope-adopted even by a bare `effect()`; but a RE-RUN flushes with activeOwner=null,
    // so a watch installed THEN is scope-owned ONLY because it goes through `ctx.effect`.
    // NC: install via a bare `effect()` instead of `ctx.effect` → the re-render install is UNOWNED → after
    // disconnect `subscribers` stays 1 (leak) → the `toBe(0)` below goes RED. Token: `lateWatch3`.
    const show = signal(false)
    const watched = signal('lateWatch3')
    class ToggleHost extends UIElement {
      protected render(): TemplateResult {
        return html`<p>${show.value ? watch(watched) : 'off'}</p>`
      }
    }
    customElements.define('ui-watch-late', ToggleHost)

    const el = new ToggleHost()
    document.body.append(el) // first render: no watch hole yet (activeOwner=scope, but nothing installed)
    expect(el.querySelector('p')?.textContent).toBe('off')
    expect(inspect(watched).subscribers).toBe(0)

    show.value = true // host RE-RENDER (flush → activeOwner=null) installs the watch hole via ctx.effect
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('lateWatch3')
    expect(inspect(watched).subscribers).toBe(1)

    el.remove() // disconnect → the scope disposes the watch effect ONLY IF it was scope-owned
    expect(inspect(watched).subscribers).toBe(0) // scope-owned despite the re-render install → zero residue
  })
})

describe('watch — dies on disconnect, respawns on reconnect (D5 = 5)', () => {
  it('watch-reconnect: zero subscribers after disconnect; the hole respawns after reconnect', async () => {
    const watched = signal('r0')
    class ReconnectHost extends UIElement {
      protected render(): TemplateResult {
        return html`<p>${watch(watched)}</p>`
      }
    }
    customElements.define('ui-watch-reconnect', ReconnectHost)

    const el = new ReconnectHost()
    document.body.append(el)
    expect(el.querySelector('p')?.textContent).toBe('r0')
    expect(inspect(watched).subscribers).toBe(1) // the scope-owned watch effect subscribes the signal

    el.remove() // disconnect → the connection scope disposes → the watch effect dies with it
    expect(inspect(watched).subscribers).toBe(0) // zero residue → the effect WAS scope-owned (leak-free)

    // Respawn: change the signal WHILE detached, then reconnect. A fresh scope + render effect re-commit the
    // same template → the SAME persisted directive sees `installed === false` (the cleanup reset it on
    // disconnect) → it RE-installs under the new scope's `ctx.effect`, reads the current value, and commits.
    // NC: drop the effect cleanup's `installed = false` → on reconnect `update` sees `installed === true` →
    // it does NOT re-install → no new subscriber (the `toBe(1)` below goes RED) and the hole stays stale.
    // Token: `respawnTick`.
    watched.value = 'respawnTick'
    document.body.append(el)
    expect(inspect(watched).subscribers).toBe(1) // re-subscribed exactly once (no double-install on reconnect)
    expect(el.querySelector('p')?.textContent).toBe('respawnTick') // reflects the change made while detached

    watched.value = 'respawnTick-live'
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('respawnTick-live') // live again after reconnect
    el.remove()
  })

  it('watch-leave: leaving directive mode while connected stops the effect (no leak, no stale commit)', async () => {
    // While still connected, the hole switches OUT of the watch directive to a plain value. The seam disposes
    // the directive → `watch.dispose()` must STOP the scope-owned effect (not just the inner part), or the
    // orphaned effect keeps a subscription and would commit into a torn-down inner part on the next change.
    // NC: drop `this.#disposeEffect?.()` from `dispose()` → `subscribers` stays 1 after leaving → the `toBe(0)`
    // below goes RED. Token: `leaveGhost5`.
    const watched = signal('leaveGhost5')
    const mode = signal<'watch' | 'plain'>('watch')
    class LeaveHost extends UIElement {
      protected render(): TemplateResult {
        return html`<p>${mode.value === 'watch' ? watch(watched) : 'plain'}</p>`
      }
    }
    customElements.define('ui-watch-leave', LeaveHost)

    const el = new LeaveHost()
    document.body.append(el)
    expect(el.querySelector('p')?.textContent).toBe('leaveGhost5')
    expect(inspect(watched).subscribers).toBe(1)

    mode.value = 'plain' // host re-render → the hole leaves directive mode → dispose() stops the effect
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('plain')
    expect(inspect(watched).subscribers).toBe(0) // the effect was disposed — no leak while still connected

    watched.value = 'after-leave' // the orphaned effect must NOT fire (the hole is no longer a watch)
    await el.updateComplete
    expect(el.querySelector('p')?.textContent).toBe('plain')
    el.remove()
  })
})
