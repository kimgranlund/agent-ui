// ledger-path.ts — the ONE place the corpus's HV-citation resolution and the standing gate agree on
// where the host-verification ledger lives (corpus LLD §4 hardening, the sanctioned-with-hardening
// review ruling: the standing gate's HV-ledger leg is a GENUINE cross-layer coupling — a test reading a
// design doc — that a2ui's own `corpus-data.test.ts` precedent never needed, since it only ever reads
// committed data shards). Both `import-seeds.ts` (real citation resolution, at import time) and
// `../../src/corpus/corpus-data.test.ts` (the standing gate's re-check, at test time) import ONLY this
// constant + helper — never redeclare the path or re-derive the resolution rule. If the SPEC file ever
// moves/renames, this is the one-line greppable fix.

export const LEDGER_PATH = '.claude/docs/spec/a2a-foundations.spec.md'

/**
 * Does the ledger's §2 host-verification table carry `row` (e.g. `"HV-10"`) with a resolution marker
 * (`CONFIRMED`/`CORRECTED`) recorded in that SAME table row? A row present but never resolved does NOT
 * count — SPEC-R1: "No build unit may be dispatched against an unresolved HV row." Each `| **HV-n** | ... |`
 * row is authored as a single markdown-table line (verified against the committed SPEC), so a per-line
 * scan is sufficient — no markdown-table parser needed for this one shape.
 */
export function isHvRowResolved(ledgerText: string, row: string): boolean {
  const escaped = row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rowPattern = new RegExp(`^\\|\\s*\\*\\*${escaped}\\*\\*\\s*\\|`)
  const line = ledgerText.split('\n').find((l) => rowPattern.test(l))
  if (line === undefined) return false
  // Anchored to the ledger's BOLDED resolution form (`**CONFIRMED**`/`**CORRECTED...**`) so prose
  // mentions elsewhere in the row (a belief cell saying "corrected", an UNCONFIRMED) can never
  // false-positive the SPEC-R1 unresolved-row guard (review-hardened).
  return /\*\*(CONFIRMED|CORRECTED)\b/.test(line)
}
