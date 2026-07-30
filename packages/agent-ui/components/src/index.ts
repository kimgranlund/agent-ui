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
// GH #368: the non-modal Overlay controller (ADR-0043/0045), widened onto the public surface — the THIRD
// application of the same paneResize/scrollFade precedent two lines above, for the same reason. `ui-nav-
// rail`'s `collapse="menu"` arm is a floating panel anchored to a trigger, which is exactly the row
// `agent-ui-component-patterns` already assigns to this controller; @agent-ui/app must reach the ONE
// shipped implementation by a NAMED export rather than deep-importing `traits/overlay.ts` (the deep-import
// this barrel's scrollFade note explicitly rules out). Zero new bytes: every overlay control in the
// components barrel (menu/select/tooltip/popover/combo-box) already pulls this module in.
export { overlay, computePosition, type OverlayHandle, type OverlayOptions, type OverlayPlacement } from './traits/overlay.ts'
