// surface-host.ts — UISurfaceHostElement, the M2 mount/stream seam (LLD-C1 · SPEC-R2/R3; ADR-0129 clause
// 1). BEHAVIOUR + props + self-define ONLY; the checkered-artboard geometry (promoted from
// site/lib/canvas-surface.css) lives in surface-host.css, the public contract in surface-host.md.
//
// Wraps exactly ONE @agent-ui/a2ui `RendererHost` per instance: builds its own light-DOM artboard pair — a
// `[data-part="stage"]` checkered box nesting a `[data-part="surface"]` translate-centered mount point,
// `site/lib/canvas-surface.ts`'s proven shape, promoted verbatim — at connect, mounts a fresh
// `createRenderer()` host into it, and exposes that host's own mount/stream seam as public imperative
// methods (`ingest`/`finalize`/`dispose`/`onClientMessage`). It NEVER calls a transport, holds a model/
// provider reference, or reads an API key — mount + stream only (ADR-0129 clause 1, SPEC-R2/R8).
//
// Standalone-usable (SPEC-R3): holds no reference to any `ui-conversation` ancestor, so it behaves
// identically composed directly into a `ui-app-shell-region` (a2ui-live's persistent canvas) or nested
// inline inside `ui-conversation`'s own per-surface registry (conversation.ts).
//
// Idempotent connect (the `app-shell-region.ts` `#ensureToggleParts` precedent): `connected()` re-runs on
// every reconnect, but the artboard + the ONE `RendererHost` are built only the FIRST time — a reconnect
// (e.g. a DOM reorder elsewhere in the tree) never mints a second host or a duplicate subtree.
//
// Deep-import guard (SPEC-R2 AC4): imports ONLY `createRenderer`/`RendererHost`/`ClientMessageListener`/
// `A2uiClientMessage` from the `@agent-ui/a2ui` PUBLIC barrel — never `packages/agent-ui/a2ui/tools/**`
// (the produce loop / `AgentTransport` types). A standing grep in surface-host.test.ts guards this.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'
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
} satisfies PropsSchema

export interface UISurfaceHostElement extends ReactiveProps<typeof props> {}
export class UISurfaceHostElement extends UIElement {
  static props = props

  #host: RendererHost | undefined
  #surface: HTMLElement | undefined
  #warnedPreConnect = false

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
    }

    // ARIA via internals only, never a host attribute. A `region` role is meaningful only paired with a
    // real accessible name — an unlabelled artboard gets no role at all (a landmark with no name is noise
    // to assistive tech, not a courtesy).
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

  /** One validated A2UI JSONL line → progressive paint (SPEC-R2). A documented no-op pre-connect. */
  ingest(line: string): void {
    if (!this.#guard('ingest')) return
    this.#host!.ingest(line)
  }

  /** End of a batch: forwards to the `RendererHost`, then stretches a root `ui-column` to fill the
   *  artboard (`applyRootStretch`, unchanged from the `canvas-surface.ts` embryo). A no-op pre-connect. */
  finalize(): void {
    if (!this.#guard('finalize')) return
    this.#host!.finalize()
    const root = this.#surface!.firstElementChild
    if (root && root.tagName.toLowerCase() === 'ui-column') root.setAttribute('stretch', '')
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
    this.replaceChildren()
  }

  /** Registers a callback for outbound client messages (actions/responses/errors) the mounted surface
   *  emits — a callback, NEVER a `CustomEvent` (the shipped `RendererHost.onClientMessage` precedent;
   *  SPEC-R5's callback-not-event rationale applies identically here). A no-op pre-connect. */
  onClientMessage(cb: ClientMessageListener): void {
    if (!this.#guard('onClientMessage')) return
    this.#host!.onClientMessage(cb)
  }

  /** `true` once connected (a live `#host` exists); else warns ONCE (across every method, not per-method)
   *  and returns `false` — a documented no-op, never a throw (mirrors `ui-app-shell`'s connect-time-only
   *  `isolated` precedent). */
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
