// index.ts — the @agent-ui/icons root barrel (LLD-C6, ADR-0065/0066). Re-exports the pack-agnostic
// core ONLY: types (LLD-C1) + registry (LLD-C2) + resolve/setIcon (LLD-C3). Deliberately does NOT
// re-export `phosphor` — that pack lives ONLY behind the `@agent-ui/icons/phosphor` subpath (the
// ADR-0055/0062 subpath-hygiene rule), so a consumer importing just `@agent-ui/icons` drags zero
// Phosphor bytes; Phosphor is reachable only via its own subpath import.

export { ICON_NAMES } from './types.ts'
export type { IconName, IconPack } from './types.ts'
export { Registry, iconRegistry } from './registry.ts'
export type { IconRegistry } from './registry.ts'
export { resolveIcon, setIcon } from './resolve.ts'
