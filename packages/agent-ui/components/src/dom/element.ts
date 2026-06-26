// element.ts — `UIElement`, the FACE custom-element host (plan §5).
//
// Maps the platform's connect/disconnect callbacks onto the kernel's two lifetimes: a connection
// **scope** (every computed/effect created under it dies on disconnect) and an **AbortController**
// (every platform listener riding its signal dies on disconnect). "Zero residue after removal" is then
// provable, not aspirational (goals.md G2 DoD3; rubric D4). Built so far: the connection scope/abort
// wiring + the ONE render effect (e-lifecycle), and the public helper surface — `this.effect` (scope-
// owned), `this.listen` (rides the abort signal → auto-removed on disconnect), `this.emit` (typed
// `CustomEvent`), `updateComplete` (e-helpers). The attribute inbound crossing
// (`attributeChangedCallback`), the lazy-upgrade dance, and internals/ARIA each compose additively on
// this base in later slices; `render()` stays a no-op hook until the template layer (G3).
//
// Imports only `../reactive` (the kernel) + `./props.ts` (same dom layer). `HTMLElement` /
// `AbortController` / `AbortSignal` / `CustomEvent` are ambient DOM globals, not imports.

import { createScope, effect as createEffect, whenFlushed } from '../reactive/index.ts'
import type { Scope } from '../reactive/index.ts'
import { finalize, type Finalizable } from './props.ts'

export class UIElement extends HTMLElement {
  // The connection lifetimes. Null while disconnected; opened on connect, torn down + nulled on
  // disconnect. `#`-private (real JS privacy) so nothing outside the host can hold or revive them.
  #scope: Scope | null = null
  #ac: AbortController | null = null

  constructor() {
    super()
    // Light the props-as-signals subsystem on this host: install the signal-backed prototype accessors
    // declared by `static props`. Idempotent per class (props.ts' FINALIZED set), so every instance
    // calls it but only the first instance of a class finalizes it — no props.ts change needed.
    finalize(this.constructor as unknown as Finalizable)
  }

  connectedCallback(): void {
    this.#scope = createScope()
    this.#ac = new AbortController()
    // The ONE render effect, installed through `this.effect` so there is a SINGLE scope-owned-effect
    // path (no duplication). It is created inside the scope (the kernel's `activeOwner.add`) and
    // disposed with it at disconnect — every render pass runs under the scope, so a directive attaching
    // on a later conditional re-render is scope-owned too. The disposer is intentionally discarded.
    this.effect(() => this.render())
  }

  disconnectedCallback(): void {
    this.#scope?.dispose() // every computed/effect created under the scope dies → zero subscribers
    this.#ac?.abort() // every listener riding the connection signal dies → zero live listeners
    this.#scope = null
    this.#ac = null
  }

  /**
   * Register a connection-scoped effect: it runs now and re-runs on dependency change, and is disposed
   * when the host disconnects (the scope owns it). This is the one effect-install primitive —
   * `connectedCallback` routes the render effect through it too. Returns the effect's disposer (call it
   * to end the effect early; otherwise disconnect ends it). Throws if called outside the connected
   * lifetime, where there is no scope to own it.
   */
  effect(fn: () => void | (() => void)): () => void {
    const scope = this.#scope
    if (!scope) throw new Error('UIElement.effect: no connection scope — call it during the connected lifetime')
    return scope.run(() => createEffect(fn))
  }

  /**
   * Add a platform event listener that rides the connection `AbortSignal`, so it is removed
   * automatically on disconnect (`ac.abort()`) — zero live listeners after removal, no manual teardown.
   * `type` stays an open string so custom event names are accepted; a control narrows at its call site.
   * Throws if called outside the connected lifetime, where there is no signal to bind to.
   */
  listen(target: EventTarget, type: string, handler: (event: Event) => void, opts?: AddEventListenerOptions): void {
    const ac = this.#ac
    if (!ac) throw new Error('UIElement.listen: no connection signal — call it during the connected lifetime')
    target.addEventListener(type, handler, { ...opts, signal: ac.signal })
  }

  /**
   * Dispatch a composed, bubbling, cancelable `CustomEvent`. Typed generically over the detail `D`, so a
   * caller that pins `D` (today explicitly; via an event-detail map / `HTMLElementEventMap` augmentation
   * once controls land) gets the detail type-checked. Returns `false` if a listener called
   * `preventDefault()`, mirroring the platform's `dispatchEvent`.
   */
  emit<D = undefined>(type: string, detail?: D): boolean {
    return this.dispatchEvent(new CustomEvent<D>(type, { detail, bubbles: true, composed: true, cancelable: true }))
  }

  /** Resolves after the next render flush settles — `await el.updateComplete` waits for a pending render. */
  get updateComplete(): Promise<void> {
    return whenFlushed()
  }

  /**
   * The connection `AbortSignal`: connection-scoped platform listeners ride it, so disconnect
   * (`abort()`) frees them in one shot. Null while disconnected. The minimal protected seam by which
   * subclasses / traits observe the connection lifetime; `this.listen` (e-helpers) rides it.
   */
  protected get connectionSignal(): AbortSignal | null {
    return this.#ac?.signal ?? null
  }

  /**
   * Overridable render hook. A no-op until the template layer (G3) supplies `html\`\`` → `render`.
   * Runs inside the connection-scoped render effect, so any signal it reads re-runs only this render.
   */
  protected render(): void {}
}
