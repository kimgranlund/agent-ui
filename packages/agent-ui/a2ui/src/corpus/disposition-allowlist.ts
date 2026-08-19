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
//   2. a refusal whose verdicts file PREDATES the archive — no member today (`stats-grid-dashboard`
//      held this slot until the 2026-08-18 judged waves gave it real archived VerdictsFiles, and Kim's
//      2026-08-18 drop ruling then removed the seed from the shelf entirely). ADR-0165 clause 8 still
//      rules out retro-archiving such a case: the M-B wave's verdicts files were never committed, and
//      fabricating one would be the manufactured judgment ADR-0068's Alternatives ban.
// A NEW refusal needs no entry — because the refused SEED LEAVES THE SHELF. ADR-0165's REV 2026-07-30
// (GH #361, reading (b) — the `retreat-reschedule` precedent) rules that dropping the seed from
// `src/examples/` entirely is a refusal's expected disposition, so its name is no longer in `allSeeds` and
// `seedsMissingAdmission` can never see it. The gate did NOT stop requiring an entry for a candidate: a
// refusal KEPT on the shelf is still un-admitted and un-allowlisted, so it still reds until an entry lands
// here. Beyond that, an entry is optional prose, worth it only to carry what a verdict cannot — a coverage
// argument, a repair path.
//
// **The map held zero LIVE entries through 2026-08-18** — every seed on the shelf as of that date was
// admitted to the store (the 2026-08-18 judged waves admitted the pending backlog and backable-wizard
// post-repair), and the two standing refusals that were KEPT pending repair — `stats-grid-dashboard` ·
// `wizard-step-progress` — were DROPPED from the shelf per Kim's 2026-08-18 ruling (the REV's drop path;
// their drained entries survive as the dated comments below). GH #1377 (2026-08-19) put two live entries
// back — `product-options-quantity` · `listing-photo-grid`, category 1's NO-VERDICT-SOUGHT-YET shape —
// the healthy steady state still holds: refusals leave the shelf, admissions delete their entries, and
// only a smoke seed that seeks no verdict or a kept-pending-repair refusal ever puts (or keeps) an entry.
// The map stays wired into both consumers regardless — the next entry needs a home, not a revival PR.
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
  //
  // `stats-grid-dashboard` — DROPPED from the shelf 2026-08-18 per ADR-0165's REV 2026-07-30 (GH #361
  // reading (b): dropping the seed from `src/examples/` entirely is a refusal's expected disposition) —
  // Kim's ruling, 2026-08-18. Judged E_QUALITY 2026-08-18 (rubric 1.1, failing D5 — the tile template was
  // pattern-dashboard-tiles verbatim minus the delta line, Grid-template-of-Cards already admitted via
  // comparison-pricing-table/media-file-grid) and re-judged under 1.2 the same day, unchanged; not
  // repairable by editing, so the ruled repair path ("drop the seed instead if the repair is abandoned")
  // was taken. The archived VerdictsFiles (2026-08-18--verdicts-2026-08-18.json,
  // 2026-08-18t15-00-00z--gh1262-p9-rejudge.json) remain the machine record. Entry drained per the drop
  // path — the seed is no longer in `allSeeds`, so `seedsMissingAdmission` can never see it.
  //
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
  // Run the judged pipeline and DELETE this entry when that wave lands. — Admitted 2026-08-18 (PR #1261,
  // rubric 1.1), then RE-ADMITTED the same day via `import-seeds --replace` under rubric 1.2 (GH #1262:
  // the View-listing Button moved from CardContent into a CardFooter for P9; VerdictsFile
  // `corpus/verdicts/2026-08-18t15-00-00z--gh1262-p9-rejudge.json`, qualityScore 4/PASS).
  //
  // GH #1199 (2026-08-17) — `frontier-card-anatomy-ask`: the same pending-state shape (NO VERDICT SOUGHT
  // YET, not a refusal). Added alongside the grammar.md card-anatomy clause (req-a2ui-patterns.md R1) as
  // its worked corpus exemplar — the authoring session judging its own seed is the manufactured judgment
  // ADR-0068's Alternatives ban. Judged E_QUALITY 2026-08-18 (rubric 1.1: the D2 agent-voiced promptText;
  // re-judged under 1.2: D1 + D2 — the bare RadioGroup P7 anchor), then REPAIRED the same day (GH #1262
  // Kim take-up, escalation 1: the Field wrap wiring the group name through the ADR-0051 labelling seam +
  // the user-voiced promptText) and ADMITTED 2026-08-18 by the FRESH independent re-judge wave
  // (VerdictsFile `corpus/verdicts/2026-08-18t21-00-00z--gh1262-backscore-replace.json`, qualityScore
  // 4/PASS). Entry removed per this map's own instruction above.
  //
  // GH #1192 (2026-08-18) — `backable-wizard`: refused twice (P7/P9 under 1.1, then SUSTAINED on new
  // ground under 1.2 — P7 alone after PR #1324's CardFooter repair), then REPAIRED (PR #1337: Field wraps
  // 'Check-in — check-out' + 'Room type' at all four scene occurrences, the ADR-0051 seam per the
  // booking-reservation/frontier-card-anatomy-ask precedents) and ADMITTED 2026-08-18 by a fresh
  // independent judge (VerdictsFile `corpus/verdicts/2026-08-18t22-00-00z--bw-admission-verdicts.json`,
  // qualityScore 4/PASS — D1 floored by P7=4, D2–D5 all 5). Entry removed per this map's own instruction.
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
  // judging its own seeds is the manufactured judgment ADR-0068's Alternatives ban. — The 2026-08-18
  // judged wave RESOLVED all four: `five-day-weather` · `restaurant-menu` · `travel-itinerary` were
  // ADMITTED (entries removed per this map's own instruction above), and `wizard-step-progress` was
  // refused, then DROPPED (below).
  //
  // `wizard-step-progress` — DROPPED from the shelf 2026-08-18 per ADR-0165's REV 2026-07-30 (GH #361
  // reading (b): dropping the seed from `src/examples/` entirely is a refusal's expected disposition) —
  // Kim's ruling, 2026-08-18. Judged E_QUALITY 2026-08-18 (rubric 1.1, failing D1 — the unlabeled
  // RadioGroup, the static-numbered Progress label) and re-judged under 1.2 the same day, unchanged; the
  // wizard technique's exemplar coverage is the backable-wizard seed (catalog-frontier.ts, GH #1192), so
  // the ruled repair path ("drop the seed instead if the repair is abandoned") was taken. The archived
  // VerdictsFiles (2026-08-18--verdicts-2026-08-18.json, 2026-08-18t15-00-00z--gh1262-p9-rejudge.json)
  // remain the machine record. Entry drained per the drop path — the seed is no longer in `allSeeds`, so
  // `seedsMissingAdmission` can never see it.
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
  //
  // GH #1377 (2026-08-19) — the commerce+hospitality genui-pack: `product-options-quantity` (variant-
  // picker SegmentedControl + quantity number-TextField, Field-wrapped, FormProvider-gated) and
  // `listing-photo-grid` (media-grid — a Grid of bare Image tiles, distinct from media-file-grid's
  // Attachment-tile idiom). The same pending-state shape (NO VERDICT SOUGHT YET, not a refusal) —
  // the ticket's own scope names ONE judged corpus seed this wave (the flagship
  // `commerce-product-card`, admitted separately, no allowlist entry). Run the judged pipeline and
  // DELETE these two entries when that wave lands.
  ['product-options-quantity', 'GH #1377 — variant-picker + quantity composition; admission pending the judged wave'],
  ['listing-photo-grid', 'GH #1377 — media-grid composition; admission pending the judged wave'],
])
