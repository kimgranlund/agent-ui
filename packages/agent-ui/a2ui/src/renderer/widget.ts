// widget.ts — widget factory / catalog resolver (renderer LLD-C7, SPEC-R9).
//
// Resolves one A2UI component node to a live `ui-*` control: looks `node.component` up in the
// surface's bound catalog (via the `CatalogRegistry` — `get(catalogId)?.factories[type]`),
// instantiates the resolved `WidgetFactory`'s element, applies the static props, installs a
// `surface.scope`-owned effect per DYNAMIC prop so a data-model change re-applies only that prop
// (SPEC-N2). Dynamic props are: `{path}` bindings (LLD-C5), `{call}` function calls (ADR-0026),
// and `${…}` DynamicString template strings (ADR-0027) — `isBinding` routes all three through the
// scope-owned bound-prop effect. A static non-template literal is applied once via `applyProp`.
// For input widgets the reverse direction is wired via `installInputBinding` (LLD-C8/ADR-0019).
// An unknown component type is NON-fatal: it emits `error{code:"CATALOG"}` and returns a placeholder
// element so sibling nodes still render (SPEC-R9 AC2). The resolver therefore ALWAYS returns an
// element — it never throws and never returns null.
//
// Collaborators are injected (the catalog registry, the error sink, the binding resolver) so this
// slice builds + tests against stubs in isolation; the renderer host (LLD-C13) wires the real
// registry/factories and the LLD-C5 resolver at integration. This module owns the produced
// `CreateWidget` (pinned in `./types.ts`); `makeCreateWidget` is its constructor.
//
// Create/wire split (RSR-C2, ADR-0128/renderer-structural-resend.lld.md §2). `create()` mints ONLY the
// element (the placeholder branch on an unknown type included); `wireProps()` applies props + the input
// binding onto an ALREADY-MINTED element, re-resolving the factory itself rather than sharing a closure
// local — a no-op (not a second `CATALOG` emit) when that re-resolution comes back empty (a placeholder).
// `makeCreateWidget` composes both, byte-for-byte the prior fused behavior for every existing caller. The
// split's ONE new caller is structural-resend reconciliation (`tree.ts`'s `#reconcileProps`), which needs
// to re-wire an EXISTING element without ever calling `create()` again (identity/focus preservation).

import { effect } from '@agent-ui/components'
import type { Scope } from '@agent-ui/components'
import type { A2uiComponent, A2uiError, FunctionCall } from '../protocol.ts'
import type { CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import type { ComponentDef } from '../catalog/catalog.ts'
import type { CreateWidget, ItemScope } from './types.ts'
import type { Surface } from './surface.ts'
import { installInputBinding } from './input.ts'
import { isInterpolated } from './interpolate.ts'

/** Structural adjacency keys (SPEC-R3/§5.1) — never catalog-declared props, so never applied.
 *  `checks` is a component-level array (ADR-0029), handled by the renderer host like `action` —
 *  it is read off the node and wired into a reactive controller, never `applyProp`'d. */
const RESERVED = new Set<string>(['id', 'component', 'child', 'children', 'checks'])

/**
 * The closed string `enum` a catalog `PropDef` declares for a prop, or `undefined` if the prop is
 * unconstrained (no PropDef, a boolean/number schema, or a string schema with no `enum`). Used to gate
 * `applyProp` below.
 */
function enumOf(def: ComponentDef | undefined, prop: string): readonly string[] | undefined {
  const schema = def?.properties[prop]?.type
  if (schema == null || typeof schema !== 'object') return undefined // no PropDef / boolean schema → unconstrained
  const members = (schema as { enum?: unknown }).enum
  return Array.isArray(members) ? (members as readonly string[]) : undefined
}

/**
 * Should this (already-resolved) LITERAL value be applied for `prop`? An unconstrained prop always
 * applies; an enum-constrained prop applies ONLY if the value is a declared member. Nothing upstream
 * enforces catalog enum MEMBERSHIP — the wire validator checks a prop's type/shape, and the control's
 * property setter stores a value verbatim (only the ATTRIBUTE path runs the enum codec) — so an agent
 * can emit a value the enum forbids (e.g. `align="center"` on a `ui-column`, whose enum drops `center`).
 * Such a value is already visually INERT (the control's CSS repoints only on declared members) but, if
 * applied, lingers as a stray DOM attribute. Skipping it at the catalog boundary keeps the rendered DOM
 * faithful to the catalog — the single source of truth for what a prop may be.
 */
function applies(members: readonly string[] | undefined, value: unknown): boolean {
  return members === undefined || members.includes(value as string)
}

/**
 * A dynamic binding value: `{path}` data-model reference, `{call}` function call (ADR-0026), or a
 * `${…}` DynamicString template string (ADR-0027). All three are deferred-resolution — they need the
 * scope-owned bound-prop effect and `resolveValue` to produce a render value. A static non-template
 * literal falls through to the `else` branch and is `applyProp`'d once.
 *
 * Adding template strings to the binding class is the load-bearing widget-layer change for ADR-0027:
 * without it a template string would be treated as a static prop value (applied once, never reactive).
 */
const isBinding = (v: unknown): v is { path: string } | FunctionCall | string =>
  (typeof v === 'object' && v !== null && !Array.isArray(v) &&
    (typeof (v as { path?: unknown }).path === 'string' ||
     typeof (v as { call?: unknown }).call === 'string')) ||
  (typeof v === 'string' && isInterpolated(v))

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
 * Mint ONLY the live control for one node — no prop/input wiring (renderer LLD-C7, split for
 * RSR-C2/ADR-0128). On an unknown type, emits `CATALOG` and returns a placeholder; ALWAYS returns an
 * element (non-fatal, SPEC-R9 AC2). Reused standalone by structural-resend reconciliation (RSR-C6) to
 * mint a throwaway, never-connected instance whose fresh property reads ARE the factory's declared
 * defaults — a pristine-default lookup that must not run the prop loop.
 */
export function create(node: A2uiComponent, surface: Surface, deps: WidgetDeps): HTMLElement {
  const entry = deps.registry.get(surface.catalogId)
  const factory = entry?.factories[node.component]
  if (factory === undefined) {
    // Unknown component type — or, defensively, a catalog that vanished after createSurface's
    // CATALOG_UNKNOWN guard. Non-fatal: report + placeholder so sibling nodes still mount.
    deps.emitError({
      code: 'CATALOG',
      surfaceId: surface.id,
      path: node.id,
      message: `unknown component type "${node.component}" in catalog "${surface.catalogId}"`,
    })
    return placeholder(node)
  }
  return factory.create()
}

/**
 * Wire an ALREADY-MINTED element's props + two-way input binding (renderer LLD-C7, split for
 * RSR-C2/ADR-0128) — never mints a new element. A no-op (no props applied, no CATALOG re-emitted) when
 * `el` came from an unresolved factory (the placeholder path already reported `CATALOG` at `create()`
 * time) — re-resolving the factory here and finding it absent again must not double-report.
 */
export function wireProps(
  el: HTMLElement,
  node: A2uiComponent,
  surface: Surface,
  scope: Scope,
  itemScope: ItemScope | undefined,
  ac: AbortController,
  deps: WidgetDeps,
): void {
  const { registry, resolveValue } = deps
  const entry = registry.get(surface.catalogId)
  const factory = entry?.factories[node.component]
  if (factory === undefined) return // placeholder element — no props/input wiring (create() already reported CATALOG)

  const componentDef = entry?.catalog?.components?.[node.component] // the PropDefs — the enum authority for `applies` (absent in a stub catalog ⇒ unconstrained)
  for (const [prop, value] of Object.entries(node)) {
    if (RESERVED.has(prop)) continue
    const members = enumOf(componentDef, prop) // the prop's declared enum (or undefined = unconstrained)
    if (isBinding(value)) bindProp(el, factory, prop, value, surface, resolveValue, scope, itemScope, members)
    else if (applies(members, value)) factory.applyProp(el, prop, value) // static literal → set once, IF a declared enum member
  }
  // Two-way input binding (renderer LLD-C8, ADR-0019). Wired here — right after the data→control props are
  // applied, with `el`/`factory`/`node`/`surface` all in scope — so a control marked `value:{prop,event}`
  // (Tabs `selected`/`select`, Modal `open`/`toggle`, the back-filled TextField `value`/`change`) commits
  // its value BACK into surface.data on its commit event. For a list item, `itemScope` threads through so
  // the writeback resolves the same absolute pointer as the read (ADR-0024 amendment, symmetric rewrite);
  // `ac` threads the per-item AbortController so the listener is removed on item removal (SPEC-N3).
  // A no-op for a non-input factory or a literal-bound value prop (opt-in by the factory mark; see input.ts).
  installInputBinding(el, factory, node, surface, itemScope, ac)
}

/**
 * Build the pinned `createWidget` (renderer LLD-C7) over its injected collaborators — composes
 * `create()` + `wireProps()` (RSR-C2/ADR-0128's create/wire split), byte-for-byte the prior fused
 * behavior for every existing caller. The returned function resolves + instantiates the control for one
 * node, or — on an unknown type — emits `CATALOG` and returns a placeholder; it ALWAYS returns an
 * element (non-fatal, SPEC-R9 AC2).
 */
export function makeCreateWidget(deps: WidgetDeps): CreateWidget {
  return (node, surface, scope = surface.scope, itemScope, ac = surface.ac) => {
    const el = create(node, surface, deps)
    wireProps(el, node, surface, scope, itemScope, ac, deps)
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
  members: readonly string[] | undefined,
): void {
  scope.run(() => {
    effect(() => {
      const resolved = resolveValue(value, surface, itemScope)
      // Same catalog-enum gate as the static path: a binding that resolves to a non-member value is
      // skipped (it would otherwise linger as a stray attribute — see `applies`). Re-checked each tick.
      if (applies(members, resolved)) factory.applyProp(el, prop, resolved)
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
