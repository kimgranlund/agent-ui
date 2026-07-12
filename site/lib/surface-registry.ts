// surface-registry.ts — a2ui-chat LLD-C2 (SPEC-R3/R4): the per-surface renderer-host lifecycle the chat
// page (`a2ui-chat.ts`) routes every ingested line through. Generalizes `ask-registry.ts`'s `AskRegistry`
// (ADR-0097 §2, "asks only") to EVERY surface a turn creates — no turn needs to be flagged as an "ask" for
// its surface to persist across later turns (a2ui-chat.spec.md's own non-goal: the `ask`/`AskDeclaration`
// field stays unused here).
//
// One `createRenderer()` host per surfaceId, mounted into THAT surface's own creating bubble — forced by
// `RendererHost.mount(rootEl)`'s one-mount-per-host construction (`renderer/renderer.ts`'s `#attachRoot`:
// every surface a host knows attaches as a SIBLING under the SAME mount point), verified against source,
// not assumed. A chat log wanting surface X's DOM anchored at turn X's bubble and surface Y's DOM anchored
// at turn Y's bubble therefore needs one host per surface, never one shared host for the whole session
// (a2ui-live.ts's model — the DIFFERENT need that page has, a single shared canvas).
//
// Deliberately narrower than `AskRegistry` (a2ui-chat.lld.md §3): no `pending()`/at-most-one invariant
// (every surface is tracked independently, not one at a time) and one state literal (`'open' | 'closed'`,
// not `'pending' | 'answered' | 'bypassed'` — a delivered surface stays interactive the whole time it is
// open; there is no "answered vs bypassed" distinction here, only "open vs deleted"). Unlike `AskEntry`,
// `SurfaceEntry` retains its own `mount: HTMLElement` field — `close()` needs it to tear down that
// surface's own subtree without the caller re-supplying it (LLD §5).
//
// This module owns NO page-specific chat markup — the caller supplies an already-built `bubble` element
// (the page's own CSS/ARIA is its concern) and a `mount` inside it for the surface to render into. That
// keeps the lifecycle mechanism testable in isolation from the transport/routing pipeline it never depends
// on (it consumes only the renderer's public seams, ADR-0023 — the `ask-registry.ts` precedent, verbatim).

import { createRenderer } from '@agent-ui/a2ui'
import type { RendererHost, ClientMessageListener } from '@agent-ui/a2ui'

export type SurfaceState = 'open' | 'closed'

export interface SurfaceEntry {
  readonly surfaceId: string
  readonly host: RendererHost
  readonly bubble: HTMLElement
  readonly mount: HTMLElement
  state: SurfaceState
}

/**
 * The per-surface lifecycle registry (a2ui-chat.lld.md LLD-C2). Keyed by `surfaceId`; entries persist
 * after closing (never removed by `close()` itself) so a later line targeting a closed id can still be
 * recognized as KNOWN — `disposeAll()` (Reset) is the only thing that clears entries.
 */
export class SurfaceRegistry {
  readonly #entries = new Map<string, SurfaceEntry>()

  /**
   * Mount a FRESH host into `mount` (inside `bubble`) and register it `'open'`. Throws if `surfaceId` is
   * already known — the caller (the line router, LLD-C3) MUST check `has()` first; this class never
   * silently replaces an existing entry (the `AskRegistry.create` precedent, verbatim).
   */
  create(surfaceId: string, bubble: HTMLElement, mount: HTMLElement, onClientMessage: ClientMessageListener): SurfaceEntry {
    if (this.#entries.has(surfaceId)) {
      throw new Error(`SurfaceRegistry.create: surfaceId "${surfaceId}" is already known — collision-guard before calling`)
    }
    const host = createRenderer()
    host.onClientMessage(onClientMessage)
    host.mount(mount)
    const entry: SurfaceEntry = { surfaceId, host, bubble, mount, state: 'open' }
    this.#entries.set(surfaceId, entry)
    return entry
  }

  get(surfaceId: string): SurfaceEntry | undefined {
    return this.#entries.get(surfaceId)
  }

  /** `true` iff `surfaceId` is a KNOWN entry (open or closed) — the collision-guard / routing predicate. */
  has(surfaceId: string): boolean {
    return this.#entries.has(surfaceId)
  }

  /**
   * Dispose that ONE surface's host (tears down its mount's DOM) and annotate its bubble "Closed." — a
   * no-op (`false`) on an unknown or already-closed id, so closing is idempotent and never re-fires the
   * annotation twice (the `AskRegistry.freeze` idempotency precedent). The bubble stays in the DOM as
   * VISIBLE history (never removed) — deletion is a visible annotation, never a silent disappearance
   * (SPEC-R4).
   */
  close(surfaceId: string): boolean {
    const entry = this.#entries.get(surfaceId)
    if (entry === undefined || entry.state === 'closed') return false
    entry.host.dispose()
    entry.state = 'closed'
    entry.bubble.dataset.state = 'closed'
    const note = document.createElement('p')
    note.className = 'surface-annotation'
    note.textContent = 'Closed.'
    entry.bubble.append(note)
    return true
  }

  /** Dispose every surface host and drop every entry (Reset). Unconditional — `dispose()` is idempotent-safe
   *  to call again on an already-closed entry's host (the `AskRegistry.disposeAll` precedent). */
  disposeAll(): void {
    for (const entry of this.#entries.values()) entry.host.dispose()
    this.#entries.clear()
  }

  /** The number of known entries (open + closed) — test/lifetime visibility. */
  get size(): number {
    return this.#entries.size
  }
}
