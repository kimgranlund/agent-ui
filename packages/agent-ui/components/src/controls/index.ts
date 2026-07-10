// components — the self-defining ui-* FACE-control family barrel (ADR-0003). Importing this module pulls in
// every control, each of which `customElements.define`s its tag as a top-level side effect, so importing the
// package `./components` entry registers the whole family in one line. Re-exporting each control's module ALSO
// surfaces its element class (e.g. UIButtonElement, UITextFieldElement, UIRowElement, UICardElement) for typed
// references. Layer-4 barrel: composes the controls layer only; never reaches into kernel internals.
//
// Today's family:
//   • form controls — ui-button (G5), ui-text-field (G6).
//   • display controls — ui-text (ADR-0025), the Display-class text primitive (typographic scale leaf);
//     ui-icon (ADR-0065/0066), the icon-adapter's declarative consumer (imports @agent-ui/icons).
//   • Indicator controls — Wave 1 (ADR-0041/0042): ui-checkbox · ui-switch · ui-radio · ui-radio-group.
//     All four extend UIIndicatorElement (boolean form value + checked-state machine + pressActivation
//     toggle); ui-radio-group extends UIFormElement directly and owns the group value + rovingFocus.
//   • the G9 container/layout family (extends the dom UIContainerElement surface base, NOT form-associated):
//     the flex/grid layout primitives ui-row · ui-column · ui-list · ui-grid; the compound ui-card (whose
//     family entry transitively self-defines its region sub-elements ui-card-header/-content/-footer); the
//     compound ui-tabs (transitively self-defines ui-tab/-tab-panel); and ui-modal (native <dialog>).
//   • Coordination controls — G7 (ADR-0050/ADR-0051): ui-field (the label/description/error wrapper around
//     ONE slotted form control) and ui-form-provider (the discovery/aggregation layer over UIFormElement
//     descendants). Neither carries a form value of its own — both extend UIElement directly.
//   • Chart family — Wave M1 (ADR-0107, chart-family.lld.md): ui-sparkline (series-shape mark) and
//     ui-bar-chart (magnitude-comparison bar list). Both Display-class, axis-free, non-interactive,
//     non-form-associated leaves — extend UIElement directly, tier=display, no [size]/[scale] geometry row.
//   • Report family — Wave M1 (ADR-0111, report-family.lld.md): ui-table (native <table>, scroll-preserving
//     re-render), ui-stat (metric tile, direction-as-text delta), ui-badge (compact-realm intent badge). All
//     Display-class, non-interactive, non-form-associated leaves — extend UIElement directly.
//   • Content family — Wave M1 (ADR-0113, content-family.lld.md): ui-code (zero-machinery verbatim code
//     leaf, host-as-content) and ui-disclosure (native <details>/<summary> fold, Pattern-class). The
//     hyperlink capability (`as='a'`/`href`) is an in-place extension of ui-text (exported above).
// A compound's main `.ts` imports its sub-element modules so `export * from './{family}/{family}.ts'` here
// registers the WHOLE family — importing the barrel self-defines all ~20+ tags.
export * from './button/button.ts'
export * from './text-field/text-field.ts'
export * from './text/text.ts'
export * from './icon/icon.ts' // ui-icon (ADR-0065/0066) — the icon-adapter's declarative consumer surface

// Indicator controls — Wave 1 (ADR-0041/0042).
export * from './checkbox/checkbox.ts'
export * from './switch/switch.ts'
export * from './radio/radio.ts'        // self-defines ui-radio
export * from './radio/radio-group.ts'  // self-defines ui-radio-group

// Range controls — Wave 2 (ADR-0042 Range half): single + dual-thumb slider.
export * from './slider/slider.ts'
export * from './slider-multi/slider-multi.ts'

// Pattern controls — ADR-0095 (supersedes ADR-0086's ui-radio-group[variant='segmented'], hard cutover):
// the standalone segmented control. segmented-control.ts imports segment.ts as a side effect (both tags
// self-define together), but each still gets its own `export *` line here — the barrel↔exports-map
// three-way bijection (barrels.test.ts T4) requires one per public `./controls/{name}` entry, and
// `segment`/`segmented-control` live in SEPARATE folders (the family-coherence naming trip-wire's
// `name === folder || name.startsWith(folder + '-')` rule has no prefix relationship between them, unlike
// the radio/radio-group one-folder precedent — see segmented-control.ts's own note).
export * from './segment/segment.ts'
export * from './segmented-control/segmented-control.ts'

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

// Coordination controls — G7 (ADR-0050/ADR-0051): the labelling wrapper + the aggregation/discovery provider.
export * from './field/field.ts'               // the label/description/error wrapper (LLD-C4)
export * from './form-provider/form-provider.ts' // also surfaces FormSubmitDetail (LLD-C7)

// Coordination/carrier controls — ADR-0117: the fleet's SECOND pure UIElement coordination primitive (after
// ui-form-provider). Establishes a color-scheme subtree + reflects scale/density/theme as pure carriers.
export * from './theme-provider/theme-provider.ts'

// Chart family — Wave M1 (ADR-0107, chart-family.lld.md): Display-class, axis-free chart marks. Neither is
// form-associated or interactive (extends UIElement directly, tier=display, no [size]/[scale] geometry row).
export * from './sparkline/sparkline.ts'   // series-shape mark (LLD-C1/C2/C3)
export * from './bar-chart/bar-chart.ts'   // magnitude-comparison bar list (LLD-C4/C5/C6)

// Report family — Wave M1 (ADR-0111, report-family.lld.md): the real native <table>, the metric tile, and
// the compact-realm intent badge. All Display-class, non-interactive, non-form-associated leaves.
export * from './table/table.ts'   // scroll-preserving static data table (LLD-C1/C2/C3)
export * from './stat/stat.ts'     // metric tile, direction-as-text delta (LLD-C4/C5/C6)
export * from './badge/badge.ts'   // compact-realm intent badge (LLD-C7/C8)

// Content family — Wave M1 (ADR-0113, content-family.lld.md): the zero-machinery code leaf and the native
// <details>/<summary> disclosure. (The ui-text hyperlink extension lives in ./text/text.ts, exported above.)
export * from './code/code.ts'             // verbatim code leaf, host-as-content (LLD-C5/C6/C7)
export * from './disclosure/disclosure.ts' // native details/summary fold (LLD-C8/C9/C10)

// Feed family — Wave M1 (ADR-0112, feed-family.lld.md): agent-activity primitives. All Display/Indicator-
// class, non-form-associated leaves except the toast pair (pattern/layout, no catalog row — ADR-0112 cl.6).
export * from './progress/progress.ts'     // thin-rail progress bar (LLD-C1)
export * from './avatar/avatar.ts'         // compact identity mark (LLD-C2/C3)
export * from './attachment/attachment.ts' // FilePart-aligned file card, metadata surface only (LLD-C4/C5)
export * from './toast/toast.ts'           // transient notification card (LLD-C7)
export * from './toast/toast-region.ts'    // toast's top-layer host, same-folder sibling (LLD-C8)
