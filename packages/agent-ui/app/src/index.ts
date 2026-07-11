// @agent-ui/app — package barrel. Re-exports each control's public surface as it lands.
// LLD-C3 landed the ui-app-shell/ui-app-shell-region element; this export is its LLD-C8 public surface.
export { UIAppShellElement, UIAppShellRegionElement } from './controls/app-shell/app-shell.ts'
// M4 Phase 2 (LLD-C10/C16) — the master-detail composition + its docking sub-element.
export { UIMasterDetailElement } from './controls/master-detail/master-detail.ts'
export { UIMasterDetailPaneElement } from './controls/master-detail/master-detail-pane.ts'
