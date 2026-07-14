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
// ADR-0130 (nav-rail family) Phase 1 — the family's public surface. Importing `nav-rail.ts` registers all
// three tags (it imports nav-rail-group.ts / nav-rail-item.ts in turn). The `package.json` `./nav-rail`
// subpath + the app-package size re-base are LLD-C12 (Phase 3, after both consumer migrations land) —
// not added here; this is the barrel export only.
export { UINavRailElement } from './controls/nav-rail/nav-rail.ts'
export { UINavRailGroupElement } from './controls/nav-rail/nav-rail-group.ts'
export { UINavRailItemElement } from './controls/nav-rail/nav-rail-item.ts'
// M2 Phase 1 (app-surfaces-m2.lld.md LLD-C1/C4) — the agent-native pair: ui-surface-host (the mount/stream
// seam) + ui-conversation (thread/composer/narration, composing ui-surface-host internally, ADR-0129).
export { UISurfaceHostElement } from './controls/surface-host/surface-host.ts'
export { UIConversationElement } from './controls/conversation/conversation.ts'
export type { AgentTurnHandle } from './controls/conversation/conversation.ts'
// TKT-0039 (ADR-0131) — the Agent Admin UI: composes ui-split/ui-settings/ui-conversation into one new
// app-tier surface. No new primitive family, no new protocol dependency.
export { UIAgentAdminElement } from './controls/agent-admin/agent-admin.ts'
export { defaultAgentConfigSchema, runStubAgentTurn } from './controls/agent-admin/agent-admin-schema.ts'
export type { AgentConfigSnapshot } from './controls/agent-admin/agent-admin-schema.ts'
// ADR-0132 — the generic ordered-entry-list primitive: prompt sections (Foundation/Personality/Critical
// Items) + Skills/Workflows/Resources/Tools, five instantiations of one shape.
export { ENTRY_KINDS, DEFAULT_PROMPT_SECTIONS, DEFAULT_SYSTEM_PROMPT_FALLBACK, composeSystemPrompt, validateNewEntry } from './controls/agent-admin/entries.ts'
export type { Entry, NewEntryInput } from './controls/agent-admin/entries.ts'
