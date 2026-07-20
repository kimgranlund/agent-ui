// @agent-ui/components — package barrel. Re-exports each layer's public surface as it lands.
export * from './reactive/index.ts'
export * from './dom/index.ts'
// LLD-C6 (agent-admin-shell-rehost.lld.md §7, ADR-0154): ui-split's drag/keyboard/abort mechanism,
// widened onto the public surface (the ADR-0023 mount() precedent) so @agent-ui/app's ui-super-shell
// reuses ONE hardened drag implementation fleet-wide rather than re-deriving a second one. Named
// export only — the rest of traits/ stays internal until another consumer earns it the same way.
export { paneResize, type PaneResizeHandle, type PaneResizeOptions } from './traits/pane-resize.ts'
