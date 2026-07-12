// import-report.ts — `tools/corpus/import-seeds.ts`'s per-batch reporting/abort policy, extracted as a
// pure decision so it is unit-testable without a real store/fs (TKT-0022's E_QUALITY fix).
//
// A single `import-seeds.ts` run walks many candidates through `admit()`; every non-`E_DUP` rejection
// it collects along the way used to be batched into ONE bucket that aborted the whole run (nothing
// written, even for candidates that themselves passed) if it held anything at all. That is still the
// right call for a genuine pipeline/candidate defect (`E_SCHEMA`/`E_CATALOG`/`E_IDGRAPH`/`E_POINTER`/
// `E_PIN`/`E_LEAK`) — those signal something is actually broken, worth stopping to investigate. But
// `E_QUALITY` is different: the tier-2 rubric (`a2ui-corpus.md`) frames a below-bar score as a NORMAL,
// anticipated admission outcome ("Below-bar on admission → reject `E_QUALITY`"), the exact same category
// `E_DUP` already gets its own non-aborting `alreadyPresent` lane for. This module gives `E_QUALITY` the
// same treatment: it joins the non-aborting lane, reported distinctly, never written, but without
// blocking every OTHER candidate that passed in the same run (ADR-0060/0068 territory — ratified here in
// the realized tool, not by editing either accepted ADR; the ticket Findings record this decision).

import type { AdmitCode } from './record.ts'

/** One seed's non-`E_DUP` rejection, exactly as `import-seeds.ts`'s loop already collects it from an
 *  `AdmitResult` (name + the result's own failure fields) — shaped for classification, nothing re-validated. */
export interface SeedRejection {
  name: string
  code: AdmitCode
  message: string
  paths?: string[]
  failingDimensions?: string[]
}

/** The two reporting/abort lanes a batch of collected rejections splits into. */
export interface BatchReport {
  /** `E_QUALITY` rejections — reported, never written, but do NOT abort the run (TKT-0022's fix). */
  qualityRejected: SeedRejection[]
  /** Every other rejection code — reported AND aborts the whole run (nothing written, even for
   *  candidates that themselves passed) — the pre-existing, unchanged hard-abort behavior. */
  hardErrors: SeedRejection[]
}

/** Partition a batch's collected non-`E_DUP` rejections into the two lanes above. Pure — no I/O, no
 *  process/store access — so `import-seeds.ts`'s batch-abort policy is unit-testable on its own. */
export function classifyRejections(rejections: readonly SeedRejection[]): BatchReport {
  const qualityRejected = rejections.filter((r) => r.code === 'E_QUALITY')
  const hardErrors = rejections.filter((r) => r.code !== 'E_QUALITY')
  return { qualityRejected, hardErrors }
}

/** `true` iff `report.hardErrors` is non-empty — the run must abort before `saveStore()` is ever called
 *  (nothing written, not even candidates that themselves passed). A `qualityRejected`-only report — even
 *  a non-empty one — does NOT abort: every candidate that passed in the same run still gets written. */
export function shouldAbort(report: BatchReport): boolean {
  return report.hardErrors.length > 0
}
