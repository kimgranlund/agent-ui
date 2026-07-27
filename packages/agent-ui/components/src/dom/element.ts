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
  // Pre-upgrade `.prop=` values captured in the constructor (property-wins, ADR-0005). See the constructor.
  #captured = new Map<string, unknown>()

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
    const ctor = this.constructor as unknown as Finalizable
    finalize(ctor)
    // Property-wins (ADR-0005): snapshot each declared prop's pre-upgrade own-property value HERE — the
    // constructor runs during upgrade BEFORE attributeChangedCallback can overwrite the shadow — so an
    // imperatively-set `.prop=` beats an initial attribute. `upgradeProperty` replays the captured value.
    if (ctor.props) {
      for (const name of Object.keys(ctor.props)) {
        if (Object.hasOwn(this, name)) this.#captured.set(name, (this as Record<string, unknown>)[name])
      }
    }
  }

  // GH #302 — a real engine can invoke a SYNCHRONOUS, NESTED `disconnectedCallback` for THIS SAME
  // instance while `connectedCallback` (below, including a SUBCLASS's `super.connectedCallback()`
  // wrapper — e.g. `UIFormElement`'s, dom/form.ts) is still on the call stack, mid-`connected()`. Repro:
  // a host moves an author child that is STILL AWAITING its own first `connectedCallback` reaction into
  // a not-yet-connected wrapper (`ui-form-popover`'s `#ensureParts()` child-move-then-reconnect cycle,
  // form-popover.ts) — the move enqueues BOTH the child's original (stale, now-detached-by-the-time-it-
  // runs) "connected" reaction AND a fresh "disconnected" reaction (correctly, since the child WAS
  // connected an instant earlier). A real engine does not always drain one element's reaction queue to
  // completion before starting the next: a NESTED CEReactions-annotated DOM op performed from WITHIN the
  // still-running "connected" reaction (here, `setAttribute` — any reflecting prop write, radio-group.ts's
  // `this.orientation = …`) triggers the ALSO-pending "disconnected" reaction to run to completion right
  // then, mid-`connected()`.
  //
  // Fix locus: the real defect is ORDERING (candidate (c) from the GH #302 triage), not a missing
  // tolerance at each `listen`/`effect` call site — a disconnect reaction that lands WHILE this instance's
  // own connect is still resolving must not tear down `#scope`/`#ac` out from under STILL-EXECUTING
  // connect wiring, wherever in the override chain that wiring runs. `#connectingDepth` marks the WHOLE
  // window (a depth counter, not a boolean, so a subclass's `super.connectedCallback()` wrapper — the
  // ONE documented exception, `UIFormElement.connectedCallback`, dom/form.ts, clause 4 — composes: it
  // brackets its OWN post-super effects with `beginConnecting()`/`endConnecting()` too, so the window
  // spans the FULL platform-invoked call, not just this base class's own body). A nested
  // `disconnectedCallback` landing inside the window still runs the `disconnected()` hook (the resources
  // are genuinely still live, matching this method's existing contract) but DEFERS the actual
  // scope-dispose/abort-signal teardown via `#deferredTeardown` until the OUTERMOST `endConnecting()` —
  // so wiring installed AFTER the reentrant disconnect still rides a live signal, then gets correctly
  // torn down the instant the whole connectedCallback call returns — the same "disconnected, zero
  // residue" end state as if no reentrancy had ever happened. A later LEGITIMATE reconnect (the wrapper's
  // eventual reattachment) still gets a fully fresh `connectedCallback` pass, same as always.
  #connectingDepth = 0
  #deferredTeardown = false

  /** Open (or extend, if already open) the GH #302 reentrancy window — see the banner above. Call ONLY
   *  paired with `endConnecting()` (a `try`/`finally`), and only around code that runs as part of THIS
   *  instance's own connectedCallback override chain (`UIFormElement`'s the one existing caller). */
  protected beginConnecting(): void {
    this.#connectingDepth++
  }

  /** Close (or un-nest, if still nested) the GH #302 reentrancy window opened by `beginConnecting()`.
   *  Only the OUTERMOST close (depth reaches 0) applies a teardown deferred by a reentrant disconnect
   *  while the window was open — see the banner above. */
  protected endConnecting(): void {
    this.#connectingDepth--
    if (this.#connectingDepth === 0 && this.#deferredTeardown) {
      // A nested disconnect landed mid-connect (GH #302, banner above) — the truth this whole time was
      // "disconnected"; apply the deferred teardown NOW so nothing this pass just wired outlives it.
      this.#deferredTeardown = false
      this.#teardown()
    }
  }

  connectedCallback(): void {
    // Review finding (GH #302 follow-up, Q2(b)): a NESTED `connectedCallback` for this SAME instance
    // landing while `#connectingDepth > 0` (a reentrant re-connect during an already-open window) would
    // otherwise overwrite the still-live `#scope`/`#ac` below WITHOUT disposing them (a leak), and the
    // stale `#deferredTeardown` flag left over from an earlier reentrant disconnect would then tear down
    // THIS new, legitimate connection at the outermost `endConnecting()` — connected in the DOM but dead
    // (no listeners, no effects). Apply any pending deferred teardown NOW, before minting anything new,
    // so a fresh connect always starts from a genuinely clean slate.
    if (this.#deferredTeardown) {
      this.#deferredTeardown = false
      this.#teardown()
    }
    // FIRST: replay any pre-upgrade `.prop=` shadow into its signal — before the render effect installs
    // and before anything reads a prop, so first render sees the assigned value, not the default.
    this.upgradeProps()
    this.#scope = createScope()
    this.#ac = new AbortController()
    this.beginConnecting()
    try {
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
        // Pass `this` as the RenderContext (the scope_seam): `UIElement` structurally satisfies it via the
        // scope-owned `effect`, so a per-hole directive (`watch`) installs its effect under the connection
        // scope — surviving unrelated re-renders, dying on disconnect — not under this transient render effect.
        if (result instanceof TemplateResult) commitTemplate(result, this.renderRoot, this)
      })
    } finally {
      // Always close, even if `connected()`/the render effect throws for an UNRELATED reason.
      this.endConnecting()
    }
  }

  disconnectedCallback(): void {
    if (this.#connectingDepth > 0) {
      // Reentrant: this instance's OWN connectedCallback (possibly a subclass's still-open
      // `beginConnecting()`/`endConnecting()` bracket) is still resolving elsewhere on the call stack
      // (GH #302, banner above). `#scope`/`#ac` are genuinely still live — run the `disconnected()` hook
      // now (the existing "act while resources are still live" contract), but defer the actual dispose/
      // abort to the OUTERMOST `endConnecting()`, so wiring the still-running connect pass installs after
      // this point rides a live signal instead of throwing.
      this.disconnected()
      this.#deferredTeardown = true
      return
    }
    // Let the control act while its connected resources are STILL live (scope/effects alive, listeners
    // unaborted) — `disconnected()` runs BEFORE the teardown below.
    this.disconnected()
    this.#teardown()
  }

  /** The connection-resource teardown proper (scope dispose + abort-signal abort + null-out) — the
   *  ordinary disconnect path's tail AND the GH #302 deferred-reentrancy path's tail converge here, so
   *  "zero residue after removal" has exactly one implementation regardless of which path reached it. */
  #teardown(): void {
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
   * Resolve one pre-upgrade property shadow. A `.prop=` set BEFORE the element upgraded (before `finalize`
   * installed the accessor) created an OWN data property that MASKS the accessor — reads/writes hit the
   * dead own property, never the signal. Replay the value THROUGH the accessor: prefer the value the
   * CONSTRUCTOR captured (property-wins, ADR-0005 — it predates any initial-attribute write to the shadow);
   * fall back to the current own-property value when nothing was captured (e.g. a manual array/object
   * accessor a control upgrades by hand, or a shadow created after construction). No-op with neither.
   */
  protected upgradeProperty(name: string): void {
    const hasCaptured = this.#captured.has(name)
    const hasOwn = Object.hasOwn(this, name)
    if (!hasCaptured && !hasOwn) return
    const value = hasCaptured ? this.#captured.get(name) : (this as Record<string, unknown>)[name]
    this.#captured.delete(name)
    if (hasOwn) delete (this as Record<string, unknown>)[name] // dissolve the shadow → reveal the accessor
    ;(this as Record<string, unknown>)[name] = value // replay through the accessor → the signal (+ reflect once)
  }

  /**
   * Replay every declared prop's pre-upgrade shadow. Run at the START of `connectedCallback`. Ordering
   * note (the lazy-upgrade ↔ attributeChanged seam): an INITIAL observed attribute is applied during
   * upgrade — before connect — while the shadow is still present, so its inbound write lands on the
   * shadow; but the constructor already CAPTURED the pre-upgrade property value, so the replay restores
   * the property over the attribute (property-wins, ADR-0005). See element-upgrade.test.ts.
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
   * lifetime, where there is no scope to own it — the GH #302 reentrancy window
   * (`beginConnecting`/`endConnecting`'s own banner above) keeps `#scope` LIVE for the whole
   * connectedCallback override chain regardless of a nested disconnect, so this throw stays a genuine
   * misuse signal (called truly outside the connected lifetime), never a false positive from that race.
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
   * Throws if called outside the connected lifetime, where there is no signal to bind to — see `effect()`'s
   * note on why the GH #302 reentrancy window does not weaken this into a false-positive risk.
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
