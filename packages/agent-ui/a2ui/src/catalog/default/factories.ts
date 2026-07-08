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
// `Text` display type (the first Display-class catalog entry). `List`/`Grid` joined the catalog in
// ADR-0087 Wave C (below) — superseding ADR-0016's original "non-catalog primitive" exclusion.
//
// ADR-0053 (form-family rows) adds `Field`/`FormProvider`/`Checkbox`/`Switch`/`Select`/`Option` — the
// first two ride `accessorFactory` (1:1 reflecting props, `FormProvider` carrying the ADR-0054
// `submitGate` mark), `Checkbox`/`Switch` are bespoke (the `buttonFactory` non-identity-`label` shape),
// `Select` rides `accessorFactory`, and `Option` is a sanctioned NON-`ui-*` primitive (`div[role=option]`
// — the pre-`ui-text` `Text` precedent, catalog SPEC-R3 AC1).
//
// ADR-0087 Wave A (the whole-fleet catalog, closing the live SPEC-N2 violation) adds `Icon`/`Menu`+
// `MenuItem`/`Popover`/`Tooltip`. `Icon` rides `accessorFactory` (name/label are BOTH 1:1 reflecting
// accessors on `UIIconElement` — no non-identity mapping needed, despite the decomp's bespoke-factory
// hedge). `Menu`/`Popover`/`Tooltip` all ride `accessorFactory` two-way-bound on `open`/`toggle`
// (ADR-0019) — verified against `menu.ts`/`popover.ts`/`tooltip.ts`: none of the three has a real
// named-slot DOM mechanism for "trigger"; each is PURELY POSITIONAL (the first light-DOM child becomes
// the trigger/anchor, remaining children move into the control-created panel at connect). So — Fork
// D/d2, builder-resolved — these three declare a plain `ChildList` (the Menu precedent, which the decomp
// itself already modeled this way), NOT a `*Trigger`/`*Content` sub-type pair: wrapping the trigger in a
// synthetic region node would move `aria-expanded`/`aria-controls`/`aria-describedby` onto an inert
// wrapper instead of the real interactive element the agent supplies (a regression for
// keyboard/AT users, worst on `ui-tooltip` since `focusin`/`focusout` drive its show/hide off the
// anchor itself). `MenuItem` is the `Option` precedent — a sanctioned NON-`ui-*` primitive
// (`div[role=menuitem]`) whose `value` maps to the `data-value` ATTRIBUTE (verified against `menu.ts`'s
// `#commit`: `item.dataset['value'] ?? item.textContent?.trim()`), not a plain `value` attribute.
//
// ADR-0087 Wave B (the deferred form/range/date family, ADR-0053's original deferral) adds
// `RadioGroup`+`Radio`/`Slider`/`SliderMulti`/`Calendar`/`ComboBox`. All ride `accessorFactory` except
// `Radio` (bespoke, the `Checkbox.label`/`Option.label` non-identity-`mapsTo` shape). **Verified, not
// guessed, per-type:** `Slider`/`Calendar`/`ComboBox` two-way bind on their real commit event (`change`
// in all three cases — slider.ts/calendar.ts/combo-box.ts); `SliderMulti` deliberately carries NO
// `value` mark (Fork C: two REAL accessor props, `valueLo`/`valueHi`, but only one two-way slot per
// component); `RadioGroup` deliberately carries NO `value` mark for a DIFFERENT reason — verified
// against radio-group.ts, `UIRadioGroupElement` exposes NO public `value` accessor at all (only a
// private signal feeding `formValue()`), so unlike SliderMulti this is a genuine component-side gap,
// escalated rather than patched (see the `radioGroupFactory` doc comment below).

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

// The ADR-0078 cl.5 fan-out table — the wire `Text.variant` (catalog-frozen `h1…h5 | caption | body`,
// UNCHANGED) is not bindable, so it translates once at apply-time to the ui-text three-axis triple
// (`as`/`variant`/`size`). Nearest-M3-row per wire level (ADR-0078's table); an unrecognized wire value
// (should not occur — the catalog enum already rejects it, conformance-checked upstream) falls back to
// the `body` triple rather than left half-applied.
const TEXT_VARIANT_TABLE: Record<string, { as: string; variant: string; size: string }> = {
  h1: { as: 'h1', variant: 'display', size: 'sm' },
  h2: { as: 'h2', variant: 'headline', size: 'lg' },
  h3: { as: 'h3', variant: 'headline', size: 'md' },
  h4: { as: 'h4', variant: 'headline', size: 'sm' },
  h5: { as: 'h5', variant: 'title', size: 'lg' },
  body: { as: 'none', variant: 'body', size: 'md' },
  caption: { as: 'none', variant: 'body', size: 'sm' },
}

/**
 * `Text` → `ui-text` (ADR-0078, catalog LLD-C5). `text` is the display content (maps to `textContent` —
 * a non-identity `mapsTo`, so this is a bespoke factory like `buttonFactory`, untouched by the ADR-0078
 * redesign — the cl.4 heal observer makes every later bound-text write safe). `variant` is the wire's
 * ONE enum (`h1…h5 | caption | body`, catalog UNCHANGED) fanned out through `TEXT_VARIANT_TABLE` onto the
 * control's three reflecting accessor props (`as`/`variant`/`size`) — the catalog stays protocol-faithful
 * while the control gets the real semantic stamp + M3 role/size pair. Not an input ⇒ no `value`. A
 * display leaf — no children, no action.
 */
export const textFactory: WidgetFactory = {
  tag: 'ui-text',
  create: () => document.createElement('ui-text'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'text':
        el.textContent = value == null ? '' : String(value)
        break
      case 'variant': {
        const triple = TEXT_VARIANT_TABLE[value as string] ?? TEXT_VARIANT_TABLE.body
        const target = el as { as?: unknown; variant?: unknown; size?: unknown }
        target.as = triple.as
        target.variant = triple.variant
        target.size = triple.size
        break
      }
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

// ── the ADR-0087 Wave A rows (Icon / Menu+MenuItem / Popover / Tooltip) ─────────────

// Icon → ui-icon (ADR-0065/0066). `name`/`label` are BOTH 1:1 reflecting accessors on `UIIconElement`
// (verified against icon.ts `static props`) — a plain `accessorFactory`, no bespoke mapping needed.
export const iconFactory: WidgetFactory = accessorFactory('ui-icon')

// Menu → ui-menu (ADR-0043/overlay-controller.lld). Two-way bindable on `open` via the `toggle` event
// (ADR-0019) — the family contract shared with Popover/Modal/Tabs. `children` is a plain ChildList: the
// FIRST child is the trigger (any renderable node, typically Button), remaining children are MenuItem
// rows moved into the panel by the control itself (menu.ts `#ensureParts`) — verified positional, no
// named-slot mechanism to bind a sub-type pair to.
export const menuFactory: WidgetFactory = accessorFactory('ui-menu', { prop: 'open', event: 'toggle' })

/**
 * MenuItem → `div[role=menuitem]` (the `Option` precedent, a sanctioned NON-`ui-*` primitive):
 * `ui-menu` auto-assigns `role=menuitem` + `tabindex=-1` to non-trigger children lacking a role
 * (menu.ts `#ensureParts`), and its `#commit` reads the clicked/committed item's value as
 * `item.dataset['value'] ?? item.textContent?.trim()` — so `value` maps to the `data-value` ATTRIBUTE
 * (verified against menu.ts), NOT a plain `value` attribute (Option's shape) and NOT a JS prop.
 * `label` → textContent (bespoke, the non-identity-`mapsTo` invariant, like Option.label).
 */
export const menuItemFactory: WidgetFactory = {
  tag: 'div[role=menuitem]',
  create: () => {
    const el = document.createElement('div')
    el.setAttribute('role', 'menuitem')
    return el
  },
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'value':
        setAttr(el, 'data-value', value)
        break
      case 'label':
        el.textContent = value == null ? '' : String(value)
        break
      default:
        setAttr(el, prop, value)
    }
  },
}

// Popover → ui-popover (ADR-0043/overlay-controller.lld). Two-way bindable on `open` via `toggle`
// (ADR-0019). `children` is a plain ChildList (Fork D/d2, builder-resolved): the FIRST child is the
// disclosure trigger, remaining children move into the control-created panel — verified against
// popover.ts `#ensureParts`, which is purely positional (no named-slot DOM feature; the .md's "slots"
// section documents the CONVENTION, not a literal `<slot>`).
export const popoverFactory: WidgetFactory = accessorFactory('ui-popover', { prop: 'open', event: 'toggle' })

// Tooltip → ui-tooltip (ADR-0043/overlay-controller.lld). As Popover, plus `delay` (ms before showing on
// hover; keyboard focus shows immediately, verified against tooltip.ts). Same positional trigger/content
// resolution as Popover — the FIRST child is the anchor the tooltip describes (`aria-describedby`/
// `focusin`/`focusout` all wire to it directly), remaining children move into the tooltip panel.
export const tooltipFactory: WidgetFactory = accessorFactory('ui-tooltip', { prop: 'open', event: 'toggle' })

// ── the ADR-0087 Wave B rows (RadioGroup+Radio / Slider / SliderMulti / Calendar / ComboBox) ───────
//
// RadioGroup → ui-radio-group (ADR-0053 deferral, closed; Fork B — CLOSED, follow-up to Wave B). ADR-0095
// (2026-07-07) retired the `variant` prop entirely (the segmented presentation is now the standalone
// SegmentedControl/Segment pair, below) — this catalog row no longer carries it.
// VERIFIED against radio-group.ts: `name`/`disabled`/`required`/`orientation` are ALL 1:1
// reflecting accessor props (the `groupProps` spread); `value` is now ALSO a real public accessor —
// `UIRadioGroupElement` gained a `get value()`/`set value()` pair delegating to its private
// `#selectedValue` signal (the `UICheckboxElement.checked` precedent), so the renderer's input
// controller (LLD-C8, `el[spec.prop]` read off the DOM node after the commit event, renderer/input.ts)
// reads a real committed value rather than `undefined`. `change` IS the correct commit event (verified:
// `this.emit('change')` in `#commit()`, the ONE user-driven commit path — a programmatic `value` write
// never self-emits, matching the checkbox/select convention). Known limitation (component-reviewer,
// tracked in a2ui-catalog.spec.md §5.2's RadioGroup row): the setter's "value matches no child radio"
// path silently CLEARS the selection with no `change` — a data-model write that races an unmatched
// value ahead of its `Radio` children would blank a valid prior selection with nothing to reconcile.
export const radioGroupFactory: WidgetFactory = accessorFactory('ui-radio-group', { prop: 'value', event: 'change' })

/**
 * Radio → `ui-radio` (ADR-0053 deferral, closed; Fork B — the Wave A reviewer correction: `Radio` is
 * NOT a gate-exempt composite sub-type like `Option`/`MenuItem` — `ui-radio` ships its own descriptor
 * (`radio.md`) and enters the fleet-derived gate's expected set directly, so it needs a real row).
 * `value`/`checked` are 1:1 reflecting accessor props inherited from `UIIndicatorElement` (verified
 * against radio.ts + indicator-element.ts, the `UICheckboxElement` precedent — static props inherit
 * through the prototype chain when a subclass adds nothing of its own); `label` is bespoke light-DOM
 * text (the default slot, non-identity `mapsTo`, the `Checkbox.label`/`Option.label` invariant). No
 * top-level `value` mark — deliberately NOT two-way (the GROUP owns the selection commit; an
 * individually-bound Radio would desync on exclusivity, since `#commit` unchecks siblings via direct
 * property writes with no `change` event on them, verified against radio-group.ts `#commit`).
 */
export const radioFactory: WidgetFactory = {
  tag: 'ui-radio',
  create: () => document.createElement('ui-radio'),
  applyProp: (el, prop, value) => {
    if (prop === 'label') el.textContent = value == null ? '' : String(value)
    else setProp(el, prop, value)
  },
}

// ── ADR-0095 (supersedes ADR-0086; hard cutover, no alias) — SegmentedControl+Segment ──────────────
//
// SegmentedControl → ui-segmented-control. VERIFIED against segmented-control.ts: `UISegmentedControlElement
// extends UIRadioGroupElement` directly and adds NO new prop of its own — `name`/`disabled`/`required`/
// `orientation`/`value` are the SAME inherited accessors RadioGroup's own factory targets (the `variant`
// enum member RETIRES — ADR-0095 clause 1 removed the prop entirely, so there is nothing to map). Two-way
// bindable on `value` via `change`, identical mechanism to RadioGroup (`#commit()`'s `this.emit('change')`,
// the ONE user-driven commit path, inherited unchanged).
export const segmentedControlFactory: WidgetFactory = accessorFactory('ui-segmented-control', { prop: 'value', event: 'change' })

/**
 * Segment → `ui-segment` (ADR-0095 clause 3). VERIFIED against segment.ts: `UISegmentElement extends
 * UIRadioElement` directly, adding NO new prop of its own — `value`/`checked` are the SAME inherited
 * accessor props Radio's own factory targets; `label` is the SAME bespoke non-identity `mapsTo` (→
 * textContent, the Checkbox/Switch/Radio precedent). No top-level `value` mark — deliberately NOT two-way,
 * for the identical reason Radio isn't: the HOST `ui-segmented-control` owns the selection commit.
 */
export const segmentFactory: WidgetFactory = {
  tag: 'ui-segment',
  create: () => document.createElement('ui-segment'),
  applyProp: (el, prop, value) => {
    if (prop === 'label') el.textContent = value == null ? '' : String(value)
    else setProp(el, prop, value)
  },
}

// Slider → ui-slider (ADR-0053 deferral, closed; Fork C — single value). `value`/`min`/`max`/`step`/
// `name`/`disabled`/`required` are ALL 1:1 reflecting accessor props inherited from `UIRangeElement`
// (verified against slider.ts + range-element.ts). Two-way bindable on `value` via the VERIFIED
// commit event `change` — sliders emit `input` on every live drag/keyboard step and `change` only on
// blur when the value has moved since focus (range-element.ts's commit-on-blur contract, slider.md
// events table) — the committed event, not the live one, per the task's explicit instruction.
export const sliderFactory: WidgetFactory = accessorFactory('ui-slider', { prop: 'value', event: 'change' })

// SliderMulti → ui-slider-multi (ADR-0053 deferral, closed; Fork C — dual value, RESOLVED two types).
// `min`/`max`/`step`/`name`/`disabled` are 1:1 reflecting accessors; `valueLo`/`valueHi` are ALSO real
// 1:1 reflecting accessor props (verified against slider-multi.ts's `sliderMultiProps` — NOT a missing
// accessor like RadioGroup, just a missing TWO-WAY MARK) — but the ADR-0019 seam permits only ONE
// `value:{prop,event}` mark per component, and this control commits TWO values. So: **no `value` mark**
// — `valueLo`/`valueHi` are bindable ONE-WAY only (agent-set literals or `{path}` reads; the control's
// own drag/keyboard commits do not write back through the current seam). The documented Fork C seam
// limitation, not a bug.
export const sliderMultiFactory: WidgetFactory = accessorFactory('ui-slider-multi')

// Calendar → ui-calendar (ADR-0053 deferral, closed). `value`/`min`/`max`/`name`/`required`/`disabled`
// are 1:1 reflecting accessor props (verified against calendar.ts). Two-way bindable on `value` via
// `change` — calendar.md's OWN descriptor already declares this exact bind
// (`value:{prop:'value',event:'change'}`, confirmed at calendar.ts's `#commit`: `this.emit('change')`
// alongside `this.emit('select', iso)`). `value` is an ISO `YYYY-MM-DD` string; `''` = no date selected.
//
// ADR-0093 (range mode, catalog follow-up per its clause 7) adds `mode` (`'single'|'range'`, NOT
// bindable — a structural enum, the `orientation`/`placement` precedent) + `valueStart`/`valueEnd`
// (bindable ONE-WAY only, 1:1 reflecting accessor props — the `SliderMulti` `valueLo`/`valueHi`
// shape). The row's one two-way slot stays `value:{prop:'value',event:'change'}` — inert-but-harmless
// in `mode="range"` (calendar.ts holds it live but contributing nothing) — because the catalog schema
// supports only one two-way bind per component; a second two-way slot for the pair is future work.
// No factory code change: `accessorFactory`/`setProp` already applies any catalog `mapsTo` 1:1.
export const calendarFactory: WidgetFactory = accessorFactory('ui-calendar', { prop: 'value', event: 'change' })

/**
 * ComboBox → `ui-combo-box` (ADR-0053 deferral, closed; Fork D/combobox). `value`/`label`/`placeholder`/
 * `strict`/`name`/`disabled` are 1:1 reflecting accessor props (verified against combo-box.ts).
 * Two-way bindable on the FORM value — `value` via `change` — NOT `open`/`toggle` (the overlay-family
 * shape). **Corrected descriptor discrepancy:** `combo-box.md` carried a stale comment (copied from the
 * overlay family before ComboBox's own form value was catalogued) claiming "the catalog declares
 * `value:{prop:'open',event:'toggle'}`" — verified against combo-box.ts: `value` is the committed
 * option key / free-text string (`prop.string()`, `formValue()` source), and `change` fires on commit
 * with `this.value` already updated (combo-box.md events table) — `value`/`change` is the correct,
 * and now sole, two-way mark. `open` remains a real, independently settable reflecting prop on the
 * control (drives the overlay panel) but carries NO catalog `value` mark (one mark per component,
 * ADR-0019) — fixed in the same commit, see combo-box.md. `children` reuses the existing `Option`
 * primitive (the `Select` precedent).
 */
export const comboBoxFactory: WidgetFactory = accessorFactory('ui-combo-box', { prop: 'value', event: 'change' })

// ── the ADR-0087 Wave C rows (List / Grid — Fork A RESOLVED INCLUDE, Kim 2026-07-06) ───────────────
//
// List → ui-list (a `ui-column` specialization carrying `role=list`, ADR-0016 cl.3). `elevation`/
// `brightness` (surface, ADR-0015) + `align`/`justify`/`gap`/`wrap` (the shared flex grammar, ADR-0016)
// are ALL 1:1 reflecting accessor props — verified against list.ts `static props` (the
// `UIContainerElement.surfaceProps` + `.flexProps` spreads, `align` defaulting to `stretch` per
// ADR-0030) — the exact Row/Column idiom, so a plain `accessorFactory('ui-list')` suffices. Not an
// input (no `value` mark — a structural container, not a bindable component).
export const listFactory: WidgetFactory = accessorFactory('ui-list')

// Grid → ui-grid (the auto-fit/minmax track model, ADR-0016 cl.3). `elevation`/`brightness` (surface)
// + `gap` (the one flexProps entry a track grid consumes) + `min` (the minmax() track floor, an
// arbitrary CSS <length> string) are ALL 1:1 reflecting accessor props — verified against grid.ts
// `static props`. Not an input (no `value` mark).
export const gridFactory: WidgetFactory = accessorFactory('ui-grid')

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
  Icon: iconFactory,
  Menu: menuFactory,
  MenuItem: menuItemFactory,
  Popover: popoverFactory,
  Tooltip: tooltipFactory,
  RadioGroup: radioGroupFactory,
  Radio: radioFactory,
  SegmentedControl: segmentedControlFactory,
  Segment: segmentFactory,
  Slider: sliderFactory,
  SliderMulti: sliderMultiFactory,
  Calendar: calendarFactory,
  ComboBox: comboBoxFactory,
  List: listFactory,
  Grid: gridFactory,
}
