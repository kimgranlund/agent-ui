// widget.ts — widget factory / catalog resolver (renderer LLD-C7, SPEC-R9).
//
// Resolves one A2UI component node to a live `ui-*` control: looks `node.component` up in the
// surface's bound catalog (via the `CatalogRegistry` — `get(catalogId)?.factories[type]`),
// instantiates the resolved `WidgetFactory`'s element, applies the static props, installs a
// `surface.scope`-owned effect per bound (`{path}`) prop so a data-model change re-applies only that
// prop (SPEC-N2), and — for an input widget — wires the reverse direction via the generic two-way input
// controller (`installInputBinding`, LLD-C8/ADR-0019) so a committed value flows control→data. The pointer
// walk itself is delegated to the injected binding resolver (LLD-C5).
// An unknown component type is NON-fatal: it emits `error{code:"CATALOG"}` and returns a placeholder
// element so sibling nodes still render (SPEC-R9 AC2). The resolver therefore ALWAYS returns an
// element — it never throws and never returns null.
//
// Collaborators are injected (the catalog registry, the error sink, the binding resolver) so this
// slice builds + tests against stubs in isolation; the renderer host (LLD-C13) wires the real
// registry/factories and the LLD-C5 resolver at integration. This module owns the produced
// `CreateWidget` (pinned in `./types.ts`); `makeCreateWidget` is its constructor.

import { effect } from '@agent-ui/components'
import type { Scope } from '@agent-ui/components'
import type { A2uiComponent, A2uiError, FunctionCall } from '../protocol.ts'
import type { CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import type { CreateWidget, ItemScope } from './types.ts'
import type { Surface } from './surface.ts'
import { installInputBinding } from './input.ts'

/** Structural adjacency keys (SPEC-R3/§5.1) — never catalog-declared props, so never applied. */
const RESERVED = new Set<string>(['id', 'component', 'child', 'children'])

/**
 * A dynamic binding value — either a `{path}` data-model reference or a `{call}` function call
 * (ADR-0026 three-armed Binding union). Both are deferred-resolution: they need the scope-owned
 * bound-prop effect and `resolveValue` to produce a render value; a static literal falls through
 * to the `else` branch and is `applyProp`'d once. The `{path}` arm is the existing LLD-C5 path;
 * the `{call}` arm is the new LLD-C10 evaluator path (ADR-0026).
 */
const isBinding = (v: unknown): v is { path: string } | FunctionCall =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  (typeof (v as { path?: unknown }).path === 'string' ||
   typeof (v as { call?: unknown }).call === 'string')

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
   * Resolve any binding value (literal | `{path}` | `{call}`) to its current render value
   * (ADR-0026 LLD-C10 / LLD-C5). Called INSIDE the scope-owned bound-prop effect so that
   * reactive deps from `{path}` args (inside a `{call}` or at the top level) are tracked —
   * a data-model change re-applies only the affected prop (SPEC-N2). `itemScope`, when present
   * (a dynamic-list item, LLD-C6/ADR-0024), threads the collection-scope context for `@index`
   * and relative-path resolution. Injected so this slice stays decoupled from `binding.ts` /
   * `functions.ts` and can be stubbed in isolation tests.
   */
  resolveValue: (value: unknown, surface: Surface, itemScope?: ItemScope) => unknown
}

/**
 * Build the pinned `createWidget` (renderer LLD-C7) over its injected collaborators. The returned
 * function resolves + instantiates the control for one node, or — on an unknown type — emits
 * `CATALOG` and returns a placeholder; it ALWAYS returns an element (non-fatal, SPEC-R9 AC2).
 */
export function makeCreateWidget(deps: WidgetDeps): CreateWidget {
  const { registry, emitError, resolveValue } = deps

  return (node, surface, scope = surface.scope, itemScope, ac = surface.ac) => {
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
      if (isBinding(value)) bindProp(el, factory, prop, value, surface, resolveValue, scope, itemScope)
      else factory.applyProp(el, prop, value) // static literal → set once
    }
    // Two-way input binding (renderer LLD-C8, ADR-0019). Wired here — right after the data→control props are
    // applied, with `el`/`factory`/`node`/`surface` all in scope — so a control marked `value:{prop,event}`
    // (Tabs `selected`/`select`, Modal `open`/`toggle`, the back-filled TextField `value`/`change`) commits
    // its value BACK into surface.data on its commit event. For a list item, `itemScope` threads through so
    // the writeback resolves the same absolute pointer as the read (ADR-0024 amendment, symmetric rewrite);
    // `ac` threads the per-item AbortController so the listener is removed on item removal (SPEC-N3).
    // A no-op for a non-input factory or a literal-bound value prop (opt-in by the factory mark; see input.ts).
    installInputBinding(el, factory, node, surface, itemScope, ac)
    return el
  }
}

/**
 * Install a `scope`-owned effect that re-applies one bound prop whenever its resolved value changes
 * (renderer LLD-C7 + C5 + C10). `value` is any dynamic binding (`{path}` or `{call,args?}`);
 * `resolveValue` dispatches through the evaluator so both kinds update reactively. Owning the effect
 * in `scope` means it dies when that scope is disposed — `surface.scope` for an ordinary node (so it
 * dies with the surface, SPEC-N3), or a dynamic-list item's per-index CHILD scope (LLD-C6/ADR-0024 —
 * never leaked into `surface.scope`). `itemScope` threads `@index` + relative-path context (LLD-C6,
 * ADR-0026).
 */
function bindProp(
  el: HTMLElement,
  factory: WidgetFactory,
  prop: string,
  value: unknown,
  surface: Surface,
  resolveValue: WidgetDeps['resolveValue'],
  scope: Scope,
  itemScope: ItemScope | undefined,
): void {
  scope.run(() => {
    effect(() => {
      factory.applyProp(el, prop, resolveValue(value, surface, itemScope))
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
