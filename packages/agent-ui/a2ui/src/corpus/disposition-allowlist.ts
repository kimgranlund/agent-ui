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
    'judged E_QUALITY 2026-08-18 (VerdictsFile packages/agent-ui/a2ui/corpus/verdicts/2026-08-18--verdicts-2026-08-18.json, rubric a2ui-corpus 1.1, a2ui-review-agent (independent of the authoring session per ADR-0068)). Failing: D5. ' +
      'nothing new taught: the tile template is pattern-dashboard-tiles verbatim minus the delta line (wrapper Row to Grid); Grid-template-of-Cards is already admitted (comparison-pricing-table, media-file-grid). Repair: drop from the shelf, or re-author to teach a genuinely new composition (delta+sparkline tile pair, a responsive tile-count rule) and re-judge. ' +
      'KEPT on the shelf pending that repair (a coverage-gate candidate until re-judged; drop the seed instead if the repair is abandoned).',
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
  //
  // ADR-0201/GH #1185 (2026-08-17) — `frontier-booking-receipt`: the same pending-state shape (NO VERDICT
  // SOUGHT YET, not a refusal). Added with the DescriptionList catalog row to close the type-coverage gap
  // (examples.test.ts's GH #729 gate); its corpus admission is a pending judged import wave — the
  // authoring session judging its own seed is the manufactured judgment ADR-0068's Alternatives ban.
  // Run the judged pipeline and DELETE this entry when that wave lands.
  //
  // GH #1189 (2026-08-17) — `frontier-image-hero-card`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added with the Image catalog row to close the type-coverage gap
  // (examples.test.ts's GH #729 gate); its corpus admission is a pending judged import wave — the
  // authoring session judging its own seed is the manufactured judgment ADR-0068's Alternatives ban.
  // Run the judged pipeline and DELETE this entry when that wave lands.
  //
  // GH #1199 (2026-08-17) — `frontier-card-anatomy-ask`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added alongside the grammar.md card-anatomy clause (req-a2ui-patterns.md R1) as
  // its worked corpus exemplar — the authoring session judging its own seed is the manufactured judgment
  // ADR-0068's Alternatives ban. Run the judged pipeline and DELETE this entry when that wave lands.
  [
    'frontier-card-anatomy-ask',
    'judged E_QUALITY 2026-08-18 (VerdictsFile packages/agent-ui/a2ui/corpus/verdicts/2026-08-18--verdicts-2026-08-18.json, rubric a2ui-corpus 1.1, a2ui-review-agent (independent of the authoring session per ADR-0068)). Failing: D2. ' +
      'promptText is the AGENT ask (Which room would you like? Standard or Deluxe King?), not a user-voiced request like every shard promptText; the payload itself is the clean R1 shape. Repair: reword promptText user-voiced (I need to pick a room type for my stay) and re-judge; borderline, expected to admit. ' +
      'KEPT on the shelf pending that repair (a coverage-gate candidate until re-judged; drop the seed instead if the repair is abandoned).',
  ],
  //
  // GH #1192 (2026-08-18) — `backable-wizard`: the same pending-state shape (NO VERDICT SOUGHT YET, not
  // a refusal). Added alongside the grammar.md backable-multi-step clause + its ADR-0198 amendment B1
  // carve-out (req-a2ui-patterns.md R2) as its worked 3-step exemplar — the authoring session judging its
  // own seed is the manufactured judgment ADR-0068's Alternatives ban. Run the judged pipeline and DELETE
  // this entry when that wave lands.
  [
    'backable-wizard',
    'judged E_QUALITY 2026-08-18 (VerdictsFile packages/agent-ui/a2ui/corpus/verdicts/2026-08-18--verdicts-2026-08-18.json, rubric a2ui-corpus 1.1, a2ui-review-agent (independent of the authoring session per ADR-0068)). Failing: D1. ' +
      'P7=3: the range Calendar has no Field/label and the RadioGroup no group name (admitted booking-reservation Field-wraps both); redundant Card>shell>scene one-child wrapper with no CardContent (P4=4); RadioGroup shipped unbound then re-sent bound (P5=4). Repair: Field-wrap the Calendar and name the RadioGroup, collapse the shell wrapper into CardContent, ship the RadioGroup bound from turn 1; re-judge. ' +
      'KEPT on the shelf pending that repair (a coverage-gate candidate until re-judged; drop the seed instead if the repair is abandoned).',
  ],
  //
  // GH #1201 (2026-08-17) — `frontier-greet-card`: the same pending-state shape (NO VERDICT SOUGHT YET,
  // not a refusal). Added alongside the `greeting-card` mini-skill + grammar.md's reserved greet-1
  // sentence (req-a2ui-patterns.md R3) as its worked greet-bookend exemplar — the authoring session
  // judging its own seed is the manufactured judgment ADR-0068's Alternatives ban. Run the judged
  // pipeline and DELETE this entry when that wave lands.
  //
  // GH #1205 (2026-08-17) — the four COMPOSITION PACK A seeds (`slideshow-gallery` ·
  // `confirmation-view` · `trend-list` · `card-layouts`): the same pending-state shape (NO VERDICT
  // SOUGHT YET, not a refusal). Added as the req-a2ui-library R4 now-tier pattern seeds — the authoring
  // session judging its own seeds is the manufactured judgment ADR-0068's Alternatives ban. Run the
  // judged pipeline (import-seeds.ts with a real VerdictsFile) and DELETE these entries when that wave
  // lands.
  //
  // GH #1206 (2026-08-17) — the four COMPOSITION PACK B seeds (`five-day-weather` · `restaurant-menu` ·
  // `travel-itinerary` · `wizard-step-progress`): the same pending-state shape (NO VERDICT SOUGHT YET,
  // not a refusal). Added as the req-a2ui-library R4 next-tier pattern seeds — the authoring session
  // judging its own seeds is the manufactured judgment ADR-0068's Alternatives ban. Run the judged
  // pipeline (import-seeds.ts with a real VerdictsFile) and DELETE these entries when that wave lands.
  [
    'wizard-step-progress',
    'judged E_QUALITY 2026-08-18 (VerdictsFile packages/agent-ui/a2ui/corpus/verdicts/2026-08-18--verdicts-2026-08-18.json, rubric a2ui-corpus 1.1, a2ui-review-agent (independent of the authoring session per ADR-0068)). Failing: D1. ' +
      'P7=3: the RadioGroup has no Field/label wrap (the catalog RadioGroup carries no own label; rental-filter-panel wraps it in Field), h4 adjacent but unassociated, no name; P6=4: the Progress label (Setup, step 2 of 3) is static while value/max are bound. Repair: wrap plans in Field label Plan (+name), template or de-number the Progress label; re-judge. ' +
      'KEPT on the shelf pending that repair (a coverage-gate candidate until re-judged; drop the seed instead if the repair is abandoned).',
  ],
  //
  // ADR-0205/GH #1207 (2026-08-18) — `frontier-latency-line-chart`: the same pending-state shape (NO
  // VERDICT SOUGHT YET, not a refusal). Added with the LineChart catalog row (the fleet's first
  // axis-bearing chart) to close the GH #729 type-coverage gate; its corpus admission is a pending judged
  // import wave — the authoring session judging its own seed is the manufactured judgment ADR-0068's
  // Alternatives ban. Run the judged pipeline and DELETE this entry when that wave lands.
  //
  // GH #1209 (2026-08-18) — `frontier-media-tour`: the same pending-state shape. Added with the
  // Video/AudioPlayer catalog rows (the native media players) to keep the GH #729 type-coverage gate
  // green; pending the same judged import wave. Delete this entry when it is judged.
])
