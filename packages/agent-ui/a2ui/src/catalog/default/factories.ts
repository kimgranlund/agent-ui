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
// Coverage tracks the shipped control family (SPEC-N2, Assumption A-2): G5 `Button`, G6 `TextField`, the
// G9 container family — `Row`/`Column` (catalog-shipped, SPEC §5.2), `Card` + its region sub-elements
// (`CardHeader`/`CardContent`/`CardFooter`), `Tabs` + `Tab`/`TabPanel`, and `Modal` — plus the ADR-0025
// `Text` display type (the first Display-class catalog entry). `ui-list`/`ui-grid` are NOT catalog types
// (they ship as direct `ui-*` primitives — the ratified G9 scope, ADR-0016).
//
// ADR-0053 (form-family rows) adds `Field`/`FormProvider`/`Checkbox`/`Switch`/`Select`/`Option` — the
// first two ride `accessorFactory` (1:1 reflecting props, `FormProvider` carrying the ADR-0054
// `submitGate` mark), `Checkbox`/`Switch` are bespoke (the `buttonFactory` non-identity-`label` shape),
// `Select` rides `accessorFactory`, and `Option` is a sanctioned NON-`ui-*` primitive (`div[role=option]`
// — the pre-`ui-text` `Text` precedent, catalog SPEC-R3 AC1).

import '@agent-ui/components/components' // self-defines ui-button + the G9 container family on import
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

/**
 * `Text` → `ui-text` (ADR-0025, catalog LLD-C5). `text` is the display content (maps to `textContent` —
 * a non-identity `mapsTo`, so this is a bespoke factory like `buttonFactory`); `variant` maps to the
 * control's reflecting `variant` accessor prop. Not an input ⇒ no `value`. A display leaf — no children,
 * no action (ADR-0025 cl.5).
 */
export const textFactory: WidgetFactory = {
  tag: 'ui-text',
  create: () => document.createElement('ui-text'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'text':
        el.textContent = value == null ? '' : String(value)
        break
      case 'variant':
        ;(el as { variant?: unknown }).variant = value
        break
      default:
        setAttr(el, prop, value)
    }
  },
}

// ── the container + form-input family (accessor-prop factories) ────────────────
//
// Unlike `Button` (whose `label` is light-DOM text, so its `mapsTo` is `textContent` ≠ the prop name),
// every catalog property on the container family and on `ui-text-field` is declared with `mapsTo` EQUAL
// to its name — the SPEC-R8 1:1 reflection: the surface axes (`elevation`/`brightness`), the flex grammar
// (`align`/`justify`/`gap`/`wrap`), the bindable state (`selected`/`open`), `persistent`/`scrollable`, and
// the text-field's `value`/`label`/… each name a reflecting prop ACCESSOR on the control. Because the
// A2UI property name IS the control prop name for this family, `el[prop]` is exactly the `mapsTo` target,
// so `applyProp` sets the JS accessor directly (the `buttonFactory` `variant` precedent) and the control
// reflects it to its attribute. Setting a property BEFORE the element upgrades is the platform-supported
// lazy-upgrade path (`UIElement`'s upgrade dance), so this is correct whether or not the tag has
// self-defined yet. INVARIANT: a property whose `mapsTo` differs from its name (a non-identity mapping,
// like `Button.label`) needs a bespoke factory — it must NOT be routed through `accessorFactory`.
function setProp(el: HTMLElement, prop: string, value: unknown): void {
  ;(el as unknown as Record<string, unknown>)[prop] = value
}

/**
 * Build a factory for a control whose catalog properties all map 1:1 onto reflecting prop accessors
 * (the container family + text-field + the ADR-0053 `Field`/`FormProvider`/`Select` rows). `value`
 * (optional) declares the two-way commit contract the renderer's input controller (LLD-C8, SPEC-R7)
 * reads: the control's bindable prop + its commit event. `submitGate` (optional, ADR-0054) marks the
 * control as a submit-action gate — the registry aggregates it into its derived selector.
 */
function accessorFactory(tag: string, value?: { prop: string; event: string }, submitGate?: true): WidgetFactory {
  const factory: WidgetFactory = {
    tag,
    create: () => document.createElement(tag),
    applyProp: setProp,
  }
  if (value) factory.value = value
  if (submitGate) factory.submitGate = true
  return factory
}

// Layout primitives (ADR-0016) — surface axes + the shared flex grammar; not inputs (no `value`).
export const rowFactory: WidgetFactory = accessorFactory('ui-row')
export const columnFactory: WidgetFactory = accessorFactory('ui-column')

// Card + its region sub-elements (the ratified "regions = sub-elements", ChildList children). The regions
// are structural (their content is their children) — `ui-card-content` adds the `scrollable` prop.
export const cardFactory: WidgetFactory = accessorFactory('ui-card')
export const cardHeaderFactory: WidgetFactory = accessorFactory('ui-card-header')
export const cardContentFactory: WidgetFactory = accessorFactory('ui-card-content')
export const cardFooterFactory: WidgetFactory = accessorFactory('ui-card-footer')

// Tabs + its tab/panel sub-elements. `Tabs` is two-way bindable on `selected` via the `select` commit
// event (ADR-0019 cl.2) — the renderer's LLD-C8 controller writes the active tab back into surface.data.
export const tabsFactory: WidgetFactory = accessorFactory('ui-tabs', { prop: 'selected', event: 'select' })
export const tabFactory: WidgetFactory = accessorFactory('ui-tab')
export const tabPanelFactory: WidgetFactory = accessorFactory('ui-tab-panel')

// Modal (native <dialog>, ADR-0017) — two-way bindable on `open` via the `toggle` event (ADR-0019 cl.2)
// so the agent learns of a platform dismissal (Escape / backdrop).
export const modalFactory: WidgetFactory = accessorFactory('ui-modal', { prop: 'open', event: 'toggle' })

// TextField (G6) — the deferred value bind goes live through the same LLD-C8 controller (ADR-0019 cl.3):
// `value` commits on the control's `change` event (blur / Enter), zero text-field code change. The
// Wave-5 reach (ADR-0047/0048) + the ADR-0053 catalog widening (`type`/`currency`/`unit`/`step`/`min`/
// `max`) are ALL 1:1 reflecting accessor props — zero factory code beyond the catalog.json PropDefs.
export const textFieldFactory: WidgetFactory = accessorFactory('ui-text-field', { prop: 'value', event: 'change' })

// ── the ADR-0053 form-family rows ───────────────────────────────────────────────

// Field — the label/description/error wrapper (G7, ADR-0050/0051). `label`/`description` are 1:1
// reflecting accessor props; the wrapped control rides the structural `child` key (RESERVED — never
// `applyProp`'d, handled generically by the tree walk, LLD-C4). Not an input of its own (no `value`).
export const fieldFactory: WidgetFactory = accessorFactory('ui-field')

// FormProvider — the discovery/aggregation coordination element (G7, ADR-0050). ZERO catalog
// properties (its factory's `applyProp` is never called — the row declares none); `submitGate: true`
// (ADR-0054) is the load-bearing mark — the registry's derived selector picks up `ui-form-provider` as
// a submit-gate ancestor. No `value` mark — the provider commits no bindable prop of its own; the
// aggregate rides the data model (two-way binds + `sendDataModel`), not a catalog prop.
export const formProviderFactory: WidgetFactory = accessorFactory('ui-form-provider', undefined, true)

/**
 * `Checkbox`/`Switch` → `ui-checkbox`/`ui-switch` (ADR-0053, the Indicator class). `checked`/
 * `disabled`/`required`/`name` are 1:1 reflecting accessors (`setProp`); `label` is bespoke — the
 * anatomy's slotted light-DOM text (checkbox.md/switch.md `label` slot), a non-identity `mapsTo` like
 * `Button.label` — so it must NOT route through `accessorFactory` (the factories.ts INVARIANT).
 * Two-way bindable on `checked` via `change` (ADR-0053 fork F2, the naming law: the bindable catalog
 * prop is named by the CONTROL's own prop, `Tabs.selected`/`Modal.open` precedent — NOT Basic's
 * `value`, which `ui-checkbox` already uses for the submitted string).
 */
function indicatorFactory(tag: string): WidgetFactory {
  return {
    tag,
    create: () => document.createElement(tag),
    applyProp: (el, prop, value) => {
      if (prop === 'label') el.textContent = value == null ? '' : String(value)
      else setProp(el, prop, value)
    },
    value: { prop: 'checked', event: 'change' },
  }
}
export const checkboxFactory: WidgetFactory = indicatorFactory('ui-checkbox')
export const switchFactory: WidgetFactory = indicatorFactory('ui-switch')

// Select → ui-select (ADR-0053, renames the planned `ChoicePicker`) — `value`/`placeholder`/
// `disabled`/`required`/`name` are 1:1 reflecting accessors; two-way bindable on `value` via the
// control's `select` commit event. `open` is deliberately NOT declared (one `value` mark per
// component; a one-way `open` would silently desync on platform light-dismiss).
export const selectFactory: WidgetFactory = accessorFactory('ui-select', { prop: 'value', event: 'select' })

/**
 * Option → `div[role=option]` (ADR-0053) — a sanctioned NON-`ui-*` primitive (the pre-`ui-text` `Text`
 * precedent, catalog SPEC-R3 AC1's "sanctioned primitive" exception): `ui-select` moves author
 * `[role=option]` light-DOM children into its listbox panel at first connect (select.ts), so Option
 * never self-defines a custom element of its own. `value` → the `value` attribute (the match key
 * `ui-select` reads); `label` → textContent (bespoke, the non-identity-`mapsTo` invariant). Not an
 * input (no `value` mark — Option is a passive list item, not a bindable component).
 */
export const optionFactory: WidgetFactory = {
  tag: 'div[role=option]',
  create: () => {
    const el = document.createElement('div')
    el.setAttribute('role', 'option')
    return el
  },
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'value':
        setAttr(el, 'value', value)
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
 *  host at `registry.register`; the renderer resolves a node's control via `factories[type]`). Every type
 *  declared in `catalog.json` MUST appear here — a gap is a `CATALOG_FACTORY_MISSING` at register (SPEC-R7 AC1). */
export const defaultFactories: Record<string, WidgetFactory> = {
  Button: buttonFactory,
  Text: textFactory,
  TextField: textFieldFactory,
  Field: fieldFactory,
  FormProvider: formProviderFactory,
  Checkbox: checkboxFactory,
  Switch: switchFactory,
  Select: selectFactory,
  Option: optionFactory,
  Row: rowFactory,
  Column: columnFactory,
  Card: cardFactory,
  CardHeader: cardHeaderFactory,
  CardContent: cardContentFactory,
  CardFooter: cardFooterFactory,
  Tabs: tabsFactory,
  Tab: tabFactory,
  TabPanel: tabPanelFactory,
  Modal: modalFactory,
}
