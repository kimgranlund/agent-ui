// disposition-allowlist.ts — the CURATED-PROSE layer of a seed's recorded admission disposition.
//
// **DEMOTED by ADR-0165 clause 6 — read this before adding an entry.** This module used to be described
// as "the durable home" for an admission-time `E_QUALITY` refusal, and it was, for as long as the only
// trace of one was something a human typed. It is not that any more: the durable, machine-readable
// record is the ARCHIVED VERDICTS FILE (`corpus/verdicts/`, ADR-0165 clause 1) — written verbatim by the
// judged run that made the decision, in the same all-or-nothing step as the store write, with zero
// marginal human effort. Both consumers below check that archive FIRST and this map second.
//
// What survives here is exactly what a machine cannot state (clause 6 — demoted, never retired):
//   1. a deliberately-minimal smoke seed that teaches the corpus nothing (no verdict was ever sought);
//   2. a refusal whose verdicts file PREDATES the archive — today, `stats-grid-dashboard`. ADR-0165
//      clause 8 rules out retro-archiving it: the M-B wave's verdicts files were never committed, and
//      fabricating one would be the manufactured judgment ADR-0068's Alternatives ban.
// A NEW refusal needs no entry — because the refused SEED LEAVES THE SHELF. ADR-0165's REV 2026-07-30
// (GH #361, reading (b) — the `retreat-reschedule` precedent) rules that dropping the seed from
// `src/examples/` entirely is a refusal's expected disposition, so its name is no longer in `allSeeds` and
// `seedsMissingAdmission` can never see it. The gate did NOT stop requiring an entry for a candidate: a
// refusal KEPT on the shelf is still un-admitted and un-allowlisted, so it still reds until an entry lands
// here. Beyond that, an entry is optional prose, worth it only to carry what a verdict cannot — a coverage
// argument, a repair path (the shipped entry below carries both).
//
// Pure, zero-dep, platform-neutral (SPEC-N5/ADR-0062) so both readers share the one map: the standing
// coverage gate (`admission-coverage.test.ts`) and the import tool's unjudged-run guard
// (`tools/corpus/import-seeds.ts`'s `dispositionGuard`). This does not touch ADR-0068's
// verdicts/judge/quarantine contract — quarantine still means "was admitted, later scored below bar"
// (SPEC-R13, one-way, lives IN the shard); a disposition entry means "was judged at admission time and
// refused entry, never written" (the OTHER outcome ADR-0068's Consequences called "queryable" without
// wiring up how — ADR-0165 is that wiring). Deliberately not re-exported from `./index.ts`'s public
// "./corpus" barrel — import/coverage-tooling bookkeeping, not a corpus API surface a renderer consumer
// would ever want in its bundle; `verdict-archive.ts` follows the same ruling.

/** Every example seed explicitly excused from corpus admission, with the reason it teaches nothing the
 *  corpus needs (the `EXCLUSION_ALLOWLIST` precedent, `catalog/default/index.test.ts`). The SECOND guard
 *  input and the SECOND gate input, not the primary record (ADR-0165 clause 6) — the archived verdicts
 *  file is the primary one. */
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
  // GH #729 (2026-08-12) — the four CATALOG-FRONTIER seeds: NO VERDICT SOUGHT YET, not a refusal. Added
  // by the example sweep to close the 13-component coverage gap (catalog-frontier.ts's own header); their
  // corpus admission is a PENDING judged import wave the sweep could not run — the a2ui-reviewer judge
  // seat was unreachable (session subagent ceiling), and the authoring session judging its own seeds is
  // exactly the manufactured judgment ADR-0068's Alternatives ban. These four entries are the loud,
  // dated record of that pending state (category 1's no-verdict-sought shape, temporarily): run the
  // judged pipeline (`import-seeds.ts` with real VerdictsFiles) and DELETE these entries when the wave
  // lands — an entry surviving after admission is the drift this map's gate exists to catch.
])
