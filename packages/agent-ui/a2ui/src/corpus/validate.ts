// corpus/validate.ts — corpus admission tier-1 validator (corpus LLD-C6).
//
// It does NOT re-implement validation: it re-exports the single shared `renderer/validate.ts`, so
// admission and the runtime share ONE code path and return identical verdicts (validator parity —
// runtime SPEC-N6 / corpus SPEC-N1). This thin adapter closes the corpus LLD step-3 import TODO;
// the rest of the admission pipeline (record/canonical/dedup/admit/heal) lands with the corpus work.
export { validateA2ui } from '../renderer/validate.ts'
export type { ValidationVerdict } from '../renderer/validate.ts'
