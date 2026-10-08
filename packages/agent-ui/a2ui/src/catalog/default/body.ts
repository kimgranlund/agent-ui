// body.ts: the default `agent-ui` catalog's lazy body (ADR-0241 Amendment). `records.ts` reaches this module only
// through `import()`, so the default document, its factory table and the built-in control registry load the first
// time a surface names `agent-ui` or an `agent-ui--<persona>` id, never with the renderer. Re-exports only: the body
// modules themselves stay unchanged.

export { defaultCatalog } from './index.ts'
export { defaultFactories } from './factories.ts'
export { builtinControls as controls } from '../controls.ts'
