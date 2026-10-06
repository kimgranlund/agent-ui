// index.ts: the `@agent-ui/a2ui/registry` subpath, the capability registry's pure model and composition
// (GH #1807). Opt-in like `./agent` and `./corpus`: the root barrel re-exports nothing from here, so a
// renderer-only consumer carries zero registry bytes.

export * from './types.ts'
export { composeRegistry, registryViewFor, tagForType, typeForTag, FLEET_CATALOG_ID } from './compose.ts'
export { selectCapabilities } from './select.ts'
