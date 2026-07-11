// @agent-ui/app — package barrel. Re-exports each control's public surface as it lands.
// LLD-C3 landed the ui-app-shell/ui-app-shell-region element; this export is its LLD-C8 public surface.
export { UIAppShellElement, UIAppShellRegionElement } from './controls/app-shell/app-shell.ts'
// M4 Phase 2 (LLD-C10/C16) — the master-detail composition + its docking sub-element.
export { UIMasterDetailElement } from './controls/master-detail/master-detail.ts'
export { UIMasterDetailPaneElement } from './controls/master-detail/master-detail-pane.ts'
// M4 Phase 3 (LLD-C12/C13/C15/C16) — the settings surface + its schema/store contracts.
export { UISettingsElement } from './controls/settings/settings.ts'
export type {
  SettingsSchema,
  SettingsSection,
  SettingsField,
  SettingsFieldType,
  SettingsFieldValidation,
  SettingsFieldOption,
} from './controls/settings/schema.ts'
export type { SettingsStore } from './controls/settings/store.ts'
export { createMemoryStore } from './controls/settings/memory-store.ts'
export type { MemoryStoreOptions } from './controls/settings/memory-store.ts'
