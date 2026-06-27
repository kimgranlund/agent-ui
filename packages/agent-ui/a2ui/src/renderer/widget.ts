// widget.ts — widget factory / catalog resolver (renderer LLD-C7, SPEC-R9).
//
// Resolves one A2UI component node to a live `ui-*` control: looks `node.component` up in the
// surface's bound catalog (via the `CatalogRegistry` — `get(catalogId)?.factories[type]`),
// instantiates the resolved `WidgetFactory`'s element, applies the static props, and installs a
// `surface.scope`-owned effect per bound (`{path}`) prop so a data-model change re-applies only that
// prop (SPEC-N2). The pointer walk itself is delegated to the injected binding resolver (LLD-C5).
// An unknown component type is NON-fatal: it emits `error{code:"CATALOG"}` and returns a placeholder
// element so sibling nodes still render (SPEC-R9 AC2). The resolver therefore ALWAYS returns an
// element — it never throws and never returns null.
//
// Collaborators are injected (the catalog registry, the error sink, the binding resolver) so this
// slice builds + tests against stubs in isolation; the renderer host (LLD-C13) wires the real
// registry/factories and the LLD-C5 resolver at integration. This module owns the produced
// `CreateWidget` (pinned in `./types.ts`); `makeCreateWidget` is its constructor.

import { effect } from '@agent-ui/components'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import type { CreateWidget } from './types.ts'
import type { Surface } from './surface.ts'

/** Structural adjacency keys (SPEC-R3/§5.1) — never catalog-declared props, so never applied. */
const RESERVED = new Set<string>(['id', 'component', 'child', 'children'])

/** A bound prop value: a JSON-Pointer reference rather than a literal (protocol `Binding`). */
const isBinding = (v: unknown): v is { path: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { path?: unknown }).path === 'string'

/**
 * Injected collaborators for widget resolution. Supplied by the renderer host (LLD-C13) at
 * integration; stubbed in isolation. Keeping them injected is what lets this slice build + test
 * decoupled from the catalog registry/factories and the binding resolver (LLD-C5) — all sibling
 * slices.
 */
export interface WidgetDeps {
  /** The bound-catalog registry: `get(catalogId)?.factories[type]` resolves a node's factory (LLD-C3). */
  registry: CatalogRegistry
  /** Sink for the non-fatal `CATALOG` error raised on an unknown component type (SPEC-R9 AC2). */
  emitError: (error: A2uiError) => void
  /**
   * Resolve a `{path}` binding to its current value off `surface.data` (renderer LLD-C5). Called
   * INSIDE a `surface.scope`-owned effect, so whatever reactive state it reads — the per-path
   * computed the resolver memoizes for SPEC-N2 — becomes that effect's dependency, and a data change
   * re-applies only the affected prop. Injected so this slice stays decoupled from `binding.ts`.
   */
  resolveBinding: (binding: { path: string }, surface: Surface) => unknown
}

/**
 * Build the pinned `createWidget` (renderer LLD-C7) over its injected collaborators. The returned
 * function resolves + instantiates the control for one node, or — on an unknown type — emits
 * `CATALOG` and returns a placeholder; it ALWAYS returns an element (non-fatal, SPEC-R9 AC2).
 */
export function makeCreateWidget(deps: WidgetDeps): CreateWidget {
  const { registry, emitError, resolveBinding } = deps

  return (node, surface) => {
    const factory = registry.get(surface.catalogId)?.factories[node.component]
    if (factory === undefined) {
      // Unknown component type — or, defensively, a catalog that vanished after createSurface's
      // CATALOG_UNKNOWN guard. Non-fatal: report + placeholder so sibling nodes still mount.
      emitError({
        code: 'CATALOG',
        surfaceId: surface.id,
        path: node.id,
        message: `unknown component type "${node.component}" in catalog "${surface.catalogId}"`,
      })
      return placeholder(node)
    }

    const el = factory.create()
    for (const [prop, value] of Object.entries(node)) {
      if (RESERVED.has(prop)) continue
      if (isBinding(value)) bindProp(el, factory, prop, value, surface, resolveBinding)
      else factory.applyProp(el, prop, value) // static literal → set once
    }
    return el
  }
}

/**
 * Install a `surface.scope`-owned effect that re-applies one bound prop whenever its resolved value
 * changes (renderer LLD-C7 + C5). Owning the effect in `surface.scope` means it dies with the
 * surface on `deleteSurface`, so the widget leaves no live subscriber (SPEC-N3).
 */
function bindProp(
  el: HTMLElement,
  factory: WidgetFactory,
  prop: string,
  binding: { path: string },
  surface: Surface,
  resolveBinding: WidgetDeps['resolveBinding'],
): void {
  surface.scope.run(() => {
    effect(() => {
      factory.applyProp(el, prop, resolveBinding(binding, surface))
    })
  })
}

/**
 * A non-fatal placeholder for an unresolved component type — an inert, unregistered
 * `<a2ui-placeholder>` carrying the offending id/type for diagnostics. Returned in place of the
 * control so the surrounding tree still renders (SPEC-R9 AC2).
 */
function placeholder(node: A2uiComponent): HTMLElement {
  const el = document.createElement('a2ui-placeholder')
  el.setAttribute('data-a2ui-placeholder', '')
  el.setAttribute('data-component', node.component)
  el.setAttribute('data-id', node.id)
  return el
}
