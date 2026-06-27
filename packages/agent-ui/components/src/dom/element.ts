// element.ts — `UIElement`, the FACE custom-element host (plan §5).
//
// Maps the platform's connect/disconnect callbacks onto the kernel's two lifetimes: a connection
// **scope** (every computed/effect created under it dies on disconnect) and an **AbortController**
// (every platform listener riding its signal dies on disconnect). "Zero residue after removal" is then
// provable, not aspirational (goals.md G2 DoD3; rubric D4). Built so far: the connection scope/abort
// wiring + the ONE render effect (e-lifecycle), and the public helper surface — `this.effect` (scope-
// owned), `this.listen` (rides the abort signal → auto-removed on disconnect), `this.emit` (typed
// `CustomEvent`), `updateComplete` (e-helpers), and the attribute inbound crossing —
// `observedAttributes` + `attributeChangedCallback` → `coerceAttribute` (e-attrs), the lazy-property
// upgrade dance — `upgradeProps`/`upgradeProperty` at connect (e-upgrade), and internals-only ARIA + the
// light-DOM-default render root (e-internals). Only the dom barrel remains to close G2; `render()` stays
// a no-op hook until the template layer (G3).
//
// Imports only `../reactive` (the kernel) + `./props.ts` (same dom layer). `HTMLElement` /
// `AbortController` / `AbortSignal` / `CustomEvent` / `ElementInternals` are ambient DOM globals, not imports.

import { createScope, effect as createEffect, whenFlushed } from '../reactive/index.ts'
import type { Scope } from '../reactive/index.ts'
import { finalize, coerceAttribute, observedAttributesFor, propForAttribute, type Finalizable } from './props.ts'
import { render as commitTemplate, TemplateResult } from './template.ts'

export class UIElement extends HTMLElement {
  // The connection lifetimes. Null while disconnected; opened on connect, torn down + nulled on
  // disconnect. `#`-private (real JS privacy) so nothing outside the host can hold or revive them.
  #scope: Scope | null = null
  #ac: AbortController | null = null
  // The single `ElementInternals` handle, acquired ONCE here (a second `attachInternals()` throws).
  // Surfaced to subclasses via the protected `internals` getter — a `#private` field can't cross to one.
  #internals: ElementInternals = this.attachInternals()

  /** Light DOM by default; a subclass sets `static shadow = true` to render into a shadow root instead. */
  static shadow = false

  // The attribute names the platform watches, derived from `static props` (property-only props excluded;
  // `attribute` overrides honoured). Read once by `customElements.define`, before any instance exists —
  // so it reads the schema directly, not the finalize-installed accessors.
  static get observedAttributes(): string[] {
    return observedAttributesFor(this as unknown as Finalizable)
  }

  constructor() {
    super()
    // Opt-in shadow root (light DOM is the default), attached once here so `renderRoot` is a pure getter.
    if ((this.constructor as typeof UIElement).shadow) this.attachShadow({ mode: 'open' })
    // Light the props-as-signals subsystem on this host: install the signal-backed prototype accessors
    // declared by `static props`. Idempotent per class (props.ts' FINALIZED set), so every instance
    // calls it but only the first instance of a class finalizes it — no props.ts change needed.
    finalize(this.constructor as unknown as Finalizable)
  }

  connectedCallback(): void {
    // FIRST: replay any pre-upgrade `.prop=` shadow into its signal — before the render effect installs
    // and before anything reads a prop, so first render sees the assigned value, not the default.
    this.upgradeProps()
    this.#scope = createScope()
    this.#ac = new AbortController()
    // The connection scope + AbortController are now live, so a `this.effect`/`this.listen` registered in
    // `connected()` is scope-owned + rides the abort signal. `connected()` runs BEFORE the first render so
    // host-level setup (traits, signals) is in place before the first commit — see the ordering note below.
    this.connected()
    // The ONE render effect, installed through `this.effect` so there is a SINGLE scope-owned-effect
    // path (no duplication). It is created inside the scope (the kernel's `activeOwner.add`) and
    // disposed with it at disconnect — every render pass runs under the scope, so a directive attaching
    // on a later conditional re-render is scope-owned too. The disposer is intentionally discarded.
    // `render()` returns a `TemplateResult` (or nothing); when it returns one, commit it into `renderRoot`.
    this.effect(() => {
      const result = this.render()
      if (result instanceof TemplateResult) commitTemplate(result, this.renderRoot)
    })
  }

  disconnectedCallback(): void {
    // Let the control act while its connected resources are STILL live (scope/effects alive, listeners
    // unaborted) — `disconnected()` runs BEFORE the teardown below.
    this.disconnected()
    this.#scope?.dispose() // every computed/effect created under the scope dies → zero subscribers
    this.#ac?.abort() // every listener riding the connection signal dies → zero live listeners
    this.#scope = null
    this.#ac = null
  }

  /**
   * Inbound attribute → typed prop crossing. Maps the platform's ATTRIBUTE name to its PROP name, then
   * hands off to the shipped `coerceAttribute` (string→typed via the prop's codec). The directional lock
   * inside `coerceAttribute` owns loop suppression — both ways — so this adapter adds NO lock logic:
   * a `reflect` write's own echo arrives here and is suppressed (outbound lock); an external change
   * crosses to the value without reflecting back (inbound lock).
   */
  attributeChangedCallback(attr: string, _old: string | null, next: string | null): void {
    const ctor = this.constructor as unknown as Finalizable
    const name = propForAttribute(ctor, attr)
    if (name !== undefined) coerceAttribute(this, ctor, name, next)
  }

  /**
   * Resolve one pre-upgrade property shadow. A `.prop=` assignment made BEFORE the element upgraded (so
   * before `finalize` installed the prototype accessor) created an OWN data property that now MASKS the
   * accessor — reads/writes hit the dead own property, never the signal. Capture it, `delete` it
   * (revealing the accessor), then reassign so the value flows THROUGH the accessor into the signal.
   * No-op when there is no own-property shadow. Also the manual seam a control calls for a hand-written
   * array/object accessor.
   */
  protected upgradeProperty(name: string): void {
    if (!Object.hasOwn(this, name)) return
    const value = (this as Record<string, unknown>)[name]
    delete (this as Record<string, unknown>)[name]
    ;(this as Record<string, unknown>)[name] = value
  }

  /**
   * Replay every declared prop's pre-upgrade shadow. Run at the START of `connectedCallback`. Ordering
   * note (the lazy-upgrade ↔ attributeChanged seam): an INITIAL observed attribute is applied during
   * upgrade — before connect — while the shadow is still present, so its inbound write lands on the
   * shadow; this reconciles it at connect to the own-property's current value. See element-upgrade.test.ts.
   */
  protected upgradeProps(): void {
    const props = (this.constructor as unknown as Finalizable).props
    if (!props) return
    for (const name of Object.keys(props)) this.upgradeProperty(name)
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
   * The render target: the shadow root when `static shadow` opted one in, else the host itself (light DOM
   * is the default). G3's render effect commits into this — the seam lands now so G3 + the barrel compose.
   */
  get renderRoot(): ShadowRoot | HTMLElement {
    return this.shadowRoot ?? this
  }

  /**
   * The single `ElementInternals` handle (acquired once in the constructor). ARIA is set THROUGH this —
   * `this.internals.role = …`, `this.internals.ariaChecked = …` — NEVER host attributes, so the host
   * stays free of `role`/`aria-*`. The protected seam the G4 form subclass + traits reuse without
   * re-acquiring (a second `attachInternals()` throws).
   */
  protected get internals(): ElementInternals {
    return this.#internals
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
   * Overridable connect hook. Runs on connect with the connection scope + `AbortSignal` live, so a
   * `this.effect`/`this.listen` registered here is scope-owned and auto-removed on disconnect. It runs
   * BEFORE the first render (the ordering: upgradeProps → scope/ac → `connected()` → render effect), so a
   * control's host-level setup (traits, signals) is in place before the first commit. Override instead of
   * `connectedCallback` — no `super` call needed. (Post-render DOM work belongs in `updateComplete`.)
   */
  protected connected(): void {}

  /**
   * Overridable disconnect hook. Runs on disconnect BEFORE the connection scope is disposed / the signal
   * aborted, so the control can act while its connected resources are still live. Override instead of
   * `disconnectedCallback` — no `super` call needed.
   */
  protected disconnected(): void {}

  /**
   * Overridable render hook. Return a `TemplateResult` (`html\`…\``) and the scope-owned render effect
   * commits it into `renderRoot`; return nothing to render imperatively (or not at all). Runs inside the
   * connection-scoped render effect, so any signal it reads re-runs only this render, committing only the
   * holes whose values changed (the template engine's per-part `Object.is` skip).
   */
  protected render(): TemplateResult | void {}
}
