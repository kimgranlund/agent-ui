// disposition-allowlist.ts — the durable home for a seed's recorded admission disposition (GH #335
// root cause, ADR-0068's own gap: an admission-time `E_QUALITY` reject is never written to the store —
// LLD §6, "the stage still runs but nothing lands on disk" — so a rejection's only trace used to be a
// hand-transcribed comment inside `admission-coverage.test.ts`. That comment was correct but SILOED:
// the standing gate read it, `tools/corpus/import-seeds.ts` never did, so a plain unjudged run had zero
// way to know `stats-grid-dashboard` had already been judged and turned away — it silently re-admitted
// it, and the run reported "0 quality-rejected" as if nothing had been bypassed.
//
// Extracted here (pure, zero-dep, platform-neutral — SPEC-N5/ADR-0062) so BOTH readers share the one
// map: the standing coverage gate (`admission-coverage.test.ts`, unchanged behavior) and the import
// tool's unjudged-run guard (`tools/corpus/import-seeds.ts`'s `dispositionGuard`). This does not touch
// ADR-0068's verdicts/judge/quarantine contract — quarantine still means "was admitted, later scored
// below bar" (SPEC-R13, one-way, lives IN the shard); a disposition-allowlist entry means "was judged
// at admission time and refused entry, never written" (the OTHER, previously unrecorded, outcome
// ADR-0068's own consequences section calls "queryable" without ever wiring up how). Deliberately not
// re-exported from `./index.ts`'s public "./corpus" barrel — this is import/coverage-tooling
// bookkeeping, not a corpus API surface a renderer consumer would ever want in its bundle.

/** Every example seed explicitly excused from corpus admission, with the reason it teaches nothing the
 *  corpus needs (the `EXCLUSION_ALLOWLIST` precedent, `catalog/default/index.test.ts`) — a future
 *  deliberately-minimal smoke seed, or a judged `E_QUALITY` rejection, is dispositioned HERE, with a
 *  citation, not in a chat log. */
export const DISPOSITION_ALLOWLIST = new Map<string, string>([
  [
    'stats-grid-dashboard',
    'judged E_QUALITY 2026-07-11 (VerdictsFile, rubric a2ui-corpus 1.0, D5=3 — strict-subset duplicate ' +
      'of the admitted pattern-dashboard-tiles, container-swap-only: same Card>CardContent>Column ' +
      'anatomy, same relative binds, same "${value}${unit}" interpolation, only Row swapped for Grid). ' +
      'Grid coverage survives via kpi-panel-lifecycle (PASS). Repair path (not this wave, tkt-0022 ' +
      'Findings): differentiate the tile beyond the subset, or teach a Grid-specific behavior Row ' +
      'cannot express — then re-admit via the judged pipeline (a fresh import, not `--replace`, since ' +
      'this record was never written).',
  ],
])
