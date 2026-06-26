// @agent-ui/a2ui — package barrel. Re-exports each subsystem's public surface as it lands.
// This slice: the shared validator (renderer LLD-C11) + the catalog model/validators it composes.
export * from './protocol.ts'
export * from './catalog/index.ts'
export * from './renderer/index.ts'
