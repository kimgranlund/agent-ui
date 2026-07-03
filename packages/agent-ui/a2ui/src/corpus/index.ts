// @agent-ui/a2ui/corpus — the corpus store's public read/admission surface (corpus LLD §12, ADR-0062).
// Exposed ONLY via the package.json "./corpus" subpath export — the root barrel (`../index.ts`) does
// NOT re-export this module (consumer-bundle hygiene: admission/heal/canonicalize/retrieval code must
// never enter a renderer consumer's bundle — the `"./examples"` precedent, ADR-0055 clause 3).
//
// Platform-neutral pure core only (SPEC-N5/ADR-0062): every re-export below resolves to a module under
// `src/corpus/` with zero `node:*`/third-party imports. Nothing from `tools/corpus/` (the Node fs shell:
// `fs-store.ts`/`import-seeds.ts`) is re-exported here — a consumer of this subpath never pulls in `fs`.

export * from './record.ts'
export * from './canonical.ts'
export * from './heal.ts'
export * from './dedup.ts'
export * from './store.ts'
export * from './admit.ts'
export * from './retrieve.ts'
export * from './export.ts'
export * from './validate.ts'
export * from './judge.ts'
