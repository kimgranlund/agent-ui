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
export * from './toolbar/toolbar.ts' // Pattern-class action bar (ADR-0121) — role=toolbar + roving focus, posture via elevation/brightness

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

// Token-surface family — M1 (ADR-0118, token-surfaces.lld.md): show-never-edit color/dimension primitives.
// All three Display-class, non-interactive, non-form-associated leaves — extend UIElement directly, tier=
// display, no [size]/[scale] geometry row. Share the DOM-free value-lane helper `_token-surface/token-surface.ts`.
export * from './swatch/swatch.ts' // color-identity leaf, role=img + composed name (LLD-C2/C3)
export * from './ramp/ramp.ts'     // ordered color series, role=list (LLD-C4/C5)
export * from './ladder/ladder.ts' // labeled dimensional tiers, literal-length bars, role=list (LLD-C6/C7)

// Feed family — Wave M1 (ADR-0112, feed-family.lld.md): agent-activity primitives. All Display/Indicator-
// class, non-form-associated leaves except the toast pair (pattern/layout, no catalog row — ADR-0112 cl.6).
export * from './progress/progress.ts'     // thin-rail progress bar (LLD-C1)
export * from './avatar/avatar.ts'         // compact identity mark (LLD-C2/C3)
export * from './attachment/attachment.ts' // FilePart-aligned file card, metadata surface only (LLD-C4/C5)
export * from './toast/toast.ts'           // transient notification card (LLD-C7)
export * from './toast/toast-region.ts'    // toast's top-layer host, same-folder sibling (LLD-C8)

// M4 Phase 1 — the split primitive (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C1): a Container/layout
// control (tier: layout, sibling to ui-row/-column/-grid) — one folder, TWO real components (the
// radio/radio-group precedent): ui-split (the N-pane resizable container) + ui-split-pane (the generic
// pane child, own descriptor/contract per ADR-0080's radio-group special case).
export * from './split/split.ts'
export * from './split/split-pane.ts'

// Timeline family — ADR-0122 (timeline-family.lld.md): a three-tag event-rail family — the shared inert
// visual atom (ui-timeline-item), its durable authored-children host (ui-timeline, role=list), and its
// live imperatively-fed sibling (ui-status-stream, role=log). The item lands first — both hosts depend on it.
export * from './timeline-item/timeline-item.ts' // the shared marker+content+detail rail row (F1/F2/F3/F6)
export * from './timeline/timeline.ts'           // the durable host — authored children, static (F1/F6)
export * from './status-stream/status-stream.ts' // the live host — append/update/finalize, tail-follow (F4)

// ADR-0124 — the ui-swiper family: a CSS-native scroll-snap carousel (swiper-family.lld.md). swiper.ts
// imports the four leaf modules (registering all five family tags on its own import), but each of the
// five carries its own `{name}.md` descriptor (LLD §10 — unlike ui-tab/ui-tab-panel, which have none), so
// every one gets its own barrel export line too (the C1 lifecycle bijection, family-coherence.test.ts) —
// a harmless re-export of an already-registered module, and it surfaces each leaf's class at the barrel.
export * from './swiper/swiper.ts'
export * from './swiper/swiper-item.ts'
export * from './swiper/swiper-pagination.ts'
export * from './swiper/swiper-paddles.ts'
export * from './swiper/swiper-label.ts'

// ADR-0125 — ui-command-modal, the CMD-K command palette (command-modal.lld.md): a Pattern-class coordinator
// that nests a ui-modal for the surface and re-derives ui-combo-box's active-descendant filter. Permanently
// catalog-excluded (app-owner launcher chrome, F8) — still a fleet member, exported like any other control.
export * from './command-modal/command-modal.ts'
