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
  //
  // `agent-roster-drawer` (ADR-0188/GH #863, the same pending-state shape as the four above) was judged
  // and ADMITTED 2026-08-16 (VerdictsFile `corpus/verdicts/2026-08-16--gh972-high-frequency.json`,
  // qualityScore 4/PASS) — as part of unblocking GH #972's unrelated judged wave (a wired judge fails
  // closed across the WHOLE shelf, not just new candidates; this seed had sat unjudged since 2026-08-13
  // and was blocking every subsequent import run). Entry removed per this map's own instruction above.
  //
  // GH #1184 (2026-08-17) — `frontier-round-outcome`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added with the Toast catalog row to close the type-coverage gap
  // (examples.test.ts's GH #729 gate); its corpus admission is a pending judged import wave — the
  // authoring session judging its own seed is the manufactured judgment ADR-0068's Alternatives ban.
  // Run the judged pipeline and DELETE this entry when that wave lands.
  [
    'frontier-round-outcome',
    'GH #1184 (2026-08-17) — no verdict sought yet, not a refusal: shelf seed added alongside the Toast ' +
      'catalog row (Kim ruling: ephemeral outcome announcements are Toasts) to keep the GH #729 ' +
      'type-coverage gate green; pending a judged import wave (import-seeds.ts with a real VerdictsFile). ' +
      'Delete this entry when it is judged.',
  ],
  //
  // ADR-0201/GH #1185 (2026-08-17) — `frontier-booking-receipt`: the same pending-state shape (NO VERDICT
  // SOUGHT YET, not a refusal). Added with the DescriptionList catalog row to close the type-coverage gap
  // (examples.test.ts's GH #729 gate); its corpus admission is a pending judged import wave — the
  // authoring session judging its own seed is the manufactured judgment ADR-0068's Alternatives ban.
  // Run the judged pipeline and DELETE this entry when that wave lands.
  [
    'frontier-booking-receipt',
    'ADR-0201/GH #1185 (2026-08-17) — no verdict sought yet, not a refusal: shelf seed added alongside ' +
      'the DescriptionList catalog row (the key–value receipt primitive) to keep the GH #729 ' +
      'type-coverage gate green; pending a judged import wave (import-seeds.ts with a real VerdictsFile). ' +
      'Delete this entry when it is judged.',
  ],
  //
  // GH #1189 (2026-08-17) — `frontier-image-hero-card`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added with the Image catalog row to close the type-coverage gap
  // (examples.test.ts's GH #729 gate); its corpus admission is a pending judged import wave — the
  // authoring session judging its own seed is the manufactured judgment ADR-0068's Alternatives ban.
  // Run the judged pipeline and DELETE this entry when that wave lands.
  [
    'frontier-image-hero-card',
    'GH #1189 (2026-08-17) — no verdict sought yet, not a refusal: shelf seed added alongside the Image ' +
      'catalog row (the URL-sourced content-image primitive, zero-CLS hero usage) to keep the GH #729 ' +
      'type-coverage gate green; pending a judged import wave (import-seeds.ts with a real VerdictsFile). ' +
      'Delete this entry when it is judged.',
  ],
  //
  // GH #1199 (2026-08-17) — `frontier-card-anatomy-ask`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added alongside the grammar.md card-anatomy clause (req-a2ui-patterns.md R1) as
  // its worked corpus exemplar — the authoring session judging its own seed is the manufactured judgment
  // ADR-0068's Alternatives ban. Run the judged pipeline and DELETE this entry when that wave lands.
  [
    'frontier-card-anatomy-ask',
    'GH #1199 (2026-08-17) — no verdict sought yet, not a refusal: shelf seed added alongside the ' +
      'grammar.md card-anatomy clause (req-a2ui-patterns.md R1) as its worked three-slot ask-card ' +
      'exemplar; pending a judged import wave (import-seeds.ts with a real VerdictsFile). Delete this ' +
      'entry when it is judged.',
  ],
  //
  // GH #1192 (2026-08-18) — `backable-wizard`: the same pending-state shape (NO VERDICT SOUGHT YET, not
  // a refusal). Added alongside the grammar.md backable-multi-step clause + its ADR-0198 amendment B1
  // carve-out (req-a2ui-patterns.md R2) as its worked 3-step exemplar — the authoring session judging its
  // own seed is the manufactured judgment ADR-0068's Alternatives ban. Run the judged pipeline and DELETE
  // this entry when that wave lands.
  [
    'backable-wizard',
    'GH #1192 (2026-08-18) — no verdict sought yet, not a refusal: shelf seed added alongside the ' +
      'grammar.md backable-multi-step clause (req-a2ui-patterns.md R2, ADR-0198 amendment B1) as its ' +
      'worked 3-step dates→room→confirm exemplar; pending a judged import wave (import-seeds.ts with a ' +
      'real VerdictsFile). Delete this entry when it is judged.',
  ],
  //
  // GH #1205 (2026-08-17) — the four COMPOSITION PACK A seeds (`slideshow-gallery` ·
  // `confirmation-view` · `trend-list` · `card-layouts`): the same pending-state shape (NO VERDICT
  // SOUGHT YET, not a refusal). Added as the req-a2ui-library R4 now-tier pattern seeds — the authoring
  // session judging its own seeds is the manufactured judgment ADR-0068's Alternatives ban. Run the
  // judged pipeline (import-seeds.ts with a real VerdictsFile) and DELETE these entries when that wave
  // lands.
  [
    'slideshow-gallery',
    'GH #1205 (2026-08-17) — no verdict sought yet, not a refusal: composition-pack-A shelf seed ' +
      '(req-a2ui-library R4 slideshow row — Swiper > SwiperItem > Image with scrim captions); pending ' +
      'a judged import wave. Delete this entry when it is judged.',
  ],
  [
    'confirmation-view',
    'GH #1205 (2026-08-17) — no verdict sought yet, not a refusal: composition-pack-A shelf seed ' +
      '(req-a2ui-library R4 confirmation row — the three-slot Card + DescriptionList receipt + footer ' +
      'Button pair composition); pending a judged import wave. Delete this entry when it is judged.',
  ],
  [
    'trend-list',
    'GH #1205 (2026-08-17) — no verdict sought yet, not a refusal: composition-pack-A shelf seed ' +
      '(req-a2ui-library R4 trend-list row — List > Row{Text · Sparkline · Stat delta}, templated); ' +
      'pending a judged import wave. Delete this entry when it is judged.',
  ],
  [
    'card-layouts',
    'GH #1205 (2026-08-17) — no verdict sought yet, not a refusal: composition-pack-A shelf seed ' +
      '(req-a2ui-library R4 card-layouts row — card bodies as list/columns/grid arrangements); pending ' +
      'a judged import wave. Delete this entry when it is judged.',
  ],
])
