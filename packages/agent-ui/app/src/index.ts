// @agent-ui/app — package barrel. Re-exports each control's public surface as it lands.
// M5 (GH #83, shell-archetypes-m5.spec.md) — the archetype family's grammar ceiling.
export { UISuperShellElement } from './controls/super-shell/super-shell.ts'
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
export type { AgentTurnHandle, TurnAction } from './controls/conversation/conversation.ts'
// ADR-0197 (GH #1092) — the agent-admin arm LEFT this barrel. Its static exports
// (`UIAgentAdminElement`, the schema/entries/prompt-lint/entry-data values and types) live on the
// `./agent-admin*` + `./entry-data` subpaths only (clause 2 added `./agent-admin-entries` and
// `./agent-admin-prompt-lint`), so barrel consumers stop paying the arm's ~22 % of the entry graph
// (agent-admin-lazy.bundle.test.ts is the trip-wire). The one barrel affordance that remains is the
// memoized LAZY accessor below (ADR-0197 cl.3, the dogfood-lazy shape): importing the arm's module
// self-defines `<ui-agent-admin>` (fleet idiom), so a mount-only consumer writes
// `await loadAgentAdmin(); html\`<ui-agent-admin>…\``. Same-origin chunk ⇒ no timeout ceiling (the
// markdown-lazy failure/timeout precedents carry the degrade contract); a REJECTED load is dropped
// from the memo so the next call retries instead of inheriting a poisoned promise, while a resolved
// one is reused for the page's whole lifetime.
let agentAdminMemo: Promise<typeof import('./controls/agent-admin/agent-admin.ts')> | undefined
export function loadAgentAdmin(): Promise<typeof import('./controls/agent-admin/agent-admin.ts')> {
  if (agentAdminMemo === undefined) {
    agentAdminMemo = import('./controls/agent-admin/agent-admin.ts').catch((err: unknown) => {
      agentAdminMemo = undefined
      throw err
    })
  }
  return agentAdminMemo
}
