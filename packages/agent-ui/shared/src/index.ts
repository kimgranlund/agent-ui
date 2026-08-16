// @agent-ui/shared — cross-cutting tokens, styles, and utility types shared across packages.
// Tokens/styles land at G5; consumed by @agent-ui/components and @agent-ui/a2ui.
// ADR-0135 Piece A: the pure `SettingsSchema` vocabulary + its fail-closed guards, the first TypeScript
// export from the '.' surface — types via `export type *`, the guard FUNCTIONS as a value re-export.
export type * from './settings-schema.ts'
export { findField, initialValuesFor, sanitizeBoolean, sanitizeNumber, sanitizeSelect } from './settings-schema.ts'

// ADR-0193 (GH #959 Slice 1): the `StorageAdapter` persistence seam + its localStorage/IndexedDB tiers —
// the second export family from the '.' surface, at the DAG's bottom so any layer at or above `shared`
// can persist without an upward import.
export type * from './storage/adapter.ts'
export { createLocalStorageAdapter } from './storage/local-storage-adapter.ts'
export type { LocalStorageAdapterOptions } from './storage/local-storage-adapter.ts'
export { createIndexedDbAdapter } from './storage/indexed-db-adapter.ts'
export type { IndexedDbAdapterOptions } from './storage/indexed-db-adapter.ts'
