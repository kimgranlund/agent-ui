// components — the self-defining ui-* FACE-control family barrel (ADR-0003). Importing this module pulls in
// every control, each of which `customElements.define`s its tag as a top-level side effect, so importing the
// package `./components` entry registers the whole family in one line. Re-exporting each control's module ALSO
// surfaces its element class (e.g. UIButtonElement, UITextFieldElement, UIRowElement, UICardElement) for typed
// references. Layer-4 barrel: composes the controls layer only; never reaches into kernel internals.
//
// Today's family:
//   • form controls — ui-button (G5), ui-text-field (G6).
//   • display controls — ui-text (ADR-0025), the Display-class text primitive (typographic scale leaf).
//   • Indicator controls — Wave 1 (ADR-0041/0042): ui-checkbox · ui-switch · ui-radio · ui-radio-group.
//     All four extend UIIndicatorElement (boolean form value + checked-state machine + pressActivation
//     toggle); ui-radio-group extends UIFormElement directly and owns the group value + rovingFocus.
//   • the G9 container/layout family (extends the dom UIContainerElement surface base, NOT form-associated):
//     the flex/grid layout primitives ui-row · ui-column · ui-list · ui-grid; the compound ui-card (whose
//     family entry transitively self-defines its region sub-elements ui-card-header/-content/-footer); the
//     compound ui-tabs (transitively self-defines ui-tab/-tab-panel); and ui-modal (native <dialog>).
// A compound's main `.ts` imports its sub-element modules so `export * from './{family}/{family}.ts'` here
// registers the WHOLE family — importing the barrel self-defines all ~18+ tags.
export * from './button/button.ts'
export * from './text-field/text-field.ts'
export * from './text/text.ts'

// Indicator controls — Wave 1 (ADR-0041/0042).
export * from './checkbox/checkbox.ts'
export * from './switch/switch.ts'
export * from './radio/radio.ts'        // self-defines ui-radio
export * from './radio/radio-group.ts'  // self-defines ui-radio-group

// Range controls — Wave 2 (ADR-0042 Range half): single + dual-thumb slider.
export * from './slider/slider.ts'
export * from './slider-multi/slider-multi.ts'

// G9 container / layout family — surface axes + the shared flex grammar (ADR-0015/0016).
export * from './row/row.ts'
export * from './column/column.ts'
export * from './list/list.ts'
export * from './grid/grid.ts'
export * from './card/card.ts' // transitively self-defines ui-card-header / -content / -footer
export * from './tabs/tabs.ts' // transitively self-defines ui-tab / -tab-panel
export * from './modal/modal.ts'

// Overlay controls — Wave 4 (ADR-0043 / overlay-controller.lld): the `overlay` controller composed into five
// controls. Non-form disclosure/hover/action overlays (UIElement hosts) + the two form-associated pickers
// (UIFormElement + a role=listbox popup). All emit the family two-way-`open` contract (toggle/close, ADR-0019).
export * from './popover/popover.ts'     // disclosure overlay — proves the overlay controller
export * from './tooltip/tooltip.ts'     // hover/focus overlay (popover=manual, never steals focus)
export * from './menu/menu.ts'           // action overlay — rovingFocus over [role=menuitem], commit→select
export * from './select/select.ts'       // form-associated single-select (overlay + roving + selectionCommit)
export * from './combo-box/combo-box.ts' // form-associated filter combobox (overlay + active-descendant)

// Picker controls — Wave 5B (ADR-0048): standalone month-grid date picker; also the popup body
// for ui-text-field type=date (lazily imported there in slice 5B-3).
export * from './calendar/calendar.ts'   // form-associated date picker (bespoke 2D grid, UIFormElement base)
