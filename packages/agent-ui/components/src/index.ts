// @agent-ui/components — package barrel. Re-exports each layer's public surface as it lands.
export * from './reactive/index.ts'
export * from './dom/index.ts'
// ADR-0167's route for a trait's public surface is keyed on its consumer set and its MEASURED cost on
// this barrel's own budgeted row: internal by default (most of traits/) · this root barrel when the row
// absorbs it · an own ./traits/* subpath when it does not · re-examine the trait when it is heavy AND its
// runtime import closure is non-empty. The route is chosen from a measurement, never an argument.
// T-0526 (Kim, 2026-10-28): paneResize (ADR-0154 LLD-C6) and scrollFade (ADR-0155 SPEC-R10b), once
// re-exported here, moved to `./traits/pane-resize` and `./traits/scroll-fade` (805 B gz off this row,
// 7659 -> 6854), so no trait rides the root barrel any more.
// GH #368 — the non-modal Overlay controller (ADR-0043/0045) is deliberately NOT re-exported here, even
// though `ui-nav-rail`'s `collapse="menu"` arm needs it. Adding it MEASURED +945 B gz on this barrel's own
// budgeted row (7442 → 8387 against a 7680 B gz budget), because `overlay.ts` carries the whole
// measure-and-place positioning controller and this row is the reactive+dom foundation every consumer pays
// for. It ships instead as its OWN declared subpath, `@agent-ui/components/traits/overlay` (package.json
// exports, the `./descriptor` shape): a real public surface, not a silent deep import, and not a cost
// on the foundation row.
