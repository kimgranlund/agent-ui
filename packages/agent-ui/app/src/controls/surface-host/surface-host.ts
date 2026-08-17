// surface-host.ts — UISurfaceHostElement, the M2 mount/stream seam (LLD-C1 · SPEC-R2/R3; ADR-0129 clause
// 1). BEHAVIOUR + props + self-define ONLY; the checkered-artboard geometry (promoted from
// site/lib/canvas-surface.css) lives in surface-host.css, the public contract in surface-host.md.
//
// Wraps exactly ONE @agent-ui/a2ui `RendererHost` per instance: builds its own light-DOM artboard pair — a
// `[data-part="stage"]` checkered box nesting a `[data-part="surface"]` translate-centered mount point,
// `site/lib/canvas-surface.ts`'s proven shape, promoted verbatim — at connect, mounts a fresh
// `createRenderer()` host into it, and exposes that host's own mount/stream seam as public imperative
// methods (`ingest`/`finalize`/`dispose`/`onClientMessage`/`setInteractiveDisabled`, GH #805). It NEVER
// calls a transport, holds a model/provider reference, or reads an API key — mount + stream only
// (ADR-0129 clause 1, SPEC-R2/R8).
//
// Standalone-usable (SPEC-R3): holds no reference to any `ui-conversation` ancestor, so it behaves
// identically composed directly into an app frame's persistent canvas (a2ui-live's re-hosted
// `ui-super-shell` shape, ADR-0156) or nested
// inline inside `ui-conversation`'s own per-surface registry (conversation.ts).
//
// Idempotent connect (the build-once idiom first established by the retired app-shell's
// `#ensureToggleParts`, ADR-0156): `connected()` re-runs on
// every reconnect, but the artboard + the ONE `RendererHost` are built only the FIRST time — a reconnect
// (e.g. a DOM reorder elsewhere in the tree) never mints a second host or a duplicate subtree.
//
// Deep-import guard (SPEC-R2 AC4): imports ONLY `createRenderer`/`RendererHost`/`ClientMessageListener`/
// `A2uiClientMessage` from the `@agent-ui/a2ui` PUBLIC barrel — never `packages/agent-ui/a2ui/tools/**`
// (the produce loop / `AgentTransport` types). A standing grep in surface-host.test.ts guards this.
//
// GH #805 — answered cards disable their inputs. On ANY outbound `action` client-message this surface
// emits, every interactive descendant (button/checkbox/radio group/select/text-field/slider/combo-box/
// calendar/color-picker/multi-select/range — the fleet's WHOLE `disabled`-bearing set, duck-typed, never
// a hardcoded tag list) disables immediately — self-wired at connect (`#host.onClientMessage`,
// registered BEFORE any external `onClientMessage(cb)` a consumer adds, so it always sees the action
// first) — a proper answered-history posture, AND the double-submit guard for free (the disabled
// controls themselves make a second click inert; no extra bookkeeping needed). `ingest()` re-enables
// unconditionally on entry: a NEW line for this surface IS the model re-engaging this card (an in-place
// `updateComponents` re-render, TKT-0079's game loop) — "comes back live" by construction, never by
// inspecting WHAT the line changed. An ask-declared surface (GH #802/#803) never receives another line
// by contract, so it never re-enables this way — it stays disabled as history, exactly the wanted shape.
// The one caller-driven arm this element cannot own itself — a FAILED/aborted turn's re-enable — is the
// public `setInteractiveDisabled(false)` method below; `ui-conversation`'s `AgentTurnHandle.fail()` is
// the one shipped caller (conversation.ts).
//
// GH #805 repair (independent component-checker, PR #809) — two load-bearing narrowings the first cut
// missed:
// (a) ADR-0088 §3's `wantResponse:false` opt-out (an action that runs NO turn at all — a2ui-chat.ts/
//     a2ui-live.ts both return before ever calling `beginAgentTurn`; the seed shelf's own
//     `catalog-frontier.ts` Cancel button is exactly this shape) must never disable in the first place —
//     nothing downstream will EVER re-enable a card no turn is running for.
// ADR-0187 / GH #829 clause 6 — the TERMINAL-EMPTY presentational brace. The validator is the sole
// JUDGE of emptiness (SPEC-N6's one-implementation law), and `ui-conversation` must never re-implement
// that judgment. But the SYMPTOM is presentational, and the server-side opt-in (produce.ts) only protects
// produce-driven streams — a recorded transcript, the A2A bridge, or any third-party producer still
// reaches a mounted host raw. So this element flips a host-owned `data-empty-final` state at `finalize()`
// when its mount point never received a single element: a read of its OWN already-held facts (finalize
// happened + nothing is mounted), NOT a re-validation, and NOT a second verdict. CSS swaps the
// anticipatory `:empty` placeholder ("The rendered surface appears here.") for a terminal message. The
// host stays MOUNTED and addressable — a later turn legitimately targets a known surfaceId through
// `routeLine`'s known branch (SPEC-R7), which unmounting would break — and `ingest()` clears the state,
// so a real update arriving later returns the host to normal. Defer-mount and unmount-at-finalize are
// the ADR's recorded rejected alternatives.
//
// (b) the payload can declare a component's `disabled` LITERAL (the default catalog's ~10 bindable rows,
//     `catalog/default/factories.ts`), and the renderer's OWN checks controller (`checks.ts`) drives
//     `el.disabled` from live validity, restoring the declared literal on pass. A blanket re-enable would
//     force BOTH kinds live regardless of what they ought to be. `#sweepDisabled` (a `WeakSet`) remembers
//     exactly which elements THIS sweep is the one that flipped false→true — re-enable ever only touches
//     those; an element already disabled for a payload/checks reason when the sweep ran is never added,
//     so it is never touched on the way back either.

import { UIContainerElement, UIElement, prop, withViewTransition, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, ClientMessageListener, A2uiClientMessage } from '@agent-ui/a2ui'

export type { ClientMessageListener, A2uiClientMessage }

const props = {
  // An OPTIONAL accessible name for the artboard region — purely cosmetic when unset. Meaningful only
  // when this element is composed standalone (e.g. a2ui-live's Canvas tab panel); `ui-conversation`'s
  // inline usage never sets it — the surrounding turn bubble already carries the accessible structure.
  label: { ...prop.string(''), reflect: true },
  // TKT-0084: opt-in content-hugging artboard, default false (zero behavior change for existing
  // consumers — a2ui-live's persistent Canvas tab panel keeps the always-fill-the-container default).
  // A pure CSS hook (`[wrap]`, surface-host.css) — no JS behavior beyond reflection; the anatomy switch
  // (absolute+translate centering → in-flow flex centering) lives entirely in the stylesheet.
  wrap: { ...prop.boolean(), reflect: true },
  // GH #241: opt-in CHROMELESS mount, default false (zero behavior change for existing consumers — the
  // docs site's preview/canvas surfaces keep the checkered artboard affordance). Kim's ruling: on the
  // chat path the A2UI render surface gets NO background, NO padding, and FULL available width — the
  // rendered payload's own components carry their chrome; this host wrapper is invisible. A pure CSS
  // hook (`[bare]`, surface-host.css) — no JS behavior beyond reflection; composes with `wrap`
  // (ui-conversation sets BOTH on every surface it mounts inline in a bubble).
  bare: { ...prop.boolean(), reflect: true },
  // GH #742/ADR-0183 Amendment — opt-in View Transitions on RE-RENDERS: once this host has settled
  // once (its first finalize()), every later ingest()/finalize() wraps in `withViewTransition` (a
  // root cross-fade over the update burst — the platform skips superseded transitions, so a burst
  // shows at most ~one fade, and the spec's FIFO update-callback queue keeps every line in order).
  // Pre-settle streaming NEVER transitions — progressive first paint is the surface's whole value.
  // Default false / no API / reduced motion: byte-identical to the pre-#742 host (the family law).
  viewTransitions: { ...prop.boolean(false), reflect: true, attribute: 'view-transitions' },
  // ADR-0199 / GH #1104 — the fleet-wide live-surface-mutation state: `true` while an in-flight
  // producer turn is mutating THIS surface in place. Mirrored into `:state(working)` by the
  // connected() effect below (the ADR-0196 `answered` pattern); the breathing treatment itself is
  // pure CSS (surface-host.css). Presentation-only — never touches ARIA/disabled/tabbable. The
  // shipped flipper is `ui-conversation`'s turn handle (set on route, cleared at the guarded
  // endTurn — finalize() AND fail() both clear); a host app driving this element directly may set
  // it itself (the ADR-0191 cl.4 restraint: the fleet law fixes the state name, tokens, and
  // treatment — not who flips it).
  working: { ...prop.boolean(), reflect: true },
} satisfies PropsSchema

export interface UISurfaceHostElement extends ReactiveProps<typeof props> {}
export class UISurfaceHostElement extends UIElement {
  static props = props

  #host: RendererHost | undefined
  #surface: HTMLElement | undefined
  #warnedPreConnect = false
  // GH #742/ADR-0183 Amendment — the re-render detector: flipped by the FIRST finalize(); every
  // ingest() after it is a mutation of an already-painted surface (the grain worth a cross-fade),
  // every one before it is first-paint streaming (never wrapped). Reset on disconnect — a reconnect
  // rebuilds a fresh, empty artboard (below), so its next stream is a first paint again.
  #settledOnce = false

  // GH #805 — cheap common-case skip: most surfaces never have an action fire, so `ingest()`'s
  // unconditional re-enable call would otherwise walk the WHOLE mounted subtree on every streamed line
  // for nothing. Set true the moment `#applyInteractiveDisabled(true)` runs; only a `true` value ever
  // triggers the (cheap, but non-zero) walk on the way back to `false`.
  #interactiveDisabledActive = false

  // GH #805 repair — the elements THIS sweep's disable pass flipped false→true (never an
  // already-payload/checks-disabled element, which the sweep leaves untouched, below). Re-enable ever
  // only reverts membership here — a `WeakSet` so a torn-down element is never leak-held.
  #sweepDisabled = new WeakSet<Element>()

  protected connected(): void {
    if (this.#host === undefined) {
      const stage = document.createElement('div')
      stage.dataset.part = 'stage'
      const surface = document.createElement('div')
      surface.dataset.part = 'surface'
      stage.append(surface)
      this.append(stage)
      this.#surface = surface
      this.#host = createRenderer()
      this.#host.mount(surface)
      // GH #805 — the self-wired disable-on-action listener (see the file-header note). Registered
      // BEFORE any consumer's own `onClientMessage(cb)` call (this element's own connect-time setup runs
      // first, by construction), so the `RendererHost`'s listener `Set` always calls this one first.
      this.#host.onClientMessage((message) => {
        // GH #805 repair — ADR-0088 §3: `wantResponse:false` is the agent's explicit "no turn will ever
        // run for this" declaration (a fire-and-forget action, e.g. a Cancel button). Disabling for one
        // would strand the card forever — nothing downstream ever calls back to re-enable it.
        if ('action' in message && message.action.wantResponse !== false) this.#applyInteractiveDisabled(true)
      })
    }

    // ARIA via internals only, never a host attribute. A `region` role is meaningful only paired with a
    // real accessible name — an unlabelled artboard gets no role at all (a landmark with no name is noise
    // to assistive tech, not a courtesy).
    // ADR-0199 — mirror the `working` prop into `:state(working)` (optional-chained: jsdom may lack
    // CustomStateSet; the real-engine proof is the browser smoke). Presentation-only.
    this.effect(() => {
      if (this.working) this.internals.states?.add('working')
      else this.internals.states?.delete('working')
    })

    this.effect(() => {
      if (this.label === '') {
        this.internals.role = null
        this.internals.ariaLabel = null
      } else {
        this.internals.role = 'region'
        this.internals.ariaLabel = this.label
      }
    })
  }

  /** One validated A2UI JSONL line → progressive paint (SPEC-R2). A documented no-op pre-connect.
   *  GH #742/ADR-0183 Amendment: under the `viewTransitions` opt-in, a line arriving AFTER the host
   *  settled once (a re-render of an already-painted surface) applies inside `withViewTransition`;
   *  first-paint streaming stays synchronous, always. `enabled` is evaluated per call — a
   *  reduced-motion/API flip mid-burst could run a later line sync past a queued earlier one, the
   *  amendment's one accepted (sub-second, not a real operating condition) edge. */
  ingest(line: string): void {
    if (!this.#guard('ingest')) return
    // GH #805 — a new line for THIS surface is the model re-engaging this card: re-enable un-
    // conditionally, on entry, before applying it. Never inspects what the line changes — "comes back
    // live" is a property of a NEW update arriving at all (TKT-0079's in-place game loop), not of which
    // component ids it happens to touch (a resumed reply may re-wire only SOME of the tree, `rewireNode`'s
    // identity-preserving reconcile — the OLD disabled elements it does not touch must still come back).
    this.#applyInteractiveDisabled(false)
    // ADR-0187 — a NEW line for this surface retires any terminal-empty verdict: whatever this line
    // turns out to contain, the stream is demonstrably not over. Cleared on ENTRY (before the ingest, and
    // before the async transition path could reorder it) for the same reason the re-enable above is —
    // "the model came back" is a property of a line arriving at all, never of what it changed. The next
    // finalize() re-derives the state from the mount's real contents, so a still-empty surface re-flags.
    delete this.dataset.emptyFinal
    withViewTransition(() => {
      // The helper's stated caveat: the transition path runs this ASYNC — a disconnect between queue
      // and run nulls #host (below), so the staleness re-check lives INSIDE the mutate (ADR-0183 cl.1).
      this.#host?.ingest(line)
    }, this.viewTransitions && this.#settledOnce)
  }

  /** End of a batch: forwards to the `RendererHost`, then stretches the root to fill the artboard
   *  (`applyRootStretch` — GH #892 broadened this from the `canvas-surface.ts` embryo's ui-column-only
   *  check to every layout-primitive root; see the method body). A no-op pre-connect.
   *  GH #742/ADR-0183 Amendment: on a re-render (settled once, opted in) this rides the SAME
   *  `withViewTransition` channel the wrapped ingest() lines queued through — the spec's FIFO
   *  update-callback queue is what keeps the validator + root-stretch BEHIND the last queued
   *  mutation (a sync call here would validate a half-applied surface). The first finalize() runs
   *  synchronously (nothing queued before it, by construction) and flips the settled flag AFTER
   *  its own forward — the flip itself is never inside the wrap.
   *
   *  ADR-0187/GH #829: also derives the terminal-empty state (see the file-header note) — INSIDE the same
   *  wrapped callback, AFTER `#host.finalize()`, so it reads the mount's settled contents rather than a
   *  half-applied surface (the same FIFO-ordering reason the root-stretch read lives here). */
  finalize(): void {
    if (!this.#guard('finalize')) return
    withViewTransition(() => {
      // Same staleness re-check as ingest() — a disconnect between queue and run nulls both refs.
      if (this.#host === undefined || this.#surface === undefined) return
      this.#host.finalize()
      const root = this.#surface.firstElementChild
      // GH #892 — a rendered surface should fill the artboard's available width, root INCLUDED, not just
      // its (already-stretching-by-default, ADR-0030) descendants. `ui-column` owns a dedicated `stretch`
      // PROP (ADR-0016/ADR-0030 — a reflected, semantic opt-in, not an implementation detail) so it gets
      // the attribute below unchanged. The sibling layout primitives (ui-row/ui-card/ui-list/ui-grid, …)
      // carry no equivalent prop of their own — `UIContainerElement` is the exact "layout primitive, not
      // an intrinsic control" discriminator the fleet already draws (row/column/card/list/grid all extend
      // it; button/badge/pill/etc. extend `UIElement` directly), so an imperative `align-self: stretch` on
      // the mounted instance is the width-fill for those without minting a `stretch` prop on each. A root
      // that is an intrinsic control (e.g. a lone Button) is untouched by either branch and keeps its own
      // natural width — the GH #892 acceptance's named exception.
      if (root && root.tagName.toLowerCase() === 'ui-column') root.setAttribute('stretch', '')
      else if (root instanceof UIContainerElement) root.style.alignSelf = 'stretch'
      // ADR-0187 — the host's OWN facts, read once the surface has settled: finalize happened, and the
      // mount point holds no element. Presentation of a state already established, never a re-judgment
      // (`root === null` here IS "no root ever attached" — the renderer appends exactly one root element
      // per surface, and nothing else ever writes into this box).
      if (root === null) this.dataset.emptyFinal = ''
      else delete this.dataset.emptyFinal
    }, this.viewTransitions && this.#settledOnce)
    this.#settledOnce = true
  }

  /** Tears down the `RendererHost` — idempotent-safe (mirrors `RendererHost.dispose()`'s own contract: a
   *  second call is a no-op). A no-op pre-connect. Also fired automatically on disconnect (below) — a
   *  consumer removing this element from the DOM is never required to call this explicitly to avoid a leak. */
  dispose(): void {
    if (!this.#guard('dispose')) return
    this.#host!.dispose()
  }

  /** Leak-safety net (the select.ts/text-field.ts "heavyweight per-connection resource" precedent, this
   *  fleet's standing discipline): a consumer that removes this element WITHOUT calling `dispose()` itself
   *  must not leak the `RendererHost`'s signals/listeners/surface scopes — disconnect disposes it exactly
   *  as an explicit `dispose()` call would. Also nulls the internal references and clears the (now-torn-
   *  down) stage/surface subtree, so a LATER reconnect rebuilds a fresh, empty artboard via `connected()`'s
   *  own build-guard rather than staying a permanently-dead husk. */
  protected override disconnected(): void {
    this.#host?.dispose()
    this.#host = undefined
    this.#surface = undefined
    this.#settledOnce = false // GH #742 — a rebuilt artboard's next stream is a first paint again
    this.#interactiveDisabledActive = false // GH #805 — a rebuilt artboard's next mount starts live
    this.#sweepDisabled = new WeakSet() // GH #805 — the torn-down subtree's claims are moot
    delete this.dataset.emptyFinal // ADR-0187 — a rebuilt artboard has not finalized anything yet
    this.replaceChildren()
  }

  /** GH #805 — the caller-driven re-enable arm: a failed/aborted turn re-enables this card's controls
   *  even though it never sent another line (the ONE thing this element cannot know on its own — whether
   *  the app's own transport call that the emitted `action` started ultimately succeeded or failed). Also
   *  usable to force-disable from OUTSIDE an action click (a consumer's own busy/availability gate), though
   *  the shipped fleet never needs that arm — the self-wired listener above already covers every real
   *  click. A no-op pre-connect (the documented `#guard` idiom, matching `ingest`/`finalize`/`dispose`). */
  setInteractiveDisabled(disabled: boolean): void {
    if (!this.#guard('setInteractiveDisabled')) return
    this.#applyInteractiveDisabled(disabled)
  }

  /** Walks the mounted subtree and sets every interactive descendant's OWN `disabled` prop — duck-typed
   *  (`'disabled' in el`), never a hardcoded tag list, so any control the catalog resolves to (today:
   *  ui-button/ui-checkbox/ui-radio-group/ui-select/ui-text-field/ui-slider/ui-combo-box/ui-calendar/
   *  ui-color-picker/ui-multi-select/ui-range — the fleet's whole `disabled`-bearing set) participates,
   *  and a FUTURE one grown a `disabled` prop participates for free. Each control's own reactive effect
   *  chain does the rest (tabbable/aria-disabled/`:state(disabled)` — this never touches ARIA or a host
   *  attribute directly, only the control's typed prop, same as any consumer calling `el.disabled = true`
   *  would). The `#interactiveDisabledActive` guard makes the common case (never disabled) an O(1) no-op
   *  — most `ingest()` calls have nothing to re-enable.
   *
   *  GH #805 repair — NOT a blanket flip. On disable, an element ALREADY disabled (a payload-declared
   *  literal, or the checks controller's own validity-driven disable, `renderer/checks.ts`) is left
   *  alone and never remembered — the sweep only claims elements it is genuinely the one disabling
   *  (false→true). On re-enable, only CLAIMED elements revert; a payload/checks-owned disabled element
   *  stays exactly as it was, regardless of whether this is the `ingest()` re-render arm or the `fail()`
   *  arm — in the `ingest()` case the real payload/checks pass that follows (inside the same call, just
   *  after this) is what actually re-derives the right state for those, never this sweep. */
  #applyInteractiveDisabled(disabled: boolean): void {
    if (this.#surface === undefined) return
    if (disabled) this.#interactiveDisabledActive = true
    else if (!this.#interactiveDisabledActive) return
    else this.#interactiveDisabledActive = false
    for (const el of this.#surface.querySelectorAll('*')) {
      if (!('disabled' in el)) continue
      const control = el as unknown as { disabled: boolean }
      if (disabled) {
        if (control.disabled) continue // already disabled for a reason that isn't ours — not our claim
        control.disabled = true
        this.#sweepDisabled.add(el)
      } else if (this.#sweepDisabled.has(el)) {
        control.disabled = false
        this.#sweepDisabled.delete(el)
      }
    }
  }

  /** Registers a callback for outbound client messages (actions/responses/errors) the mounted surface
   *  emits — a callback, NEVER a `CustomEvent` (the shipped `RendererHost.onClientMessage` precedent;
   *  SPEC-R5's callback-not-event rationale applies identically here). A no-op pre-connect. */
  onClientMessage(cb: ClientMessageListener): void {
    if (!this.#guard('onClientMessage')) return
    this.#host!.onClientMessage(cb)
  }

  /** `true` once connected (a live `#host` exists); else warns ONCE (across every method, not per-method)
   *  and returns `false` — a documented no-op, never a throw (the warn-once idiom first established on
   *  the retired `ui-app-shell`'s connect-time-only `isolated`, ADR-0156). */
  #guard(method: string): boolean {
    if (this.#host !== undefined) return true
    if (!this.#warnedPreConnect) {
      this.#warnedPreConnect = true
      console.warn(`<ui-surface-host>: .${method}() called before connect — no RendererHost exists yet; this call is a no-op.`)
    }
    return false
  }
}

if (!customElements.get('ui-surface-host')) customElements.define('ui-surface-host', UISurfaceHostElement)
