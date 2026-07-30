// @agent-ui/components — package barrel. Re-exports each layer's public surface as it lands.
export * from './reactive/index.ts'
export * from './dom/index.ts'
// LLD-C6 (agent-admin-shell-rehost.lld.md §7, ADR-0154): ui-split's drag/keyboard/abort mechanism,
// widened onto the public surface (the ADR-0023 mount() precedent) so @agent-ui/app's ui-super-shell
// reuses ONE hardened drag implementation fleet-wide rather than re-deriving a second one. Named
// export only — the rest of traits/ stays internal until another consumer earns it the same way.
export { paneResize, type PaneResizeHandle, type PaneResizeOptions } from './traits/pane-resize.ts'
// SPEC-R10b (ADR-0155): the edge-aware scroll-fade affordance, widened onto the public surface (the
// paneResize precedent one line above) so ui-super-shell's hidden-scrollbar seam has the fleet's ONE
// fade trait as the replacement scroll signal, never a silent deep-import into @agent-ui/app.
export { scrollFade, type ScrollFadeOptions } from './traits/scroll-fade.ts'
// GH #368 — the non-modal Overlay controller (ADR-0043/0045) is deliberately NOT re-exported here, even
// though `ui-nav-rail`'s `collapse="menu"` arm needs it. Adding it MEASURED +945 B gz on this barrel's own
// budgeted row (7442 → 8387 against a 7680 B gz budget), because `overlay.ts` carries the whole
// measure-and-place positioning controller and this row is the reactive+dom foundation every consumer pays
// for. It ships instead as its OWN declared subpath, `@agent-ui/components/traits/overlay` (package.json
// exports, the `./descriptor` shape) — a real public surface, not the silent deep-import the scrollFade
// note above rules out, and not a cost on the foundation row.
