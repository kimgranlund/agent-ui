// body.ts: the a2ui-basic catalog's lazy body (ADR-0241 cl.2). `records.ts` reaches this module only through
// `import()`, so both a2ui-basic ids (the short id and the canonical-URI alias) load on first use, never with
// the renderer. It carries the built-in control loader too, because since the ADR-0241 Amendment `controls.ts`
// is a lazy module that `records.ts` must not import statically. Re-exports only: the body modules themselves
// stay unchanged.

export { a2uiBasicCatalog, a2uiBasicCatalogCanonical } from './index.ts'
export { a2uiBasicFactories } from './factories.ts'
export { a2uiBasicFunctions } from './functions.ts'
export { builtinControls as controls } from '../controls.ts'
