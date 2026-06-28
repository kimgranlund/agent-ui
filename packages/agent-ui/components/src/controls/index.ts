// components — the self-defining ui-* FACE-control family barrel (ADR-0003). Importing this module pulls in
// every control, each of which `customElements.define`s its tag as a top-level side effect, so importing the
// package `./components` entry registers the whole family in one line. Re-exporting each control's module ALSO
// surfaces its element class (e.g. UIButtonElement, UITextFieldElement, UIRowElement, UICardElement) for typed
// references. Layer-4 barrel: composes the controls layer only; never reaches into kernel internals.
//
// Today's family:
//   • form controls — ui-button (G5), ui-text-field (G6).
//   • the G9 container/layout family (extends the dom UIContainerElement surface base, NOT form-associated):
//     the flex/grid layout primitives ui-row · ui-column · ui-list · ui-grid; the compound ui-card (whose
//     family entry transitively self-defines its region sub-elements ui-card-header/-content/-footer); the
//     compound ui-tabs (transitively self-defines ui-tab/-tab-panel); and ui-modal (native <dialog>).
// A compound's main `.ts` imports its sub-element modules so `export * from './{family}/{family}.ts'` here
// registers the WHOLE family — importing the barrel self-defines all ~14 tags.
export * from './button/button.ts'
export * from './text-field/text-field.ts'

// G9 container / layout family — surface axes + the shared flex grammar (ADR-0015/0016).
export * from './row/row.ts'
export * from './column/column.ts'
export * from './list/list.ts'
export * from './grid/grid.ts'
export * from './card/card.ts' // transitively self-defines ui-card-header / -content / -footer
export * from './tabs/tabs.ts' // transitively self-defines ui-tab / -tab-panel
export * from './modal/modal.ts'
