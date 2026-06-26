// element.ts — `UIElement`, the FACE custom-element host (plan §5).
//
// Maps the platform's connect/disconnect callbacks onto the kernel's two lifetimes: a connection
// **scope** (every computed/effect created under it dies on disconnect) and an **AbortController**
// (every platform listener riding its signal dies on disconnect). "Zero residue after removal" is then
// provable, not aspirational (goals.md G2 DoD3; rubric D4). This is the FIRST element-host slice
// (e-lifecycle): the base class + the connection scope/abort wiring + the ONE render effect. The public
// helper surface (`this.effect`/`this.listen`/`this.emit`/`updateComplete`), the attribute inbound
// crossing (`attributeChangedCallback`), the lazy-upgrade dance, and internals/ARIA each compose
// additively on this base in later slices; `render()` stays a no-op hook until the template layer (G3).
//
// Imports only `../reactive` (the kernel) + `./props.ts` (same dom layer). `HTMLElement` /
// `AbortController` / `AbortSignal` are ambient DOM globals, not imports.

import { createScope, effect } from '../reactive/index.ts'
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
    const scope = createScope()
    const ac = new AbortController()
    this.#scope = scope
    this.#ac = ac
    // The ONE render effect, created INSIDE `scope.run` so the scope adopts it (the kernel's
    // `activeOwner.add`) and disposes it at disconnect. Every render pass runs under the scope, so a
    // directive attaching on a later conditional re-render is scope-owned too. The disposer is
    // intentionally discarded — the scope owns the lifetime.
    scope.run(() => effect(() => this.render()))
  }

  disconnectedCallback(): void {
    this.#scope?.dispose() // every computed/effect created under the scope dies → zero subscribers
    this.#ac?.abort() // every listener riding the connection signal dies → zero live listeners
    this.#scope = null
    this.#ac = null
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
