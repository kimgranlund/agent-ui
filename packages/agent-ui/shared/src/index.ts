// @agent-ui/shared — cross-cutting tokens, styles, and utility types shared across packages.
// Tokens/styles land at G5; consumed by @agent-ui/components and @agent-ui/a2ui.
// ADR-0135 Piece A: the pure `SettingsSchema` vocabulary + its fail-closed guards, the first TypeScript
// export from the '.' surface — types via `export type *`, the guard FUNCTIONS as a value re-export.
export type * from './settings-schema.ts'
export { findField, initialValuesFor, sanitizeNumber, sanitizeSelect } from './settings-schema.ts'
