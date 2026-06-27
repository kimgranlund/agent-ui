// factories.ts — default-catalog widget factories (catalog LLD-C5, SPEC-R4/R3/R8).
//
// One `WidgetFactory` per default-catalog component type, binding each A2UI type DIRECTLY to a live
// `ui-*` FACE control — no Basic-catalog adapter (SPEC-R8). Importing this module also imports the
// `@agent-ui/components` controls barrel, whose control modules `customElements.define` their tags as a
// load-time side effect; so a `create()`'d element is the REAL upgraded control (e.g. `UIButtonElement`),
// not an inert `HTMLUnknownElement`. `applyProp` maps one A2UI property (per the catalog `PropDef.mapsTo`)
// onto the control as a prop or attribute — the renderer's widget resolution (renderer LLD-C7) calls
// `create` once, then `applyProp` for each static prop and inside each scope-owned bound-prop effect.
//
// Coverage tracks the shipped control family (SPEC-N2, Assumption A-2): wave-1 ships only `Button`
// (→ `ui-button`, G5); more factories land as their controls do, keyed by A2UI component type.

import '@agent-ui/components/components' // self-defines ui-button (+ the rest of the family) on import
import type { WidgetFactory } from '../types.ts'

// Generic attribute fallback for an A2UI prop with no dedicated mapping. `null`/`undefined`/`false`
// clear the attribute; `true` sets the boolean-attribute form; everything else is string-coerced. For a
// reflecting control prop (e.g. ui-button's `disabled`) this drives the prop via its attribute observer.
function setAttr(el: HTMLElement, name: string, value: unknown): void {
  if (value == null || value === false) el.removeAttribute(name)
  else if (value === true) el.setAttribute(name, '')
  else el.setAttribute(name, String(value))
}

/**
 * `Button` → `ui-button` (catalog LLD-C5, SPEC-R4). `variant` maps to the control's reflecting `variant`
 * prop; `label` is the button's text content (host-as-grid light-DOM label, button ADR-0006). Not an
 * input ⇒ no `value` (the renderer's input controller, LLD-C8, wires no two-way binding for it). The
 * catalog's `action` prop is the renderer's click→actionResponse trigger, dispatched by the action
 * controller — not a DOM attribute — so it is never routed through `applyProp`.
 */
export const buttonFactory: WidgetFactory = {
  tag: 'ui-button',
  create: () => document.createElement('ui-button'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'variant':
        ;(el as { variant?: unknown }).variant = value
        break
      case 'label':
        el.textContent = value == null ? '' : String(value)
        break
      default:
        setAttr(el, prop, value)
    }
  },
}

/** The default catalog's factory table — keyed by A2UI component type (catalog LLD-C5, consumed by the
 *  host at `registry.register`; the renderer resolves a node's control via `factories[type]`). */
export const defaultFactories: Record<string, WidgetFactory> = {
  Button: buttonFactory,
}
