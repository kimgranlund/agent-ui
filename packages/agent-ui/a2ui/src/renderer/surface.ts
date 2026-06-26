// surface.ts — surface model + lifetime discipline (renderer LLD-C3, SPEC-R2/N3).
//
// One surface = one ownership **scope** (kernel `createScope()`) + one `AbortController`, mirroring
// `UIElement`'s lifetime discipline so teardown is provably leak-free. This is the first a2ui module
// to use the `@agent-ui/components` reactive kernel — the surface data model is one `signal`, and
// every binding effect (LLD-C5, not in this slice) is created inside `scope` so a single
// `scope.dispose()` provably unsubscribes them all (SPEC-N3, asserted via the kernel's `inspect()`).
//
// Out of this slice (the renderer host, LLD-C13, owns it): resolving `catalogId` against the catalog
// registry to raise `CATALOG_UNKNOWN` (SPEC-R2 AC3, invariant iii) happens upstream before `create`.

import { createScope, signal } from '@agent-ui/components'
import type { Scope, Signal } from '@agent-ui/components'
import type { A2uiComponent } from '../protocol.ts'

/** A live surface: isolated UI context keyed by `id`, bound to one catalog (renderer LLD §2). */
export interface Surface {
  id: string
  catalogId: string
  version: string
  surfaceProperties?: object
  sendDataModel: boolean
  components: Map<string, A2uiComponent> // raw, buffered by id (SPEC-R3); populated by tree.ts
  data: Signal<unknown> // the one surface data model (SPEC-R5); all bindings are computeds over it (N2)
  scope: Scope // owns every binding effect; dispose() on teardown
  ac: AbortController // owns every DOM listener; abort() on teardown
  widgets: Map<string, HTMLElement> // id → live control; populated by widget.ts
}

/** The fields needed to stand up a surface (from `createSurface`, SPEC-R2; `version` off the envelope). */
export interface SurfaceInit {
  id: string
  catalogId: string
  version: string
  surfaceProperties?: object
  sendDataModel?: boolean
}

/** Build a surface with a fresh scope, AbortController, one data signal, and empty buffers. */
export function createSurface(init: SurfaceInit): Surface {
  const surface: Surface = {
    id: init.id,
    catalogId: init.catalogId,
    version: init.version,
    sendDataModel: init.sendDataModel ?? false,
    components: new Map(),
    data: signal<unknown>(undefined),
    scope: createScope(),
    ac: new AbortController(),
    widgets: new Map(),
  }
  if (init.surfaceProperties !== undefined) surface.surfaceProperties = init.surfaceProperties
  return surface
}

/**
 * Release a surface's reactive + DOM resources: `scope.dispose()` unsubscribes every binding effect
 * (→ 0 live signal subscribers) and `ac.abort()` removes every listener registered with its signal
 * (→ 0 live listeners). The leak-free teardown invariant, SPEC-N3.
 */
export function disposeSurface(surface: Surface): void {
  surface.scope.dispose()
  surface.ac.abort()
}

/**
 * Keyed surface set (SPEC-R2: create/delete a surface by `surfaceId`). The renderer host (LLD-C13)
 * drives this from the message stream; it is the single owner of surface lifetimes, so `delete`/
 * `disposeAll` are the only paths that release a surface — keeping teardown provably leak-free.
 */
export class SurfaceStore {
  readonly #surfaces = new Map<string, Surface>()

  /** Create a surface for `init.id`. A pre-existing surface with that id is disposed first (no leak). */
  create(init: SurfaceInit): Surface {
    const prior = this.#surfaces.get(init.id)
    if (prior) disposeSurface(prior)
    const surface = createSurface(init)
    this.#surfaces.set(init.id, surface)
    return surface
  }

  get(id: string): Surface | undefined {
    return this.#surfaces.get(id)
  }

  has(id: string): boolean {
    return this.#surfaces.has(id)
  }

  /** Dispose + forget the surface; returns false if `id` was unknown (late message → no-op). */
  delete(id: string): boolean {
    const surface = this.#surfaces.get(id)
    if (!surface) return false
    disposeSurface(surface)
    this.#surfaces.delete(id)
    return true
  }

  /** Dispose every surface (renderer disposal, SPEC-N3). */
  disposeAll(): void {
    for (const surface of this.#surfaces.values()) disposeSurface(surface)
    this.#surfaces.clear()
  }

  get size(): number {
    return this.#surfaces.size
  }
}
