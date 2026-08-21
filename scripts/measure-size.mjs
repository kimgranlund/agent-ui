// measure-size — the consumer-budget + tree-shake gate (rubric D8 / plan §10 / decomp s17). Bundles each
// public barrel of `@agent-ui/components` with the project's own bundler (Rolldown, the engine under Vite 8),
// minified, and reports minified + gzipped byte counts against a per-barrel budget. Run via `npm run size`.
// Reproducible companion to G1's one-off (esbuild) figure; Rolldown is what the library actually ships
// through, so this is the representative measure.
//
// Two barrel-level targets:
//   • the `.` barrel (src/index.ts) — the FULL reactive+dom surface a foundation consumer pulls.
//   • the `components` barrel (controls/index.ts) — the self-defining ui-* family (ADR-0003 s17). This is the
//     BUNDLE leg of the tree-shake proof: importing the family drags only the controls + their real deps
//     (dom + reactive + traits), so the family barrel lands in the SAME ballpark as the foundation surface —
//     it does NOT pull "the whole package" twice. The deterministic import-graph SHAPE proof lives in
//     controls/tree-shake.test.ts; this script pins the realised BYTES.
//
// A third, per-control leg (T5, ADR-0080): the barrel legs above measure the WORST-CASE (foundation alone /
// every control at once), not what a real consumer distributes. The per-control leg bundles each public
// `./controls/{name}` entry (package.json's exports map — the T4 three-way drift gate keeps this set honest)
// through a LEAVE-ONE-OUT marginal: `marginal(c) = gz(bundle(ALL entries)) − gz(bundle(ALL ∖ {c}))`. This
// attributes shared infrastructure (bases, traits, the reactive kernel) to NO single control — exactly the
// "what does adding this control cost an app already using others" semantics the ≤2048 B cap means (ADR-0080
// clause 3, rejecting the pairwise-delta alternative). Each entry's SOLO absolute (foundation-inclusive, the
// ~5 KB figure) is also reported, informationally only (clause 3 — regressions in a control's own code would
// hide inside the dominant foundation figure if solo were gated). GH #354 added a CLUSTER row beside it, for
// the one place a leave-one-out is structurally blind — see the cluster leg's own banner below.
//
// A fourth leg — `@agent-ui/app` (LLD-C8, SPEC-R7 AC4): a package ABOVE components on the DAG, so its cost
// to a consumer is what the app-tier barrel adds ON TOP OF the components foundation a consumer already pays for
// (the first target above), not its solo absolute (which necessarily also carries that foundation). Same
// marginal semantics as T5, one level up: `marginal = gz(bundle(app .)) − gz(bundle(components .))`.

import { rolldown } from 'rolldown'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'

const KB = 1024
const targets = [
  // [label, entry (relative to this script), budget in gz bytes]
  // 7.5 KB re-based at the GH #170/ADR-0155 wave: the barrel gained a ratified public-API export
  // (`scrollFade`, the paneResize/ADR-0023 precedent — ui-super-shell's SPEC-R10 scrollbar seam needs the
  // fleet's ONE fade trait, never a deep import), which pulls the scroll-fade trait into the root surface
  // (+~182 B gz over the old 7 KB). ADR-0155 Consequences names this re-measure explicitly (ADR-0040/0049).
  ['@agent-ui/components . (reactive+dom barrel)', '../packages/agent-ui/components/src/index.ts', 7.5 * KB],
  // family-total = the WORST-CASE ceiling (every control defined at once), NOT the eventual distributed size:
  // a real consumer imports a subset and ships ~5–14 KB (single control ~5 KB incl. the shared dom+reactive+
  // traits+base foundation dragged in once; each extra control ~0.5–2 KB marginal — measured 2026-07-05).
  // 23 KB re-based at the container box-model + scroll-fade wave (ADR-0049 Amendment 1): the scroll-fade trait
  // pushed the all-controls bundle past 22 KB (~155 B of SHARED scroll infra). 25 KB re-based at the ADR-0095
  // wave (ui-segmented-control + ui-segment supersede ui-radio-group[variant=segmented]): two NEW tags (each
  // with its own descriptor/CSS text baked into the bundle) land alongside radio-group.css's segmented-block
  // removal — net +~950 B gz to the worst-case ceiling (measured 24499 B gz 2026-07-07). The per-control
  // marginal ≤~2 KB stays the REAL cap; the per-control leg below (T5, ADR-0080) measures it directly through
  // the public API (both new controls land at 0–62 B gz marginal — trivial, since almost all their shared cost
  // rides the radio/radio-group foundation every other Indicator/Pattern control already pays).
  // 26 KB re-based at the chart wave (ADR-0107 ## Amendment, the Consequences-anticipated re-base): TWO new
  // Display controls with hand-rolled mark code (ui-sparkline's SVG path-building + ui-bar-chart's diverging
  // bar math) — measured 25847 B gz 2026-07-08; per-control marginals stay trivial vs the ~2 KB cap
  // (bar-chart 447 B gz · sparkline 715 B gz through the T5 public-API leg).
  // 28 KB re-based at the report+content-family wave (ADR-0111/ADR-0113 Amendment, SPEC-N4, the same
  // Consequences-anticipated re-base precedent): FIVE new controls (ui-table/ui-stat/ui-badge/ui-code/
  // ui-disclosure) landed in one integration slice — measured 27533 B gz 2026-07-09; per-control marginals
  // stay trivial vs the ~2 KB cap (table 659 B gz · stat 484 B gz · badge 117 B gz · code 51 B gz ·
  // disclosure 384 B gz — the worst-case ceiling moves, the real per-control gate does not).
  // 30 KB re-based at the feed-family wave (ADR-0112 cl.8, the same Consequences-anticipated re-base
  // precedent — the ADR named this re-base as EXPECTED, never guessed): FIVE new tags
  // (ui-progress/ui-avatar/ui-attachment/ui-toast/ui-toast-region) landed in one integration slice —
  // measured 29463 B gz 2026-07-09; per-control marginals stay trivial vs the ~2 KB cap (progress 301 B gz ·
  // avatar 307 B gz · attachment 544 B gz · toast 0 B gz · toast-region 235 B gz — the worst-case ceiling
  // moves, the real per-control gate does not).
  // 32 KB re-based at the M4 Phase 1 wave (ADR-0120 cl.2, app-surfaces-m4.lld.md LLD-C9, the SAME
  // Consequences-anticipated re-base precedent — SPEC-R14 named this re-base EXPECTED, not guessed): the
  // split primitive (ui-split's drag/keyboard/ARIA machinery + ui-split-pane) — measured 32689 B gz
  // 2026-07-10; the per-control marginal stays the real gate (split 1966 B gz — within the ≤2048 B cap;
  // split-pane 0 B gz, trivial — the worst-case ceiling moves, the real per-control gate does not).
  // 34 KB re-based at the ui-toolbar wave (ADR-0121, Consequences amendment — the same Consequences-
  // anticipated re-base precedent): measured 33017 B gz post-toolbar (toolbar's own per-control marginal
  // 318 B gz, trivial vs the ≤2048 B cap — the worst-case ceiling moved, the real per-control gate did
  // not). The bump to 34816 B gz is sized ahead, not guessed at per-control: it covers the three QUEUED,
  // already-frozen control families (timeline / swiper / command-modal) so the ceiling is not re-based
  // again on the very next wave — recorded here, not silently absorbed.
  // 38 KB re-based at the ui-swiper wave (ADR-0124, Consequences amendment — the same Consequences-
  // anticipated re-base precedent): measured 37157 B gz post-timeline+post-swiper (swiper's own per-control
  // marginal carries its own MARGINAL_OVERRIDES entry above, 3072 B gz — a five-tag family behind one
  // entry, not guessed at). The bump to 38912 B gz (38 KB) is sized ahead for command-modal, the last
  // QUEUED, already-frozen control family — recorded here, not silently absorbed.
  // 44 KB re-based at the ui-color-picker wave (ADR-0123, the SAME Consequences-anticipated re-base
  // precedent — ADR-0123's own Consequences named this re-base as EXPECTED for "the largest single
  // control yet"): color-picker's OKLCH↔sRGB math + canvas paint + area-drag trait + three composed
  // ui-slider channels + the ui-text-field type=color leg (a NEW static ui-swatch pull for the immediate
  // preview) landed in one wave — measured 42587 B gz 2026-07-11; the per-control marginal stays the
  // real gate (color-picker itself measures NEGATIVE — its bytes are already counted via text-field's
  // own static swatch/codec pull, a leave-one-out gzip-dictionary artifact, the split/swiper precedent).
  // 44.1 KB re-based GH #52/ADR-0154 (LLD-C6): `traits/pane-resize.ts` widened onto the package's public
  // barrel (already bundled here via ui-split's own static import — no new module, only a re-export's own
  // few bytes of export/type metadata). Measured 45141 B gz 2026-07-20 (up from 45056).
  // 47.3 KB re-based at the genui-surface B1 wave (SPEC §3.2/§3.3, D9, the SAME Consequences-anticipated
  // re-base precedent): ui-sandbox-frame's real cost — the CSP builder, the bridge message-guard, the
  // host-owned bootstrap script TEXT (a plain-JS string, not a build-time asset), and the control's own
  // build/replace/teardown + live-theme logic. An EARLIER draft read the shared foundation stylesheets'
  // raw TEXT via a `?raw` import to recover `--md-sys-*` NAMES — that alone cost +23 KB gz (raw stylesheet
  // source, non-tree-shakeable, duplicated into every consumer); token-bridge.ts now walks the REAL CSSOM
  // at runtime instead (zero extra bytes) — see that file's own banner. Measured 48295 B gz 2026-07-24
  // (up from 45141); ~7% headroom reserved.
  // 47.5 KB re-based at the ui-form-popover wave (GH #294 F4, the SAME Consequences-anticipated re-base
  // precedent): one new control (a select-style trigger + [data-box] panel over the shared overlay
  // controller — no new mechanism, own marginal a modest 200 B gz) crossed the prior 47.3 KB cap purely
  // via the whole-barrel gzip-dictionary shift every new family member causes (the split/swiper/
  // status-stream leave-one-out precedent above). Measured 48501 B gz 2026-07-27 (up from 48295);
  // ~6% headroom reserved.
  //
  // KNOWN OVER by 55 B gz as of 2026-07-29 (GH #354): this row measures 48695 B gz against the 48640 B cap.
  // Attributed by CHECKING OUT each commit in range and re-measuring this same barrel in place. The ladder
  // below reconciles to the byte; the 48501 B figure above does NOT sit on it — it was recorded at the
  // ui-form-popover wave rather than at the parent of the first mover, and why it differs from a re-measure
  // of that same tree is unclear (likely a toolchain difference at recording time; two independent
  // re-measurements today, one in place and one over `git archive` trees, agree with each other rung for
  // rung). Treat the dated ladder, not the older single figure, as the baseline:
  //   12932a0 (= 59def42^)  48529 B gz   ← the true baseline; 111 B of headroom left under the 48640 cap
  //   59def42               48609 (+80)  `fix(dom): survive a nested disconnectedCallback mid-connected()`
  //                                      (GH #302) — a `src/dom/` lifecycle fix, so EVERY control here
  //                                      carries it.
  //   4fa3137 · a241c35     48609 (+0)   CSS-only (sticky-header canvas, calendar range band) — no JS byte.
  //   60af7f7               48609 (+0)   the dogfood asset pair itself (ADR-0162 LLD-C1): ZERO bytes in this
  //                                      default barrel, exactly as its own gate promises.
  //   d51fa06               48695 (+86)  `feat(components): ui-sandbox-frame gains the SPEC-R12 assets prop`
  //                                      (#338) — visible per-control too: sandbox-frame's own marginal moved
  //                                      2124 → 2215 B gz.
  //   (nothing since d51fa06 touches components/src)
  // 48529 + 80 + 86 = 48695. Both movers are real, wanted code landing against 111 B of headroom — NOT a
  // gzip-dictionary shift, and nothing to shave.
  // RULED 2026-07-31 (GH #354, Kim): re-based 47.5 KB → 47.625 KB (48768 B gz) — the measured 48695 plus
  // 73 B of headroom, accepting both movers as real weight. The deliberate red this block previously held
  // open is closed by that ruling.
  // RULED 2026-08-05 (GH #445, Kim — "re-base + shrink follow-up"): re-based 47.625 KB → 50 KB (51200 B
  // gz) — measured 51134 at MA-1's final commit; the movers are the ADR-0163 widening (selection + sort +
  // filter/search + pagination landing on ui-table in place) plus the new ui-pagination control, all real,
  // twice-reviewed weight. Per Kim's ruling this re-base is a CHECKPOINT, not a ratchet: GH #455 is the
  // standing shrink follow-up that hunts the marginal back down.
  // RULED 2026-08-07 (Kim, in-session — the ui-multi-select build): re-based 50 KB → 51 KB (52224 B gz) —
  // measured 51620 at the M-F merge tip; the movers are ui-multi-select (412 B, the ADR-0175/SPEC-accepted
  // primitive) plus the GH #535/#536 menu/tabs fixes (~37 B), all reviewed weight. Same law as above:
  // a CHECKPOINT, not a ratchet — GH #455 remains the standing shrink follow-up.
  // RULED 2026-08-08 (Kim, host round — the ui-otp-field S2-a build, GH #490): re-based 51 KB → 53 KB
  // (54272 B gz) — measured 54049 B gz with ui-otp-field's real, LLD-mandated weight (total reducer +
  // paste-split + echo channel, its own per-control override in MARGINAL_OVERRIDES below) landing in the
  // family barrel. Same law as above: a CHECKPOINT, not a ratchet — GH #455 remains the standing shrink
  // follow-up.
  // RULED 2026-08-08 (Kim, in-session — second of the day for this constant; durable record:
  // https://github.com/kimgranlund/agent-ui/issues/586#issuecomment-5223777160 — the tabs
  // overflow="menu" build, GH #586 Slice B): re-based 53 KB → 54 KB (55296 B gz) — measured 54889 B
  // gz; the otp-field re-base above plus Slice B's overflow-engine weight (the fit engine + the composed
  // ui-menu vehicle + the CSS grid rules), both twice-reviewed real machinery. Same law as above: a
  // CHECKPOINT, not a ratchet — GH #455 remains the standing shrink follow-up.
  // RULED 2026-08-12 (Kim, in-session — durable record: GH #751, filed on his own instruction):
  // re-based 54 KB → 55 KB (56320 B gz) — measured 55564 B gz on main; the movers are the merged
  // #735/#736 wave (status-stream scrollbar/header mirrors + follow-the-change, main at 55346 before
  // tonight's builds) plus #744's ADR-0184 reasoning-trace opt-ins (~218 B — note rows, setPlan, settle
  // summary), all reviewed weight flagged un-flipped on PRs #743/#744 until this ruling. Same law as
  // above: a CHECKPOINT, not a ratchet.
  // PROPOSED 2026-08-16 (ADR-0040 Amendment cl.A1, GH #1009 — Kim ratifies via `ratify ADR-0040 amendment`;
  // the first re-base of this row routed through the ADR log itself, not only this comment ladder):
  // re-based 55 KB → 58 KB (59392 B gz) — measured 58485 B gz (219733 B min) on main@0a6df860, 2165 B over
  // the 56320 line (312 B when the ruling was recorded; 398 B at f1c06fd1 when the first draft proposed
  // 56 KB; then #1018 + #1020 merged before it landed). Attributed rung by rung in the amendment
  // (55574 + 2911 = 58485): the movers that crossed the 55 KB and 56 KB lines are #973's overlay() CSS
  // anchor-positioning enhancement (+723 B) and #1018's ui-drill mint (+1435 B), with card-header
  // structured (#817), ui-drawer (ADR-0188 S1 + #919/#922), swiper candy (#983), the select fix (#1011)
  // and #1020's status-stream pendingComputed consumer (+332 B) as the rest — all reviewed weight, no
  // gzip artifact. 907 B (~1.5%) stated headroom. Same law as above: a CHECKPOINT, not a ratchet.
  // RE-BASED 2026-08-18 (Kim ruling, marshal's size round, GH #1189): 58 KB -> 58.5 KB (59904 B gz) --
  // measured 59772 B gz on the 1189-ui-image branch; the single mover is the ui-image mint itself
  // (+380 B over the old line: control + scrim/caption CSS + descriptor glue), dual-reviewed weight
  // (component-checker + a2ui-review), no gzip artifact. ~132 B stated headroom. Same law: a
  // CHECKPOINT, not a ratchet.
  // RE-BASED 2026-08-18 (GH #1208, the ui-stat donut/progress-ring variant — an UNATTENDED build
  // dispatch measured this, NOT a live Kim ruling; the "RULED"/"RE-BASED" wording elsewhere on this
  // ladder records an actual operator sign-off, and this entry does not carry one — flagged in the
  // dispatch's own report for confirmation): 58.5 KB -> 59 KB (60416 B gz) — measured 59911 B gz on
  // the 1208-stat-ring branch, 7 B over the 59904 line; the sole mover is the ring-variant addition
  // itself (the `variant`/`percent` props, the render effect's ring branch, `#ringNode`, and
  // stat-model.ts's `statPercentProp`/`ringPercent` — real reviewed logic, no gzip artifact; the
  // control's own CSS is NOT part of this JS-only barrel). ~505 B stated headroom. Same law as
  // above: a CHECKPOINT, not a ratchet.
  // RE-BASED 2026-08-18 (marshal's overnight goal round, GH #1209): 59 KB -> 59.5 KB (60928 B gz) --
  // measured 60533 B gz after the ui-video/ui-audio media mint (+117 B over the prior line; the movers
  // are the two native-player controls, thin by construction — no custom chrome). Rides the SAME
  // reviewed-weight re-base class Kim ruled twice this same night (ui-image +380 B, stat-ring +7 B);
  // flagged for morning sign-off, not silently absorbed. Same law: a CHECKPOINT, not a ratchet.
  // RE-BASED 2026-08-19 (ADR-0216/GH #1395, the CONTROL-MINT half of the rating build wave — an
  // UNATTENDED build dispatch measured this, NOT a live Kim ruling; flagged for confirmation, the
  // GH #1208 precedent's wording): 59.5 KB -> 61 KB (62464 B gz) -- measured 61794 B gz after the
  // ui-rating mint (a THIRD UIRangeElement leaf: the own-reimplemented normaliser/ARIA-value/geometry/
  // keyboard/focus-blur wiring `ownsValueModel()=false` requires, the two-row owned-SVG star mark
  // builder, and the readonly write-path gate — 696 B gz marginal over the shared foundation per the
  // per-control row below). ~670 B stated headroom. Same law: a CHECKPOINT, not a ratchet.
  // RE-BASED 2026-08-20 (Kim ruling, the nine-ADR campaign's find-open-questions round): 61 KB -> 65 KB
  // (66560 B gz) -- measured 65722 B gz on main after ALL SEVEN wave-1 control mints landed
  // (ui-file-drop, ui-suggestions, ui-source-list, ui-rating, ui-pie-chart, ui-choice-group, ui-choice-card
  // + the selection-commit trait seams; PRs #1412-#1424). The ui-rating re-base above was measured
  // mid-wave before its six siblings joined the bundle. ~840 B stated headroom. CHECKPOINT, not ratchet.
  // RE-BASED 2026-08-21 (GH #1565, svg-charts wave 1 — an UNATTENDED build dispatch measured this, NOT a
  // live Kim ruling; flagged for confirmation, the GH #1208/GH #1395 precedent's wording): 65 KB -> 69.5
  // KB (71168 B gz) -- the 65 KB line was ALREADY over budget pre-wave (measured 68743 B gz on a clean
  // origin/main checkout, 2183 B gz of unattributed drift accrued across mints since the 2026-08-20
  // checkpoint — a pre-existing red this wave did not cause and does not attribute; named here, not
  // silently absorbed into this wave's own delta). This wave's OWN mover is the `ui-column-chart` mint
  // (ADR-0228/ADR-0229): +1693 B gz (68743 -> 70436 measured on this branch) — the shared `_chart/`
  // axis-math module + the control's own stacking/scale math and three-layer DOM builder, consistent
  // with the control's own per-row marginal figure (column-chart 1831 B gz) below. ~732 B stated
  // headroom over the measured 70436 B gz. CHECKPOINT, not ratchet — the pre-existing 2183 B gz drift
  // is a separate, standing follow-up (unattributed movers since 2026-08-20), not this wave's to explain.
  // RE-BASED 2026-08-21 (GH #1566, svg-charts wave 2 — reviewed by the dispatching host, not an
  // unattended measurement): 69.5 KB -> 70 KB (71680 B gz) -- this wave's own mover is `ui-line-chart`'s
  // `axes` state (ADR-0229 cl.3): +302 B gz measured (71376 marginal delta on this branch's own leave-
  // one-out frame vs the 71168 checkpoint), consistent with sharing the `_chart/` subsystem's gridline/
  // chip math rather than duplicating it. ~300 B headroom over the measured 71378 B gz. CHECKPOINT, not
  // ratchet.
  ['@agent-ui/components/components (self-defining ui-* family)', '../packages/agent-ui/components/src/controls/index.ts', 70 * KB],
  // GH #377 finding 3 — the package's FIRST `./traits/*` subpath (`traits/overlay`, package.json:74) gets
  // its own budgeted row, so the opt-in surface every other pack carries one for (`code/highlight`,
  // `./markdown`, `./editor`) is not the one exception.
  //
  // Measured ABSOLUTELY, not marginal-over-foundation, and the reason is the whole point of the subpath:
  // `overlay.ts`'s ONLY import is `import type { UIElement } from '../dom/index.ts'` — type-only, fully
  // erased — so this entry drags NO kernel at all. Solo 1173 B gz against a 7442 B foundation makes the
  // marginal frame arithmetic nonsense (it computes -6269); the absolute figure IS the tree-shake proof
  // here, exactly the reasoning `@agent-ui/code`'s core/highlight rows are measured under (see their
  // banner below). The tree-shake half is asserted structurally in controls/tree-shake.test.ts.
  //
  // 2 KB pinned over a measured 1173 B gz 2026-07-30 (ADR-0080's measure-first-then-pin discipline). What
  // this row actually guards is the ~945 B gz the review measured on the FOUNDATION row when this trait was
  // re-exported from the root barrel instead (GH #368) — the bytes every consumer would have paid. A future
  // edit that reaches back into `dom`/`reactive` at RUNTIME would blow past this cap immediately, since the
  // kernel it would pull dwarfs the budget.
  // RE-BASED 2026-08-20 (Kim ruling, same round): 2 KB -> 2.5 KB (2560 B gz) -- measured 2455 B gz
  // on main after PR #1401 (the #1339 IACVT fix: post-open verify + reveal/scroll observers + JS-path
  // demotion, reconciled with #1359's detector) -- REAL reviewed weight, not drift; the row's actual
  // guard (no runtime reach back into dom/reactive) still holds — overlay.ts's import stays type-only.
  ['@agent-ui/components/traits/overlay (opt-in subpath)', '../packages/agent-ui/components/src/traits/overlay.ts', 2.5 * KB],
  // GH #952 review LOW — the package's SECOND `./traits/*` subpath (`traits/list-reorder`, package.json:80)
  // gets the same budgeted row as `traits/overlay`, under the same absolute-not-marginal reasoning:
  // `list-reorder.ts`'s ONLY import is `import type { UIElement } from '../dom/index.ts'` (type-only, fully
  // erased), so a runtime reach-back into `dom`/`reactive` would blow this cap immediately.
  //
  // 1.25 KB (1280 B gz) pinned over a MEASURED 960 B gz (2100 B min) 2026-08-16 (measure-first-then-pin,
  // ADR-0080) — the pointer-capture drag + keyboard fallback (moveBefore + re-focus, `keyboardTarget`) at the
  // review's M1/M2 shape; ~320 B headroom, deliberately tighter than overlay's since this trait's whole job
  // is DOM moves — a runtime kernel reach-back is the only way it grows fast.
  ['@agent-ui/components/traits/list-reorder (opt-in subpath)', '../packages/agent-ui/components/src/traits/list-reorder.ts', 1.25 * KB],
  // GH #964 — the THIRD `./traits/*` subpath (`traits/scroll-spy`, package.json), routed here rather than
  // the root barrel per ADR-0167's own measured route: landing it on the foundation row measured 7900 B gz
  // against a 7680 B gz budget (241 B gz over, with only 21 B gz of headroom to begin with) — the row does
  // NOT absorb it, so this trait ships as its own opt-in subpath instead, the overlay precedent immediately
  // above. Same tree-shake shape: `scroll-spy.ts`'s only import is `import type { UIElement } from
  // '../dom/index.ts'` — type-only, fully erased — so this entry drags no kernel either; the absolute figure
  // is the tree-shake proof (controls/tree-shake.test.ts's structural half covers the rest of the barrel).
  // Measured 421 B gz 2026-08-16 (GH #964); pinned at 1 KB (ADR-0080's measure-first-then-pin discipline).
  ['@agent-ui/components/traits/scroll-spy (opt-in subpath)', '../packages/agent-ui/components/src/traits/scroll-spy.ts', 1 * KB],
]

let over = false
const gzByLabel = new Map() // captured so the @agent-ui/app section below can compute its marginal against the foundation figure without re-bundling it
for (const [label, rel, budget] of targets) {
  const input = fileURLToPath(new URL(rel, import.meta.url))
  const bundle = await rolldown({ input })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  const min = Buffer.byteLength(code)
  const gz = gzipSync(code, { level: 9 }).length
  const status = gz <= budget ? 'within' : 'OVER'
  if (gz > budget) over = true
  gzByLabel.set(label, gz)
  console.log(`${label}: ${gz} B gz (${min} B min) — ${status} budget (${budget} B gz)`)
}

// ── T5 (ADR-0080 clauses 3–4) — per-control leave-one-out marginal + informational solo absolute ──

const PKG_DIR = fileURLToPath(new URL('../packages/agent-ui/components', import.meta.url))
const pkg = JSON.parse(readFileSync(`${PKG_DIR}/package.json`, 'utf8'))

// Every public per-control entry (name → absolute path of its target module), read straight off the exports
// map T4 wrote and keeps honest via the three-way drift gate (barrels.test.ts) — no separate control list to
// drift out of sync here.
const CONTROL_ENTRIES = Object.entries(pkg.exports)
  .filter(([key]) => key.startsWith('./controls/'))
  .map(([key, rel]) => [key.slice('./controls/'.length), `${PKG_DIR}/${rel.slice(2)}`])

/** Bundle a synthetic virtual entry `import`ing each of `paths` (via a resolveId/load plugin — no temp file
 * on disk), minified; return the gz byte size. Rolldown supports one `input`, so a multi-entry measurement
 * (the leave-one-out set, the ALL set) goes through this one synthetic module rather than N real entries. */
const gzOfEntries = async (paths) => {
  const VIRTUAL_ID = '\0virtual:measure-size-entry'
  const src = paths.map((p) => `import ${JSON.stringify(p)}`).join('\n') + '\n'
  const plugin = {
    name: 'measure-size-virtual-entry',
    resolveId(id) {
      if (id === 'virtual:measure-size-entry') return VIRTUAL_ID
    },
    load(id) {
      if (id === VIRTUAL_ID) return src
    },
  }
  const bundle = await rolldown({ input: 'virtual:measure-size-entry', plugins: [plugin] })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  return gzipSync(code, { level: 9 }).length
}

// Default per-control marginal budget (ADR-0080 clause 4). Override rows carry a cited reason and are
// measured FIRST, then pinned — not guessed ahead of the measurement.
//
// GH #354 — `text-field`'s own override (4352 B gz, "the 12-type value-codec family (ADR-0044/0047), which
// absorbs the calendar picker bytes") and `calendar`'s "needs no override, its bytes land inside
// text-field's marginal" note BOTH retired here: neither row measures its control any more (both read ~0),
// so neither could carry a budget honestly. Their bytes are gated by the CLUSTER row below instead — see
// its banner for the full derivation.
//
// GH #352 (ed3c093) recorded this SAME structural finding one commit earlier and, having no instrument to
// replace the rows with, closed by telling a future reader to "bundle them in isolation rather than trust a
// leave-one-out row". That note is deleted here rather than kept: the cluster row IS that isolated
// measurement, run on every `npm run size`, so leaving both instructions in one file would leave a reader
// choosing between them. #352's measured figures (calendar 3 B gz, text-field 0 B gz, 2026-07-29) are the
// same ones the cluster banner cites.
const MARGINAL_BUDGET_DEFAULT = 2048 // B gz
const MARGINAL_OVERRIDES = {
  // name: [budget in B gz, reason]
  'split': [2176, 'gzip measurement-frame drift as the family bundle crossed 33 KB (leave-one-out deltas shift with the shared dictionary; toolbar added similar roving/flex/enum code) — split source byte-identical that wave; measured 2082 B gz 2026-07-10'],
  'swiper': [3072, 'a five-tag family behind one entry (the per-control 2048 cap is sized for one component; measured 2913 B gz 2026-07-10 pre-split, 2406 B gz post-split — host + item + three chrome tags, each carrying its own barrel line + package.json subpath per family-coherence.test.ts C1; the four leaf lines each measure ~0 B gz since swiper.ts already imports them transitively)'],
  'sandbox-frame': [2336, 'genui-surface.spec.md SPEC §3.2/§3.3 (D9, B1): the CSP builder, the closed bridge message-guard, the host-owned bootstrap script TEXT, and the build/replace/teardown + live-theme control logic — measured 2124 B gz 2026-07-24, ~8% headroom; re-bumped 2304 → 2336 for the gzip measurement-frame drift class (the split/status-stream precedent): sandbox-frame source untouched while the 2026-08-19 campaign grew the family bundle by seven controls — measured 2321 B gz 2026-08-20, Kim ruling'],
  'status-stream': [2740, 'gzip measurement-frame drift from the SAME genui-surface B1 wave adding a new family member (the split-wave precedent above — leave-one-out deltas shift with the shared dictionary once the family bundle grows); status-stream source is byte-identical that wave — measured 2107 B gz 2026-07-24 (was within budget pre-wave); re-bumped 2176 → 2192 for the SAME drift class when MA-1 grew the family bundle (measured 2182 B gz 2026-08-05, source untouched by that diff — GH #445, Kim ruling); re-bumped 2192 → 2384 for REAL reviewed weight, not drift: the GH #737/ADR-0184 reasoning-trace opt-ins (note entries + setPlan + settle summary — measured 2376 B gz 2026-08-12; the ADR ships proposed with the build, its ratification covers this bump — the otp-field per-control precedent); re-bumped 2384 → 2386 for the SAME drift class a third time (measured 2386 B gz 2026-08-13, source untouched — Kim ruling, close-session confirm round 2026-08-13); re-bumped 2386 → 2710 for REAL reviewed weight, not drift: ADR-0191/GH #999\'s booked repair — status-stream is the ADR\'s own first `pendingComputed` consumer (setPendingSource() + the :state(pending) wiring + its CSS dim rule) — measured 2707 B gz 2026-08-16 (the ADR ships accepted before this build; ratification covers this bump, the SAME GH #737/ADR-0184 precedent immediately above); re-bumped 2710 → 2736 for the SAME drift class a fourth time (GH #1031, ruling: re-base to measured — #1020\'s own override was set from a pre-merge 2707; the 2026-08-16 board-clear then grew the family bundle (#1018 ui-drill → #1020 → #1023 → #1027) and the leave-one-out frame shifted +26 B with status-stream source untouched — measured 2736 B gz 2026-08-16, npm ci fresh)'],
  'table': [2624, 'RULED 2026-08-05 (GH #445, Kim — "re-base + shrink follow-up"): ADR-0163 widens the ratified display-only contract IN PLACE (Kim\'s 2026-07-28 direction, deliberately against a separate interactive tier), so one control carries selection + sort + filter/search + pagination composition + their a11y and delegation machinery — measured 2558 B gz 2026-08-05 after three review rounds already trimmed it; the cap is a checkpoint, not a ratchet. GH #455\'s shrink pass (same day): consolidated the three `<th scope="col">` builders into one shared helper, folded the `cleanColumns`/`cleanRows`/`cleanFilter` array-hardening loop into one `hardenArray`, merged the `#thead`/`#tbody` `change` listeners into one delegated on `#table` (a stable node wrapping both — behaviorally identical, listener count 3→2), and shared the two selection-toggle commits\' `selected` write + `select` emit — measured 2517 B gz 2026-08-05, zero behavior change (table-interactive.browser.test.ts + the byte-identity probe both green). Cap stays 2624 (the checkpoint), not re-based down — the next honest shrink continues from here'],
  'otp-field': [2400, 'Kim ruling 2026-08-08 (host round): LLD-mandated machinery (total reducer + paste-split + echo channel), reviewer confirmed no remaining fat — measured 2150 B gz 2026-08-08 (code-entry-control.lld.md, GH #490 S2-a); re-bumped 2304 → 2400 for the SAME gzip measurement-frame drift class (the split/status-stream precedent): otp-field source untouched while GH #1566 (svg-charts wave 2) grew the family bundle with ui-line-chart\'s axes state — measured 2399 B gz 2026-08-21, npm ci fresh.'],
}

// ── The CLUSTER leg (GH #354, Kim's 2026-07-29 ruling) — the one shape a leave-one-out cannot measure ────
//
// `marginal(c) = gz(ALL) − gz(ALL ∖ {c})` only attributes bytes to `c` if removing `c`'s ENTRY actually
// removes `c`'s module. Whenever a sibling entry's graph still reaches it — statically, or DYNAMICALLY,
// since this script joins every chunk of the output — the row reads ~0. That is usually the RIGHT answer and
// stays a pass: `ui-button` costs an app that already ships `ui-toast` nothing, which is exactly what the
// ≤2048 B cap is asking (ADR-0080 clause 3).
//
// It stops being an answer at a CYCLE. ADR-0123 made `color-picker.ts` statically import
// `../text-field/text-field.ts` (the type=color leg) while `text-field.ts` dynamically imports
// `color-picker.ts` — mutually reachable, so NO per-entry leave-one-out can remove either one. Measured
// 2026-07-29: `text-field` 0 B gz, `calendar` 3 B gz. A 4352 B override budget written to gate "the 12-type
// value-codec family" had therefore been passing at any size since ADR-0123 landed, and calendar's "its
// bytes land inside text-field's marginal" note had been false just as long (GH #354's own finding).
//
// The honest instrument for a cycle is ONE row over the smallest independently-removable unit: the cycle
// plus every entry the cycle EXCLUSIVELY reaches. `gz(ALL) − gz(ALL ∖ cluster)` rises if ANY member grows,
// so the codecs, the calendar picker, the OKLCH/canvas math, the composed slider channels and the swatch
// preview are all gated again — by one real figure instead of five fictional zeros. The cluster's own
// members are then reported WITHOUT a budget: a row that cannot measure its control must not print a pass.
//
// Membership is DERIVED from the real import graph on every run (below) and cross-checked against the
// pinned set. If a future edge changes the cluster — ADR-0123's import removed, or a new cycle formed — this
// script FAILS and says so, rather than silently re-opening the hole it was written to close.
//
// SCOPE, so nobody mis-reads a green row: like every other row in this file, it measures REACHABLE bytes
// after minification. Adding an unreferenced `export const` to a member moves it by ~0 because Rolldown
// tree-shakes it — correct (an unreachable byte costs a consumer nothing) but not what a casual reader
// assumes "the cluster grew" means. To exercise this row deliberately, grow something the members actually
// reference (an independent review's first probe learned this the hard way; its second, a referenced 12 KB
// addition, reded the row while the member's OWN marginal still read 0 — the masking this row exists for).

/** Every `from '<spec>'` / bare `import '<spec>'` / `import('<spec>')` RELATIVE specifier in `src`, with
 *  type-only statements stripped first (an `import type` moves no bytes, so it must not create a masking
 *  edge). Mirrors barrels.test.ts's own crawl — a plain regex over source text, no bundler needed. */
const relativeSpecifiers = (src) => {
  const code = src.replace(/^\s*(?:import|export)\s+type\s[^\n]*$/gm, '')
  const specs = []
  const re = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(code)) !== null) specs.push(m[1])
  return specs
}

/** Transitively crawl the relative-import graph from `startAbs`, returning every reached absolute path.
 *  A specifier resolving outside the package (a bare `@agent-ui/*`) is not followed — this leg only asks
 *  which of the package's OWN modules an entry reaches. */
const crawlFrom = (startAbs) => {
  const reached = new Set()
  const queue = [startAbs]
  while (queue.length > 0) {
    const cur = queue.pop()
    if (reached.has(cur)) continue
    reached.add(cur)
    let src
    try {
      src = readFileSync(cur, 'utf8')
    } catch {
      continue // a stylesheet/asset or a missing extension — nothing to crawl
    }
    for (const spec of relativeSpecifiers(src)) {
      const target = resolvePath(dirname(cur), spec)
      if (!reached.has(target)) queue.push(target)
    }
  }
  return reached
}

const reachOf = new Map(CONTROL_ENTRIES.map(([name, path]) => [name, crawlFrom(path)]))
const pathOf = new Map(CONTROL_ENTRIES.map(([name, path]) => [name, path]))
/** The OTHER entries whose graph reaches `name` — i.e. the entries that make its own leave-one-out read ~0. */
const maskersOf = (name) =>
  CONTROL_ENTRIES.map(([other]) => other).filter((other) => other !== name && reachOf.get(other).has(pathOf.get(name)))

// Mutually-reachable entries (a cycle), then everything ONLY those reach — the closure that must move as one.
const cluster = new Set(
  CONTROL_ENTRIES.map(([name]) => name).filter((name) =>
    maskersOf(name).some((other) => reachOf.get(name).has(pathOf.get(other))),
  ),
)
for (let grew = true; grew; ) {
  grew = false
  for (const [name] of CONTROL_ENTRIES) {
    if (cluster.has(name)) continue
    const maskers = maskersOf(name)
    if (maskers.length > 0 && maskers.every((m) => cluster.has(m))) {
      cluster.add(name)
      grew = true
    }
  }
}
// Pinned membership + the measured budget (the file's own "measure first, then pin" convention).
// Measured 10931 B gz 2026-07-29 for exactly this five-entry closure; 11.5 KB pinned, ~7% headroom — the
// same margin the sandbox-frame/status-stream overrides above reserve.
const CLUSTER_EXPECTED = ['calendar', 'color-picker', 'slider', 'swatch', 'text-field']
const CLUSTER_BUDGET = 11.5 * KB
const CLUSTER_WHY =
  'ADR-0123 text-field ⇄ color-picker is a CYCLE (color-picker statically imports text-field; text-field dynamically imports color-picker), plus the three entries only they reach (calendar, slider, swatch) — no per-entry leave-one-out can remove any of them, so the group is gated as one'
const clusterDerived = [...cluster].sort()
let clusterMembershipDrift = false
if (clusterDerived.join(',') !== CLUSTER_EXPECTED.join(',')) {
  clusterMembershipDrift = true
  console.error(
    `size: the derived import-cycle cluster [${clusterDerived.join(', ')}] no longer matches the pinned set [${CLUSTER_EXPECTED.join(', ')}] — re-derive the cluster row's membership and budget (GH #354), never paper over it`,
  )
}

console.log('\nper-control marginal (leave-one-out through the public `./controls/{name}` entries, ADR-0080):')
const allPaths = CONTROL_ENTRIES.map(([, p]) => p)
const gzAll = await gzOfEntries(allPaths)
let marginalOver = false
for (const [name, path] of CONTROL_ENTRIES) {
  const gzWithout = await gzOfEntries(allPaths.filter((p) => p !== path))
  const marginal = gzAll - gzWithout
  const solo = await gzOfEntries([path])
  if (cluster.has(name)) {
    // No budget, no pass/fail: this row cannot measure its own control (see the cluster banner).
    console.log(
      `  ${name.padEnd(14)} marginal ${String(marginal).padStart(5)} B gz — NOT GATED (import-cycle cluster member; gated by the cluster row below)   solo ${solo} B gz (informational)`,
    )
    continue
  }
  const [budget, reason] = MARGINAL_OVERRIDES[name] ?? [MARGINAL_BUDGET_DEFAULT, undefined]
  const status = marginal <= budget ? 'within' : 'OVER'
  if (marginal > budget) marginalOver = true
  const reasonNote = reason ? ` (override: ${reason})` : ''
  console.log(
    `  ${name.padEnd(14)} marginal ${String(marginal).padStart(5)} B gz — ${status.padEnd(6)} budget ${budget} B${reasonNote}   solo ${solo} B gz (informational)`,
  )
}

// The cluster's own gated row: what an app already shipping every OTHER control pays to add this group.
const clusterPaths = new Set(CLUSTER_EXPECTED.map((name) => pathOf.get(name)).filter((p) => p !== undefined))
const gzWithoutCluster = await gzOfEntries(allPaths.filter((p) => !clusterPaths.has(p)))
const clusterMarginal = gzAll - gzWithoutCluster
const clusterOverBudget = clusterMarginal > CLUSTER_BUDGET
console.log(
  `  cluster [${CLUSTER_EXPECTED.join(' + ')}]: marginal ${clusterMarginal} B gz — ${clusterOverBudget ? 'OVER' : 'within'} budget ${CLUSTER_BUDGET} B (${CLUSTER_WHY})`,
)

// ── @agent-ui/app (LLD-C8, SPEC-R7 AC4) — the whole app-tier barrel (ui-super-shell + ui-master-detail,
// LLD-C9/C16 · ADR-0151), one package UP the DAG from components.
//
// The stub plugin below exists for Vite query-suffixed specifiers (`?url`/`?raw`): a bare `rolldown()` call
// can't load them (Vite's own asset pipeline resolves them; raw Rolldown has no such plugin), so `?raw`
// inlines the real file's text (a real byte cost) and `?url` returns a short placeholder path (the real Vite
// build emits a hashed asset URL of similar length — this approximates the byte contribution, not the runtime
// value, which the script has no need of). Its original consumer was the removed `app-shell.ts`'s
// isolation-mode fleet-CSS injection (ADR-0156) — unexercised from then until GH #1215/ADR-0202, whose
// `lib/pdf-worker.ts` (the pdf.js confinement module) is the first LIVE consumer since: a bare third-party
// specifier (`pdfjs-dist/build/pdf.worker.min.mjs?url`), not a relative or `@agent-ui/*` one — the else
// branch below (added for this) resolves it via Node's own `import.meta.resolve`, the real node_modules
// algorithm, rather than assuming a flat top-level layout.
const APP_QUERY_RE = /^(.*)\?(url|raw)$/
const appCssQuerySuffixPlugin = {
  name: 'app-css-query-suffix-stub',
  resolveId(source, importer) {
    const m = source.match(APP_QUERY_RE)
    if (!m) return null
    const [, bare, kind] = m
    let target
    if (bare.startsWith('.')) {
      target = resolvePath(dirname(importer), bare)
    } else if (bare.startsWith('@agent-ui/')) {
      const [, pkgName, ...rest] = bare.split('/')
      const pkgDir = fileURLToPath(new URL(`../packages/agent-ui/${pkgName}`, import.meta.url))
      const pkgExports = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8')).exports
      const subpath = `./${rest.join('/')}`
      const mapped = pkgExports[subpath]
      if (!mapped) throw new Error(`app-css-query-suffix-stub: no "${subpath}" export in @agent-ui/${pkgName}`)
      target = `${pkgDir}/${mapped.slice(2)}`
    } else {
      // Any other bare specifier — a third-party package deep import (e.g. `pdfjs-dist/build/pdf.worker.min.mjs`)
      // — resolved through Node's own module algorithm (handles workspace hoisting correctly; a hand-rolled
      // `node_modules/${bare}` join would not, on a nested-install layout).
      target = fileURLToPath(import.meta.resolve(bare))
    }
    return { id: `${target}?${kind}`, moduleSideEffects: false }
  },
  load(id) {
    const m = id.match(APP_QUERY_RE)
    if (!m) return null
    const [, filePath, kind] = m
    if (kind === 'raw') return `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))}`
    return `export default ${JSON.stringify(`/${filePath.split('/').pop()}`)}`
  },
}

// 26 KB re-based at the M4 Phase 3 wave (app-surfaces-m4.lld.md LLD-C9/C16, SPEC-R14 — the SAME
// Consequences-anticipated re-base precedent as the components family ceiling above and the Phase 2
// re-base this comment replaces). `ui-settings` (schema.ts's registry + generate.ts) statically
// self-registers SIX components the app barrel never dragged before — `ui-text-field`, `ui-switch`,
// `ui-select`, `ui-slider`, `ui-field`, `ui-form-provider` — all of which sit OUTSIDE the `.` foundation
// baseline this marginal is measured against, and this script joins EVERY reachable chunk (incl.
// text-field's own dynamically-imported calendar/color-picker, per its established "absorbs the picker
// bytes" worst-case convention above) — so the jump is real, not a regression to chase down. Measured
// 24494 B gz post-ui-settings 2026-07-11 (up from the Phase 2 ui-app-shell+ui-master-detail-only 4576 B
// gz); ~9% headroom reserved. A future control riding this barrel re-bases again, measured, not guessed.
//
// 68 KB re-based at the M2 wave (app-surfaces-m2.lld.md LLD-C9, SPEC-R11 AC3 — the SAME
// Consequences-anticipated re-base precedent). ADR-0129's Consequences called this exactly: M2 is where
// `@agent-ui/a2ui` moves from a DECLARED-but-unexercised app dependency to a genuinely IMPORTED one. The
// barrel now exports `UISurfaceHostElement`/`UIConversationElement`, each of which statically
// `import { createRenderer } from '@agent-ui/a2ui'` — so a consumer of the whole app barrel `.` now drags
// the ENTIRE A2UI renderer + default catalog (every catalog adapter) on top of everything above. This is
// the dominant cost by far; the ui-nav-rail family (ADR-0130) also newly rides this barrel but is trivial
// beside it. Measured 63083 B gz post-M2 2026-07-12 (up from 24494); ~8% headroom reserved (68 KB). The
// worst-case whole-barrel ceiling moves; per-subpath tree-shaking is unaffected — `@agent-ui/app/surface-host`
// alone drags only itself + a2ui's real deps, never `ui-conversation`/`ui-settings`/`ui-nav-rail` (SPEC-R11
// AC3). A future control riding this barrel re-bases again, measured, not guessed.
// Issue #19: measured in the SAME two parts as ./editor below (entry vs lazy, `c.isEntry`) — `ui-agent-admin`
// statically imports `@agent-ui/code/editor`, whose own CM-free entry chunk rides the app barrel eagerly,
// but that import's dynamic `import('./cm-editor.ts')` split still lands as a REACHABLE, non-entry chunk in
// this bundle's own output graph. Joining every chunk regardless of isEntry (the pre-fix behavior) folded
// that ~171 KB gz lazy CodeMirror chunk into the app's marginal figure, even though it is NEVER in a main
// bundle (ADR-0139 cl.8c/8d) — this app entry is exactly such a case. Only entry-chunk code counts toward
// the gated marginal; the lazy total is reported informationally, matching ./editor's own convention.
//
// GH #52/ADR-0154 re-base — `ui-agent-admin` now composes `ui-chat-shell`(→`ui-super-shell`), which ride
// this SAME barrel: real, new capability (SPEC-R6 resizable pane + SPEC-R7 segments/narrow-tabs), not
// duplication — the TKT-0085 ResizeObserver + hand-rolled ui-split/ui-tabs docking this replaced was
// net-negative on its OWN two files (agent-admin.ts/.css), but the grammar extension itself is real net-new
// weight on the shared barrel. Measured 69921 B gz 2026-07-20 (up from 69632); ~2.5% headroom reserved.
// 72 KB re-based at the genui-surface B1 wave (SPEC §3.2/§3.3, D9): this barrel's marginal is measured
// OVER the components foundation figure above, so ui-sandbox-frame's own ~3.2 KB gz addition to that
// foundation (the same real cost the family-barrel re-base above cites) flows straight through here too —
// no new app-tier code, the SAME underlying wave. Measured 73712 B gz 2026-07-24 (up from 69921); ~2.5%
// headroom reserved (matching the prior wave's own margin).
//
// 74 KB re-based at the GH #257 wave (ui-conversation-composer's providers/provider + modes/mode picker
// pair, forwarded through ui-conversation identically to the existing models/model + efforts/effort pair):
// real, new capability on the SAME shared barrel, not duplication — 2 new prop pairs + 2 new #sync*Picker
// bodies + the reset-on-provider-change logic, doubled across the composer and its ui-conversation
// forwarder. The prior 72 KB budget (73728 B gz) had only 16 B gz of headroom left over its OWN 73712 B gz
// baseline (the SAME genui-surface B1 measurement just above) — this wave's true cost is ~399 B gz, so any
// re-base smaller than a full KB step would leave near-zero room for the next change (the GH #170/ADR-0155
// re-base precedent: cite the exact before/after, following the same convention). Measured 74111 B gz
// 2026-07-24 (up from 73712); ~2.25% headroom reserved.
//
// GH #354 (2026-07-29) — between the M-C wave landing and this fix, this row measured 153969 B gz, 2.08× the
// budget: `agent-admin.ts` STATICALLY imported `@agent-ui/components/dogfood-frame`, a 450 675 B generated
// fixture, so 449 007 of the entry chunk's 747 986 B min rode the PUBLIC barrel — ~78 KB gz paid by every
// consumer whether or not it ever opened agent-admin. That import is now dynamic (Kim's ruling; ADR-0139's
// lazy precedent), which moves the pair into the informational lazy line below: entry 79063 B gz, marginal
// 71621 B gz measured 2026-07-29. The budget deliberately STAYED at 74 KB then — this file's convention
// re-bases on real growth, measured.
// RULED 2026-08-05 (GH #454, Kim — "argued re-base + diet follow-up", the MA-1 table precedent): re-based
// 74 KB → 79 KB (80896 B gz) — measured 80337 B gz on main at 55ca0f7, a breach that predates MA-1 and
// grew across real merged feature waves (the ADR-0168 tool-enablement build, the ADR-0164 entry-list
// extraction, the ADR-0151 shell family), every mover reviewed weight, none of it accidental. Per the
// ruling this is a CHECKPOINT, not a ratchet: GH #468 is the standing app-diet follow-up that hunts the
// marginal back down (lazy-split candidates named there).
// RULED 2026-08-06 (GH #480, Kim — the same "checkpoint, not a ratchet" convention): re-based
// 79 KB → 80 KB (81920 B gz) — measured 81222 at M-D's final commit; the +326 B over the day-old
// checkpoint is the persona-catalog-composition SPEC's own required wiring (compose.ts + the
// fixture persona package riding surface-host's existing static a2ui-barrel pull), twice-reviewed,
// structural rather than elective. GH #468 remains the standing app-diet follow-up unchanged.
//
// GH #468's first shrink pass (2026-08-06, same day as the M-D/#488 merges this measured against):
// `agent-admin.ts`'s static `import '@agent-ui/code/markdown'` moved LAZY (the dogfood-lazy/ADR-0139
// precedent — a memoized, preloaded-ahead-of-need dynamic import, degrading to the modality's existing
// plain-text fallback whenever the chunk hasn't resolved yet; markdown-lazy*.test.ts pins the runtime
// shape, markdown-lazy.bundle.test.ts pins the bundle shape). Measured 82866 → 77472 B gz (−5394 B gz,
// the whole-bundle gzip-dictionary shift included — the module itself is ~2 KB gz standalone, per
// `@agent-ui/code/markdown`'s own row below; a leave-one-out across a barrel this size is never purely
// additive, the split/status-stream precedents above say the same). The budget stays 80 KB (the
// checkpoint) — this is headroom regained, not a re-base; GH #468 stays open for the NEXT marginal
// (entry-list/settings shared-chunk audit, shell preset dedup — named, not yet measured).
// RULED 2026-08-08 (Kim — the same "checkpoint, not a ratchet" convention as #454/#480; durable
// record: https://github.com/kimgranlund/agent-ui/issues/586#issuecomment-5223777160):
// re-based 80 KB → 83 KB (84992 B gz) — measured 82565 B gz on the tabs overflow="menu" build
// (GH #586 Slice B, commit 4710b89): Slice B's composed-ui-menu vehicle + fit engine, LLD-accepted
// tradeoff landing at the app tier; next diet pass keeps its tripwire. GH #468 remains the standing
// app-diet follow-up unchanged.
//
// Re-based 83 KB → 88 KB (90112 B gz) at the ADR-0180 declarative-composition wave (GH #688, S1-S4):
// two NEW app-tier custom elements — `ui-conversation-dialog` (the scroll/live-region mechanical role +
// the isNearBottom()/followTail() public methods, promoted off ui-conversation's own private methods,
// zero net new BEHAVIOUR bytes but a full new self-defining custom-element shell) and `ui-conversation-
// header` (a thin, fully author-composed band) — both riding this SAME shared barrel via ui-conversation's
// own connected() (adopt-or-create), per the LLD's own kickoff discipline ("two new elements will not fit
// current headroom", conversation-declarative-composition.lld.md §7 test 7). Measured 86679 B gz
// pre-re-base (up from the 82565 B gz checkpoint — a real ~4114 B gz cost, two new registered elements +
// their own CSS reachable through the barrel, not a regression to chase); ~3.8% headroom reserved (90112 −
// 86679 = 3433 B gz) for the next change, the SAME margin discipline every prior re-base in this file
// leaves. GH #468 remains the standing app-diet follow-up, unchanged by this wave.
//
// Re-based 88 KB -> 100 KB (102400 B gz) 2026-08-14 (GH #898, Kim ruling: "bump the budget to whatever
// it needs to be"): the agent-admin surface grew legitimately across one week's shipped waves — the
// availability axis + row markers (GH #850 S1), renamable entries (GH #848), admin-wide help tooltips
// (GH #866), the capabilities trigger + chip icons + bubble reference tags (GH #891 S4-S6), the picker
// management items + Edit Agents drawer wiring (GH #845), the debug-export seam (GH #889), disable-on-
// answer + the ask-arm round routing (GH #805/#802). Measured 98638 B gz at the bump (pre-existing OVER
// since mid-wave; the S4-S6 delta alone was ~0.9 KB). ~3.7% headroom reserved (102400 - 98638 = 3762 B
// gz) — the SAME margin discipline as every prior re-base. GH #468 stays the standing diet follow-up.
//
// Re-based 100 KB -> 102 KB (104448 B gz) 2026-08-16 (GH #1031, ruling: re-base to measured — Kim's
// standing precedent on the family-growth drift class, ADR-0040's 2026-08-16 amendment left this row
// deliberately out of its own scope): the app composes the family, so the same 2026-08-16 board-clear
// movers land here — 102459 at f1c06fd1 → 103617 after #1018 (ui-drill) → 103919 after #1020 →
// 103915 after #1023 → 104175 after #1027. Measured 104175 B gz 2026-08-16 (npm ci fresh); rounded up to
// the next whole KB per this file's convention — 273 B headroom only, so the next app change re-bases
// again or GH #468's diet finally lands. Not a ratchet: a checkpoint.
// Re-based 102 KB -> 103 KB (105472 B gz) 2026-08-17 (GH #1080's decision record, the #1031 precedent —
// re-base to measured, mint the diet): the ADR-0196 answered-state/settle wave (#1090) + the docs-wave
// movers crossed the 102 KB checkpoint — measured 104714 B gz on main@2b65338b (fresh npm ci, exit-code
// verified). Rounded up to the next whole KB per this file's convention — 758 B headroom. This is the
// LAST re-base of the class by its own ruling: GH #1092 (diet round 2 — lazy-split the agent-admin arm,
// est. 20-25 KB gz) must land the marginal back UNDER 102 KB; its acceptance forbids raising this again.
//
// Restored 103 KB -> 102 KB (104448 B gz) 2026-08-17 (ADR-0197 cl.5, GH #1092 S2): the promised diet
// landed — the `.` barrel dropped its static agent-admin arm behind `loadAgentAdmin()` (S1), and the
// eager marginal measured 89921 B gz (fresh npm ci, exit-code verified; was 104714 B gz on
// main@2b65338b — a 14791 B gz cut, 14527 B headroom under this checkpoint). Measured through the
// eager-closure accounting the same change introduced (entry + transitive static `imports` — the split's
// own code-splitting made bare `isEntry` under-count). Per GH #1080's ruling and ADR-0197 cl.5, upward
// re-bases of this row are CLOSED as a class: future growth pays with a diet or a ruled feature-weight
// ADR, never a drift bump. Downward re-bases remain ordinary.
// Re-based 104448 -> 104982 B gz 2026-08-21 (ADR-0197 cl.5's named exception, "a ruled feature-weight
// ADR" — not a drift bump): ADR-0229 (svg-charts wave 1, GH #1565/#1561) ships `ui-column-chart`, the
// fleet's fifth first-class chart type, self-registering in `component-styles.css` alongside
// sparkline/bar-chart/line-chart/pie-chart per the existing foundation-CSS shape every prior chart
// type paid into this same row — real reviewed weight from a Kim-ratified control, not accretion.
// Kim ruling 2026-08-21 (in-session): rule the exception now rather than diet the shared foundation
// CSS apart. Measured 104982 B gz (fresh npm ci, exit-code verified) — zero headroom by design; the
// next chart wave (line-chart axes/gradient, GH #1566) pays for its own weight the same way.
// Re-based 104982 -> 105943 B gz 2026-08-21 (ADR-0197 cl.5's named exception, invoked a SECOND
// consecutive time — Kim ruling, explicit check-in, not a silent repeat): ADR-0229 cl.3 (svg-charts
// wave 2, GH #1566/#1561) ships `ui-line-chart`'s `axes` state — gridlines/chip-axis chrome + the
// gradient area fill + the shared now-marker/provisional-span mechanism reused from wave 1. Real
// reviewed weight from the same ratified system, not accretion; the whole svg-chart intake was
// scoped size:big precisely because it spans several waves. Measured 105943 B gz (fresh npm ci,
// exit-code verified) — zero headroom by design; wave 3 (ui-gauge, GH #1567) pays for its own weight
// the same way, or diets if the pattern strains further.
const APP_MARGINAL_BUDGET = 105943
const appInput = fileURLToPath(new URL('../packages/agent-ui/app/src/index.ts', import.meta.url))
const appBundle = await rolldown({ input: appInput, plugins: [appCssQuerySuffixPlugin] })
const { output: appOutput } = await appBundle.generate({ format: 'esm', minify: true })
await appBundle.close()
const appChunks = appOutput.filter((c) => c.type === 'chunk')
// ADR-0197 (GH #1092, 2026-08-17): the barrel's `loadAgentAdmin()` dynamic import makes Rolldown
// code-split the graph — the shells land in a SHARED chunk the entry imports STATICALLY (isEntry: false,
// but still eager: it loads with the barrel, before any dynamic import fires). Counting only `isEntry`
// chunks here would under-count the eager cost (measured: 304 B gz "entry" the day the split landed) and
// lump the eagerly-loaded shells into the lazy figure. The honest eager set is the STATIC-import closure
// from the entry chunks (`chunk.imports`, never `dynamicImports`); lazy = everything else.
const appByFile = new Map(appChunks.map((c) => [c.fileName, c]))
const appEager = new Set(appChunks.filter((c) => c.isEntry).map((c) => c.fileName))
for (const name of appEager) {
  for (const dep of appByFile.get(name)?.imports ?? []) if (appByFile.has(dep)) appEager.add(dep)
}
const appEntryCode = appChunks.filter((c) => appEager.has(c.fileName)).map((c) => c.code).join('')
const appLazyCode = appChunks.filter((c) => !appEager.has(c.fileName)).map((c) => c.code).join('')
const appMin = Buffer.byteLength(appEntryCode)
const appGz = gzipSync(appEntryCode, { level: 9 }).length
const appLazyGz = appLazyCode ? gzipSync(appLazyCode, { level: 9 }).length : 0
const foundationGz = gzByLabel.get('@agent-ui/components . (reactive+dom barrel)')
const appMarginal = appGz - foundationGz
const appStatus = appMarginal <= APP_MARGINAL_BUDGET ? 'within' : 'OVER'
const appOver = appMarginal > APP_MARGINAL_BUDGET
console.log(
  `\n@agent-ui/app . (super-shell + master-detail + settings + surface-host + conversation + nav-rail): marginal ${appMarginal} B gz — ${appStatus} budget (${APP_MARGINAL_BUDGET} B gz)   solo ${appGz} B gz (${appMin} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)
if (appLazyGz > 0) {
  console.log(
    `@agent-ui/app — lazy chunk(s) reachable via a dynamic import (the whole agent-admin arm per ADR-0197's loadAgentAdmin(), its CodeMirror editor per ADR-0139 cl.8c/8d, its dogfood asset pair per GH #354, and its pdf.js extractor per ADR-0202 cl.4c/4d), never in the eager bundle: ${appLazyGz} B gz (informational, non-gating)`,
  )
}

// lib/pdf-extractor (GH #1215, ADR-0202 cl.4c) — the pdf.js-carrying module inside @agent-ui/app, measured
// in TWO parts, the SAME two-part shape as ./editor's own CM split above, EXCEPT this wrapper module
// carries ZERO @agent-ui/components import (it's a plain registrar over `document-extraction.ts`'s
// registry, not a FACE control) — so, exactly like `@agent-ui/code`'s core/highlight rows just below, its
// entry chunk is measured ABSOLUTE, not marginal-over-foundation (there is no foundation cost to net out).
// (1) pdf-extractor.ts's own ENTRY chunk (pdfjs-dist-FREE by the confinement gate — it reaches the library
// only via `import('./pdf-worker.ts')`), an absolute figure, GATED; (2) the lazy pdf.js + worker-asset
// chunk(s) that dynamic import splits off, reported INFORMATIONALLY, never gated (pdfjs-dist version bumps
// are an ordinary dependency PR, ADR-0202 cl.4d — the same treatment ADR-0139 cl.8d gave CodeMirror).
const PDF_EXTRACTOR_BUDGET = 1 * KB // measured 561 B gz at the ADR-0202 build wave (ADR-0080 discipline) — pinned with headroom; a thin registrar + a timeout-raced dynamic import, well under a single control's worth of code. The lazy pdf.js chunk (~125 KB gz, worker asset included) is informational, NEVER gated.
const pdfExtractorEntry = fileURLToPath(new URL('../packages/agent-ui/app/src/lib/pdf-extractor.ts', import.meta.url))
const pdfExtractorBundle = await rolldown({ input: pdfExtractorEntry, plugins: [appCssQuerySuffixPlugin] })
const { output: pdfExtractorOutput } = await pdfExtractorBundle.generate({ format: 'esm', minify: true })
await pdfExtractorBundle.close()
const pdfExtractorChunks = pdfExtractorOutput.filter((c) => c.type === 'chunk')
const pdfExtractorEntryCode = pdfExtractorChunks.filter((c) => c.isEntry).map((c) => c.code).join('')
const pdfExtractorLazyCode = pdfExtractorChunks.filter((c) => !c.isEntry).map((c) => c.code).join('')
const pdfExtractorEntryGz = gzipSync(pdfExtractorEntryCode, { level: 9 }).length
const pdfExtractorLazyGz = pdfExtractorLazyCode ? gzipSync(pdfExtractorLazyCode, { level: 9 }).length : 0
const pdfExtractorOver = pdfExtractorEntryGz > PDF_EXTRACTOR_BUDGET
console.log(
  `\n@agent-ui/app/lib/pdf-extractor (pdf DocumentExtractor registrar — the pdfjs-dist-FREE entry chunk): ${pdfExtractorEntryGz} B gz — ${pdfExtractorOver ? 'OVER' : 'within'} budget (${PDF_EXTRACTOR_BUDGET} B gz); zero @agent-ui/components import exists — this figure IS the tree-shake proof, not a marginal`,
)
console.log(
  `@agent-ui/app/lib/pdf-extractor — the lazy pdf.js chunk(s) (dynamic import('./pdf-worker.ts'), the pdfjs-dist library + its worker asset, never in any main bundle): ${pdfExtractorLazyGz} B gz (informational, non-gating — ADR-0202 cl.4c/4d)`,
)

// ── @agent-ui/router (LLD-C9, SPEC-R7 AC4) — the SPA router family, ANOTHER package above components on
// the DAG (`shared ← components ← {a2ui, router} ← app`). Same marginal semantics as the @agent-ui/app
// section above, one row: what does a consumer who ALREADY has the components foundation pay to add the
// WHOLE router surface — the headless core barrel (`.`) PLUS both elements (`./router-outlet`,
// `./router-link`), the realistic "a consumer using the family" shape, not the core-alone figure (which
// would understate what most consumers actually ship, since the elements are the reason to reach for
// this package). A synthetic virtual entry (the same no-temp-file plugin pattern as the T5 per-control
// section) imports all three public subpaths; router-link.css is a stylesheet asset, not JS, so it is
// intentionally excluded (no bundler-measurable byte cost through this JS pipeline).
const ROUTER_MARGINAL_BUDGET = 4 * KB // provisional, recorded at LLD-C9 kickoff (SPEC-R7 AC4) — first measurement, no re-base expected
const routerPkgDir = fileURLToPath(new URL('../packages/agent-ui/router', import.meta.url))
const routerVirtualSrc = [
  `import ${JSON.stringify(`${routerPkgDir}/src/index.ts`)}`,
  `import ${JSON.stringify(`${routerPkgDir}/src/controls/router-outlet/router-outlet.ts`)}`,
  `import ${JSON.stringify(`${routerPkgDir}/src/controls/router-link/router-link.ts`)}`,
].join('\n') + '\n'
const routerVirtualId = '\0virtual:measure-size-router-entry'
const routerBundle = await rolldown({
  input: 'virtual:measure-size-router-entry',
  plugins: [
    {
      name: 'measure-size-router-virtual-entry',
      resolveId(id) {
        if (id === 'virtual:measure-size-router-entry') return routerVirtualId
      },
      load(id) {
        if (id === routerVirtualId) return routerVirtualSrc
      },
    },
  ],
})
const { output: routerOutput } = await routerBundle.generate({ format: 'esm', minify: true })
await routerBundle.close()
const routerCode = routerOutput
  .filter((c) => c.type === 'chunk')
  .map((c) => c.code)
  .join('')
const routerMin = Buffer.byteLength(routerCode)
const routerGz = gzipSync(routerCode, { level: 9 }).length
const routerMarginal = routerGz - foundationGz
const routerStatus = routerMarginal <= ROUTER_MARGINAL_BUDGET ? 'within' : 'OVER'
const routerOver = routerMarginal > ROUTER_MARGINAL_BUDGET
console.log(
  `\n@agent-ui/router (core + ui-router-outlet + ui-router-link): marginal ${routerMarginal} B gz — ${routerStatus} budget (${ROUTER_MARGINAL_BUDGET} B gz)   solo ${routerGz} B gz (${routerMin} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)

// ── @agent-ui/code (LLD-C10, SPEC-C9 AC2) — the code+prose family: a THIRD sibling branch off components
// (`shared ← components ← {a2ui, router, code} ← app`). Three per-pack line-items, not one combined figure
// (SPEC-C9's per-pack budget discipline):
//   • the core `.` barrel and `./highlight` neither import @agent-ui/components at ALL (the no-kernel gate,
//     core/no-kernel.test.ts) — their ABSOLUTE bundled size carries zero foundation cost, so it IS the
//     tree-shake byte proof directly (SPEC-C1 AC3/SPEC-C9: "the core row proves no pack mass" — an absolute
//     near-zero figure demonstrates this more directly than a marginal-over-foundation frame would).
//   • `./markdown` DOES pull real fleet controls (ui-text/ui-code/ui-table via
//     @agent-ui/components/controls/*), so it is measured the SAME marginal-over-foundation way as
//     @agent-ui/app/@agent-ui/router above: what a consumer who already pays for the components foundation
//     pays ON TOP to add ui-markdown.
const codePkgDir = fileURLToPath(new URL('../packages/agent-ui/code', import.meta.url))

/** Bundle a single real entry file (no synthetic virtual wrapper needed — one target each) and return its
 *  gz byte size. Mirrors the T5/router/app sections' minify+gzip pipeline. */
const gzOfEntry = async (entryPath) => {
  const bundle = await rolldown({ input: entryPath })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const code = output
    .filter((c) => c.type === 'chunk')
    .map((c) => c.code)
    .join('')
  return { gz: gzipSync(code, { level: 9 }).length, min: Buffer.byteLength(code) }
}

// core `.` — the ABSOLUTE tree-shake proof (no components import exists to make "marginal" meaningful).
const CODE_CORE_BUDGET = 1.5 * KB // measured 534 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeCore = await gzOfEntry(`${codePkgDir}/src/index.ts`)
const codeCoreOver = codeCore.gz > CODE_CORE_BUDGET
console.log(
  `\n@agent-ui/code . (core — token types + registry + projection seam): ${codeCore.gz} B gz (${codeCore.min} B min) — ${codeCoreOver ? 'OVER' : 'within'} budget (${CODE_CORE_BUDGET} B gz); zero @agent-ui/components import exists (the no-kernel gate) — this figure IS the tree-shake proof, not a marginal`,
)

// ./highlight — ABSOLUTE (same no-components-import reasoning; seven hand-rolled tokenizers + the shared
// scan.ts lexer core, self-registering on import).
const CODE_HIGHLIGHT_BUDGET = 6 * KB // measured 2454 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeHighlight = await gzOfEntry(`${codePkgDir}/src/highlight/index.ts`)
const codeHighlightOver = codeHighlight.gz > CODE_HIGHLIGHT_BUDGET
console.log(
  `@agent-ui/code/highlight (seven tokenizers, self-registering): ${codeHighlight.gz} B gz (${codeHighlight.min} B min) — ${codeHighlightOver ? 'OVER' : 'within'} budget (${CODE_HIGHLIGHT_BUDGET} B gz)`,
)

// ./markdown — MARGINAL over the components foundation (it pulls real ui-text/ui-code/ui-table).
const CODE_MARKDOWN_BUDGET = 5 * KB // measured marginal 1033 B gz at M1 kickoff (LLD-C10, ADR-0080 discipline) — pinned with headroom
const codeMarkdown = await gzOfEntry(`${codePkgDir}/src/markdown/index.ts`)
const codeMarkdownMarginal = codeMarkdown.gz - foundationGz
const codeMarkdownOver = codeMarkdownMarginal > CODE_MARKDOWN_BUDGET
console.log(
  `@agent-ui/code/markdown (ui-markdown; pulls ui-text/ui-code/ui-table): marginal ${codeMarkdownMarginal} B gz — ${codeMarkdownOver ? 'OVER' : 'within'} budget (${CODE_MARKDOWN_BUDGET} B gz)   solo ${codeMarkdown.gz} B gz (${codeMarkdown.min} B min, informational — includes the ${foundationGz} B gz components foundation)`,
)

// ./editor (ADR-0139 cl.8c) — the CM-carrying subpath, measured in TWO parts so CodeMirror bytes NEVER enter
// a gated figure: (1) the `ui-code-editor` wrapper's own ENTRY chunk (CM-free by the confinement gate — it
// statically pulls only @agent-ui/components), measured MARGINAL over the components foundation and GATED, the
// same frame as ./markdown/@agent-ui/app/@agent-ui/router; (2) the lazy CM chunk(s) the dynamic
// `import('./cm-editor.ts')` splits off, reported INFORMATIONALLY, never gated (CM version bumps move it — an
// ordinary dependency PR, ADR-0139 cl.8d). Baselined against gen-ui-kit's own measured CM footprint.
const CODE_EDITOR_BUDGET = 2 * KB // measured 247 B gz marginal at the ADR-0139 build wave, 517 B gz after the ADR-0147 richtext-mode wave (ADR-0080 discipline) — pinned with headroom; the CM-free wrapper is a single control's worth of code on top of the foundation. The lazy CM chunk (~172 KB gz post-ADR-0147 — cm-richtext.ts's decoration engine joined it, below) is informational, NEVER gated.
const editorBundle = await rolldown({ input: `${codePkgDir}/src/editor/index.ts` })
const { output: editorOutput } = await editorBundle.generate({ format: 'esm', minify: true })
await editorBundle.close()
const editorChunks = editorOutput.filter((c) => c.type === 'chunk')
const editorEntryCode = editorChunks.filter((c) => c.isEntry).map((c) => c.code).join('')
const editorLazyCode = editorChunks.filter((c) => !c.isEntry).map((c) => c.code).join('')
const editorEntryGz = gzipSync(editorEntryCode, { level: 9 }).length
const editorLazyGz = editorLazyCode ? gzipSync(editorLazyCode, { level: 9 }).length : 0
const editorMarginal = editorEntryGz - foundationGz
const codeEditorOver = editorMarginal > CODE_EDITOR_BUDGET
console.log(
  `\n@agent-ui/code/editor (ui-code-editor wrapper — the CM-FREE entry chunk): marginal ${editorMarginal} B gz — ${codeEditorOver ? 'OVER' : 'within'} budget (${CODE_EDITOR_BUDGET} B gz)   solo ${editorEntryGz} B gz (informational — includes the ${foundationGz} B gz components foundation)`,
)
console.log(
  `@agent-ui/code/editor — the lazy CodeMirror chunk(s) (dynamic import('./cm-editor.ts'), never in any main bundle): ${editorLazyGz} B gz (informational, non-gating — ADR-0139 cl.8c/8d)`,
)

// ── @agent-ui/data (ADR-0192, saas-data-utilities.spec.md SPEC-R14 c + SPEC-R1 AC3) — the headless SaaS
// data layer, the FOURTH sibling branch off components (`shared ← components ← {a2ui, router, code, data}`).
// Three per-surface line-items (SPEC-R14 c names all three): the `.` barrel (seam + store + resource/
// mutation/paginated + DataError), `./gateway` (client onion + token + retry), `./stream` (bridge + adapters).
// Measured ABSOLUTE, not marginal-over-foundation: `.` imports ONLY the reactive kernel from
// @agent-ui/components (`signal`/`computed`), which Rolldown tree-shakes down to the kernel — the bundle
// carries no `HTMLElement`/`customElements` (asserted below), so there is no "components foundation" inside
// it to subtract; `./gateway` and `./stream` import no @agent-ui/components code at all. Budgets are the
// SPEC's (PRD-D6 recommendation, sized against the router's core line-item), stated in min+BROTLI — brotli
// is therefore the GATED unit here (gz printed alongside for comparability with the sibling rows above).
// SPEC-R14 AC2: a breach is recorded in ADR-0192's Consequences with the measured number — never silently
// raised here.
//   Measured 2026-08-16 (build wave, post code-checker repairs): `.` 2822 B br (3106 B gz, 8091 B min) ·
//   `./gateway` 1729 B br (1928 B gz, 4198 B min) · `./stream` 2042 B br (2281 B gz, 5541 B min).
// The tree-shake probe (SPEC-R1 AC3): bundling `.` alone reaches NO module under data/src/gateway or
// data/src/stream (module-graph shape, from Rolldown's own chunk.modules map) and the minified text carries
// none of the four named symbols (`createGateway`/`withRetry`/`fromFetchStream`/`fromWebSocket`).
const dataPkgDir = fileURLToPath(new URL('../packages/agent-ui/data', import.meta.url))
const DATA_BUDGETS = {
  '.': 6 * KB,
  './gateway': 3 * KB,
  './stream': 4 * KB,
}
/** Bundle one real entry; return min/gz/br byte sizes + the included module ids (the tree-shake shape). */
const measureDataEntry = async (entryPath) => {
  const bundle = await rolldown({ input: entryPath })
  const { output } = await bundle.generate({ format: 'esm', minify: true })
  await bundle.close()
  const chunks = output.filter((c) => c.type === 'chunk')
  const code = chunks.map((c) => c.code).join('')
  const moduleIds = chunks.flatMap((c) => Object.keys(c.modules ?? {}))
  return {
    code,
    moduleIds,
    min: Buffer.byteLength(code),
    gz: gzipSync(code, { level: 9 }).length,
    br: brotliCompressSync(code).length,
  }
}
const dataCore = await measureDataEntry(`${dataPkgDir}/src/index.ts`)
const dataGateway = await measureDataEntry(`${dataPkgDir}/src/gateway/index.ts`)
const dataStream = await measureDataEntry(`${dataPkgDir}/src/stream/index.ts`)
const dataCoreOver = dataCore.br > DATA_BUDGETS['.']
const dataGatewayOver = dataGateway.br > DATA_BUDGETS['./gateway']
const dataStreamOver = dataStream.br > DATA_BUDGETS['./stream']
console.log(
  `\n@agent-ui/data . (DataSource seam + store + resource/mutation/paginated + DataError; reactive kernel only): ${dataCore.br} B br (${dataCore.gz} B gz, ${dataCore.min} B min) — ${dataCoreOver ? 'OVER' : 'within'} budget (${DATA_BUDGETS['.']} B br, SPEC-R14 c)`,
)
console.log(
  `@agent-ui/data/gateway (createGateway onion + withToken + withRetry; zero components import): ${dataGateway.br} B br (${dataGateway.gz} B gz, ${dataGateway.min} B min) — ${dataGatewayOver ? 'OVER' : 'within'} budget (${DATA_BUDGETS['./gateway']} B br)`,
)
console.log(
  `@agent-ui/data/stream (pushToPull bridge + fromFetchStream/fromEventSource/fromWebSocket + readNdjsonLines): ${dataStream.br} B br (${dataStream.gz} B gz, ${dataStream.min} B min) — ${dataStreamOver ? 'OVER' : 'within'} budget (${DATA_BUDGETS['./stream']} B br)`,
)
// The tree-shake probe (SPEC-R1 AC3) — shape AND text.
const DATA_SUBPATH_SYMBOLS = ['createGateway', 'withRetry', 'fromFetchStream', 'fromWebSocket']
const dataLeakedModules = dataCore.moduleIds.filter((id) => /[\\/]data[\\/]src[\\/](gateway|stream)[\\/]/.test(id))
const dataLeakedSymbols = DATA_SUBPATH_SYMBOLS.filter((s) => dataCore.code.includes(s))
const dataDomLeak = /\b(HTMLElement|customElements)\b/.test(dataCore.code)
const dataTreeShakeFailed = dataLeakedModules.length > 0 || dataLeakedSymbols.length > 0 || dataDomLeak
console.log(
  `@agent-ui/data . tree-shake probe (SPEC-R1 AC3): ${dataTreeShakeFailed ? 'FAILED' : 'clean'} — ${dataCore.moduleIds.length} modules bundled, ${dataLeakedModules.length} from ./gateway|./stream, leaked symbols [${dataLeakedSymbols.join(', ')}], DOM foundation bytes ${dataDomLeak ? 'PRESENT' : 'absent'} (headless — kernel only)`,
)

if (
  over ||
  marginalOver ||
  clusterOverBudget ||
  clusterMembershipDrift ||
  appOver ||
  pdfExtractorOver ||
  routerOver ||
  codeCoreOver ||
  codeHighlightOver ||
  codeMarkdownOver ||
  codeEditorOver ||
  dataCoreOver ||
  dataGatewayOver ||
  dataStreamOver ||
  dataTreeShakeFailed
) {
  if (over) console.error('size: a barrel exceeds its budget')
  if (marginalOver) console.error('size: a control exceeds its per-control marginal budget')
  if (clusterOverBudget) console.error('size: the import-cycle control cluster exceeds its marginal budget')
  if (clusterMembershipDrift) console.error('size: the import-cycle cluster membership drifted from its pinned set')
  if (appOver) console.error('size: @agent-ui/app exceeds its marginal budget')
  if (pdfExtractorOver) console.error('size: @agent-ui/app/lib/pdf-extractor exceeds its budget')
  if (routerOver) console.error('size: @agent-ui/router exceeds its marginal budget')
  if (codeCoreOver) console.error('size: @agent-ui/code . (core) exceeds its budget')
  if (codeHighlightOver) console.error('size: @agent-ui/code/highlight exceeds its budget')
  if (codeMarkdownOver) console.error('size: @agent-ui/code/markdown exceeds its marginal budget')
  if (codeEditorOver) console.error('size: @agent-ui/code/editor (wrapper) exceeds its marginal budget')
  if (dataCoreOver) console.error('size: @agent-ui/data . exceeds its brotli budget (SPEC-R14 c — record the number in ADR-0192 Consequences, never raise silently)')
  if (dataGatewayOver) console.error('size: @agent-ui/data/gateway exceeds its brotli budget (SPEC-R14 c)')
  if (dataStreamOver) console.error('size: @agent-ui/data/stream exceeds its brotli budget (SPEC-R14 c)')
  if (dataTreeShakeFailed) console.error('size: @agent-ui/data . tree-shake probe failed — a ./gateway or ./stream module/symbol (or DOM foundation bytes) reached the core barrel (SPEC-R1 AC3)')
  process.exit(1)
}
