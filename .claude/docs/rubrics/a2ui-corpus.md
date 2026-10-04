# Rubric — A2UI Corpus Quality (the tier-2 admission judge standard)

version: 1.3

> Layer: rubric (a **runtime-consumed** judge standard, not a graded-once document) · 2026-07-03
> **Version history (the ADR-0068 marker pattern — bump whenever a dimension or anchor moves):**
> 1.0 = the original five-dimension standard (2026-07-03) · 1.1 = D1's fold widened P1–P7 → P1–P8 when
> `a2ui-payload.md` 1.1 added P8 (2026-08-06, GH #474/#747) · **1.2 = D1's fold widened P1–P8 → P1–P9
> when `a2ui-payload.md` 1.2 added P9, card anatomy (2026-08-18, GH #1262 — Kim ruling on the PR #1261
> judges' escalation; the P9 row itself is GH #1199) — D2–D5 text unchanged; the calibration record below
> is re-read against P9 and now shows its example FAILING D1 (see the record).** Every VerdictsFile authored
> from 2026-08-18 until the 1.3 bump cites `1.2`. **1.3 = the facet-scoped bump (2026-10-04, ADR-0231 cl.5,
> GH #1739): the corpus gained the model-visible `multi-turn` and `repair` facets, so the dimensions table
> gains an `Applies to` column, D1 names the stream its floor runs on per facet, and two facet-scoped gated
> dimensions land: D6 turn coherence (multi-turn only) and D7 repair fidelity (repair only). D1 to D5 read
> the same for an exemplar record, so no exemplar verdict is re-authored (runtime role 2).** Every
> VerdictsFile authored from the 1.3 bump on cites `1.3`; the archived 1.0, 1.1 and 1.2 files stay valid
> history under the version they were judged against.
> Grades one `CorpusRecord` for tier-2 admission (corpus SPEC-R8). It is read at runtime by
> `admit()`'s injected judge seam (ADR-0060) through the verdict adapter (ADR-0068): the
> `a2ui-review-agent` critic scores each record against **these exact dimensions** and authors a
> VerdictsFile; `createVerdictJudge` plumbs those verdicts into the pipeline; `import-seeds --verdicts`
> and `rescore` consume them. Change a dimension name or the aggregation and you change what the corpus
> admits — treat this document as load-bearing code, not prose.
> Companions: the shards are `packages/agent-ui/a2ui/corpus/<facet>/v1_0/<catalogId>.jsonl`, one directory
> per model-visible facet (`exemplar`, `multi-turn`, `repair`; ADR-0231 cl.1/cl.4); the record
> schema is `src/corpus/record.ts` (SPEC §5.1 — this rubric never restates it). Scale 1–5; 1 = failure,
> 3 = adequate, 5 = excellent.

## Runtime role — why the shape is fixed (read before editing)

1. **The aggregation is the SPEC-R8 bar.** `qualityScore = MIN across the applicable [gate]-typed
   dimensions` on the 1–5 scale; `passed = (qualityScore ≥ 4)`. Because the score is a MIN, a record is
   admitted only when **every** applicable gated dimension is ≥ 4 — one weak dimension sinks the record.
   The critic's VerdictsFile records `{ qualityScore, passed, failingDimensions }` per record, where
   `failingDimensions` lists every gated dimension scoring < 4 (corpus SPEC-R8 AC2 · ADR-0068 cl.3).
2. **The `version:` marker is a runtime contract.** The `version:` line above (currently `1.3`) is the rubric's
   identity. Every VerdictsFile MUST cite it as `rubricVersion` (ADR-0068 cl.1 · SPEC §5.3); the Node
   shell reads this marker and `parseVerdictsFile(text, expectedRubricVersion)` (build slice h11)
   **rejects** any verdicts file whose `rubricVersion` ≠ this marker — a verdict is meaningless without
   the standard it scored against. Bump this version whenever a dimension or an anchor moves. Every
   prior VerdictsFile must be re-authored against the new version when a dimension or an anchor **that
   applies to the judged facet** moves (ADR-0231 cl.5): a bump that only adds facet-scoped dimensions
   (1.3's D6 and D7) leaves every archived file valid history under the version it cites, and only a
   VerdictsFile authored after the bump cites the new marker. The VerdictsFile also carries
   `rubric: "a2ui-corpus"` (the name) separately; `rubricVersion` is only this marker's value.
3. **Tag semantics in this rubric.** `[gate]` marks a dimension whose score **gates admission** — it is
   one of the terms of the `qualityScore` MIN; `[review]` (none used here — see below) would mark an
   advisory dimension scored but excluded from the MIN. Every `[gate]` dimension names a **deterministic
   evidence floor** — a script/enum/CLI verdict that fixes its 1↔3 boundary — and the critic applies
   judgment only above that floor. This specializes the rubric-for-rubrics `[gate]` (which reads "purely
   mechanical") for a tier-2 judge, where corpus SPEC-R8 requires the score itself to carry judgment; the
   floor keeps the tag honest, the judgment above it is what tier-2 is *for*. All seven dimensions (D6 and D7 facet-scoped) are
   `[gate]` because a record failing **any one** of them is unfit for the corpus — there is no advisory
   quality axis here.
4. **Cite, never re-judge a script.** Each gated dimension's floor **cites** a realized deterministic
   verdict (the `validate-payload` CLI via `a2ui-payload.md`, `validateRecord`'s enum, the θ_dup index)
   — it does not recompute it (`process.md` rule 1). A record that already failed tier-1 (`E_SCHEMA`,
   `E_CATALOG`, `E_IDGRAPH`, `E_POINTER`) or dedup (`E_DUP`) never reaches this judge; the floors here
   are the *low anchors* those same mechanisms define, not a second implementation of them. D6 and D7 cite
   admission's own facet checks the same way (ADR-0231 cl.2/cl.3): action grounding plus the prior-seeded
   follow-up validation for a multi-turn record, recomputation equality for a repair record; a record
   failing either never reaches this judge.

## Dimensions

| # | Dimension | Type | Applies to | What it checks · evidence | Anchors: 1 → 3 → 5 |
|---|---|---|---|---|---|
| D1 | Ground-truth validity | [gate] | exemplar · multi-turn (the merged stream) · repair (the corrected stream); N/A on eval | The exemplar's `a2uiOutput` is a valid, idiomatic A2UI stream. This rubric does **not** re-judge the payload internals; it **cites `a2ui-payload.md`** (the sibling payload rubric): D1's score = that rubric's verdict for this record's `a2uiOutput`, folded as **`MIN` across `a2ui-payload.md`'s dimensions P1–P9** (its `[gate]` `validate-payload` CLI dims P1–P3 + its `[review]` dims P4–P9 (P8 hard-blocks promotion on its own, the GH #474 deceptive-composition defense; P9 = card anatomy fidelity, `a2ui-payload.md` 1.2 / GH #1199: where a `Card` frames the payload, `CardHeader` identity-only, `CardContent` substance, `CardFooter` THE action row; a payload with no `Card` scores P9 as N/A, omitted from the fold)), this rubric's own MIN convention, arithmetically identical to `a2ui-payload.md`'s "every dimension (P1–P9) ≥ 4" promote bar. It never restates those dimensions (cite, don't duplicate). *Applicability (1.3, ADR-0231 cl.5):* the stream the `validate-payload` floor and the P1–P9 fold run on is, per facet, the exemplar's `a2uiOutput`; a multi-turn record's MERGED `priorOutput ⊕ a2uiOutput` (exactly what the renderer mounted; a follow-up judged standalone fails P3 for want of the prior graph and proves nothing); a repair record's CORRECTED `a2uiOutput` (never its `invalidInput`, which is broken by contract). On an eval-facet record D1 is N/A and omitted from the MIN. | **D1's score IS the folded MIN value** (a MIN of 2 reads D1 = 2, per the calibration record); the anchors below name the bands: 1–2: `a2uiOutput` absent on an exemplar (1), OR `MIN` across `a2ui-payload.md` P1–P9 ≤ 2: a red `[gate]` (the `validate-payload` CLI exits 1: schema / catalog / id-graph / pointer) or a failing composition dim (incl. P9's scattered-actions anti-pattern: an action `Button` loose in `CardContent`, or any control in `CardHeader`) · 3: `MIN` across `a2ui-payload.md` P1–P9 = 3: tier-1 green (CLI exits 0) but a review dim (P4–P9) only adequate · 5: `MIN` across `a2ui-payload.md` P1–P9 = 5: an exemplary, fully idiomatic ground-truth stream |
| D2 | Prompt/description quality | [gate] | every facet (exemplar · multi-turn · repair · eval) | `promptText` reads as a realistic standalone user request a generating agent would actually receive, and `description` accurately + specifically names the UI and the technique the record teaches; the two are mutually consistent and consistent with the `a2uiOutput`. Deterministic floor: `validateRecord` requires non-empty `promptText` + `description` (blank → `E_SCHEMA`, corpus SPEC-R1 AC2; a stripped record never reaches this judge); above that floor the realism + pedagogy is judged by reading `promptText` + `description` against the output. | 1: `promptText` is vacuous/meta ("test button") or mismatched to the output, OR `description` is blank/generic ("a form") or contradicts the output (a truly empty field is already `E_SCHEMA` at tier-1) · 3: `promptText` is a plausible request and `description` is accurate but generic: correct, low pedagogical signal · 5: `promptText` reads as a genuine, specific user intent AND `description` precisely names the UI shape + the idiom it teaches (e.g. "action names carry the intent"), fully consistent with the output |
| D3 | Target-clarity | [gate] | every facet (exemplar · multi-turn · repair · eval) | The record's **effective judge target (computed as `target ?? description`, NEVER `target` raw: the ADR-0063 consumer rule)** is a clear, gradeable criterion. A scorer that reads `target` raw ignores the fallback and grades `undefined` on every target-less record (all 11 seeds omit `target`); this dimension exists to catch exactly that. Evidence: compute `target ?? description`; confirm it is non-empty and states checkable criteria. | 1: reading `target ?? description` yields empty/undefined: the raw-`target` bug on a target-less record, or a blank description · 3: the effective target is present via the fallback but is only a **topic label**: it names *what* the UI is, not *what a correct output must contain*, so two judges could grade the same output differently · 5: the effective target states **gradeable criteria** (the specific elements/behavior a correct output must exhibit), so a judge reaches a consistent verdict (for an exemplar leaning on the description fallback, the description enumerates the concrete checkable features, not just the topic) |
| D4 | Provenance integrity | [gate] | every facet (exemplar · multi-turn · repair · eval) | `meta.provenance.source` ∈ the closed enum `{authored, distilled, mined}` (SPEC-R5) and `meta.provenance.origin` is non-empty **and traceable**: a real, resolvable reference (a repo path, a session id, a mine URI), not a placeholder. Evidence: the enum is enforced deterministically by `validateRecord` (the mechanical floor); judge whether `origin` actually resolves. | 1: `source` outside the enum (rejected mechanically before scoring), OR `origin` empty/placeholder ("TODO", "unknown") · 3: `source` in-enum and `origin` non-empty but weakly traceable: a bare label with no resolvable reference · 5: `source` in-enum AND `origin` is a specific, resolvable reference (e.g. `src/examples/patterns.ts`, a session URI) an auditor can follow |
| D5 | Dedup adjacency | [gate] | every facet (exemplar · multi-turn · repair · eval) | Beyond the mechanical `E_DUP` cutoff (canonical-hash / θ_dup similarity, SPEC-R7; anything at or above the threshold is already rejected before scoring), the record adds **genuine diversity** relative to the current shard, rather than being a trivial variant that inflates it without teaching anything new. Evidence: the θ_dup similarity to the nearest shard neighbor (the mechanical floor); above it, judge distinctness of intent/technique/component-mix vs the nearest neighbours. | 1: a near-duplicate the θ_dup threshold barely missed: same intent + near-identical output as an admitted record; adds no diversity · 3: overlaps substantially with an admitted record (same pattern family) but varies one meaningful axis · 5: clearly distinct from every shard neighbour: a new intent, technique, or component composition the corpus did not already cover |
| D6 | Turn coherence | [gate] | multi-turn only | The follow-up `a2uiOutput` is the response a competent producer gives to *that* `clientInput[0].action`, with *that* context, on the surface `priorOutput` put on screen. Deterministic floor (cited, never recomputed): admission's action grounding (the `sourceComponentId` resolves in the prior fold and declares an action whose resolved name equals `action.name`) and the prior-seeded follow-up validation (a `root` resend is already `E_IDGRAPH`); a record failing either never reaches this judge (ADR-0231 cl.2). Above the floor, read the action against the follow-up: does it answer the intent (a form submit acknowledges or shows the submitted values; a list select reveals the selected item), update the live surface rather than rebuild it, and leave the data model coherent? | 1: the follow-up ignores the action, OR rebuilds the surface from scratch (re-sends the whole tree, or tears the surface down and recreates it to change what an update could) · 3: a plausible response that over-updates (re-sends untouched components or data) or under-updates (nothing the user can see acknowledges the action, or a control is left stale against the new state) · 5: a minimal, intent-matched, idiomatic follow-up: only what the action changed moves, through `updateDataModel` where a binding carries it and `updateComponents` only where structure or props must change |
| D7 | Repair fidelity | [gate] | repair only | The pair teaches a correction a producer can learn from: `invalidInput` is a breakage a producer actually makes, `validatorErrors` is the shared validator's verdict on it, and `a2uiOutput` fixes exactly that. Deterministic floor (cited, never recomputed): recomputation equality (the shared validator's finalize-mode failures on `invalidInput`, as a `(code, path)` set, equal `validatorErrors`) plus the corrected stream's own exemplar path (tier-1, pointers, dedup); a record failing either never reaches this judge (ADR-0231 cl.3). D1 already scores the corrected stream as a payload; D7 scores the correction. Above the floor, diff `invalidInput` against `a2uiOutput` and read the diff against the recorded errors: is the breakage realistic, is the fix minimal, is the broken stream's evident intent preserved? | 1: the fix rewrites the UI (the diff reaches far beyond the recorded error paths), OR the breakage is artificial (a defect no producer would emit, planted only to make an error appear) · 3: a correct fix of the recorded errors with incidental drift (an unrelated prop, copy or layout change rides along) · 5: a minimal fix (the diff touches only what the recorded errors name), a realistic breakage, and the broken stream's intent preserved |

## Gate to promote (admit a record at tier 2)

- **Aggregation (the Judge seam reads this):** `qualityScore = MIN across the applicable [gate] dimensions`
  (D1 to D7 per the `Applies to` column: D1 omitted for eval-facet records, D6 scored only on multi-turn,
  D7 only on repair) on the 1–5 scale. `passed = (qualityScore ≥ 4)`. Equivalent
  rule: **every applicable gated dimension must score ≥ 4.** Below-bar on admission → reject `E_QUALITY`
  with `failingDimensions`; below-bar at back-scoring → `status:"quarantined"` (corpus SPEC-R13 · ADR-0068
  cl.4).
- **Top failure to look for first:** a record that is tier-1-green and looks clean but scores 1 on **D3**
  because a consumer read `target` raw instead of `target ?? description` (grading `undefined`), or on
  **D2** because the `promptText` is an authoring stub rather than a real user request — both pass every
  deterministic gate yet make the record useless as conditioning material. That is the whole reason tier 2
  exists.
- **Calibration is mandatory (harness SPEC-R3 AC2):** two independent fresh-context scorings of the same record
  MUST agree within **±1 on every gated dimension**. A wider spread means an anchor is ambiguous —
  **repair the anchor (the source), never widen the tolerance** (harness LLD §8 discovered-reality note).

## Calibration record (harness SPEC-R3 AC2)

**1.3 note (2026-10-04, ADR-0231 cl.5).** The exemplar calibration below stands as recorded: 1.3 moves no
dimension that applies to an exemplar. D6 and D7 have no committed record to calibrate against yet; the
±1 two-scoring check for each is owed by the curation slice that judges the first records of its facet
(GH #1741 multi-turn, GH #1742 repair) and lands here as its own calibration record.

**Update (2026-10-04, GH #1741).** D6 is calibrated: see the D6 calibration record at the end of this
section. D7 is still owed by GH #1742.

**Update (2026-10-04, GH #1742).** D7 is calibrated: see the D7 calibration record at the end of this
section.

**Record scored:** `pattern-confirmation-card` from the 11-seed shelf
(`packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`) — an exemplar-facet record. Its
`promptText` asks to "confirm deleting their workspace, with Cancel and Delete buttons"; its
`description` is "A destructive-action confirmation card — two Buttons whose action names carry the
intent"; its `a2uiOutput` is a single-root `Card > CardContent > Column(title, body, actions)` with a
soft **Cancel** and a solid **Delete workspace** button (`confirm_delete`, `wantResponse`); provenance is
`authored`, origin `src/examples/patterns.ts`; no explicit `target` (so the effective target is the
description). It was scored **twice in independent fresh reasoning** simulating two separate critic reads.

**Tolerance:** the two scorings must agree within **±1 on every gated dimension** (harness SPEC-R3 AC2). They do —
see Δ below.

**1.2 re-read (2026-08-18, GH #1262).** The 1.0/1.1 record scored D1 = 5 folding P1–P8. Under 1.2's P1–P9
fold the SAME record reads **D1 = 2**: its two action Buttons ride a `Row` inside `CardContent` and the Card
ships NO `CardFooter` — below P9's anchor 3 ("every action Button rides in `CardFooter` and nowhere else"),
above anchor 1 (no populated footer exists for the loose buttons to be scattered AWAY from, and nothing
interactive sits in a header). Both re-reads land on 2 (Δ 0), so `qualityScore` = MIN = **2, `passed` false** —
the calibration example itself now FAILS admission, which is exactly what folding the card-anatomy law in
does. The table below carries both columns per scoring (1.1 fold → 1.2 fold); D2–D5 are untouched by the bump.
The record's admitted 1.1 verdict in the shard stands until a judged back-score/re-admission under 1.2 (a
follow-up on GH #1262's Findings, not this document's job — a rubric never edits the corpus).

**P7 reconciliation (2026-08-18, GH #1262 — Kim's take-up of the judges' escalation 1; no anchor moved,
so no version bump).** The judges escalated a conflict between `a2ui-payload.md` P7's Field-wrap anchor
and the card-anatomy worked sketch (req-a2ui-patterns.md R1, realized as the `frontier-card-anatomy-ask`
seed — P9's own anchor-3 reference shape), which put the group label in `CardHeader` and the `RadioGroup`
bare in `CardContent`. Ruled against the SHIPPED stack, the P7 anchor is RIGHT and stands unchanged: the
default catalog's `RadioGroup` row declares no `label` prop, and the one programmatic group-name path is
the `Field` wrap — the ADR-0051 labelling seam (`ui-radio-group` carries `internals.role='radiogroup'`,
so the base `applyFieldLabelling` reflects `ariaLabelledByElements` from the wrapping `ui-field`'s label
part); a `CardHeader` `Text` is visually adjacent but never programmatically associated. The sketch side
was the wrong document: the SEED gained the `Field` wrap (`src/examples/catalog-frontier.ts`, same-day;
the research doc's R1 sketch stays as-written — the seed carries current law, the established
pre-ADR-0201 convention). P7 gains no group-control clause: a bare `RadioGroup` reads 3 exactly as the
anchor says, the read the admitted shard (25/26 Field-wrapped) already embodies.

| Gated dimension | Scoring A (1.1 → 1.2) | Scoring B (1.1 → 1.2) | Δ (must be ≤ 1) |
|---|---|---|---|
| Ground-truth validity | 5 → **2** | 5 → **2** | 0 |
| Prompt/description quality | 5 | 5 | 0 |
| Target-clarity | 4 | 4 | 0 |
| Provenance integrity | 5 | 5 | 0 |
| Dedup adjacency | 4 | 5 | 1 |
| qualityScore (MIN of gated dims) | 4 → **2** | 4 → **2** | 0 |
| passed (≥ 4) | true → **false** | true → **false** | — |

**Reasoning, per scoring:**

- **Ground-truth validity (A 5 · B 5 under the 1.1 fold; A 2 · B 2 under 1.2).** Both reads: the stream is
  single-root, idiomatic (semantic `soft`/`solid` variants, `justify:end` action row, `wantResponse` on the
  destructive action), and the record ships tier-1-green (status `valid`, hash present), so `MIN` across
  `a2ui-payload.md` P1–P8 = 5. Folding P9 in (1.2): the Card has no `CardFooter` and both Buttons sit in
  `CardContent` → P9 = 2 on both reads (see the 1.2 re-read note above) → D1 = 2. The repair is the
  `frontier-card-anatomy-ask` shape — move the action `Row` into a `CardFooter` (one solid primary + one
  ghost/soft secondary) — after which P9 reads 5 and D1 returns to 5.
- **Prompt/description quality (A 5 · B 5).** Both reads: `promptText` is a realistic user request and
  `description` names the concrete idiom ("action names carry the intent"), consistent with the output.
- **Target-clarity (A 4 · B 4).** No `target`, so the effective target is `target ?? description` = the
  description. Both reads: it names *checkable* features (a confirmation card, two buttons, intent-named
  actions) — above a bare topic label (3) — but does not enumerate every gradeable element (the copy, the
  destructive styling), so short of 5. The tightened D3 anchors ("topic label" vs "gradeable criteria")
  land both reads on 4; an earlier draft whose 3↔5 anchors were vaguer straddled the bar (A 4, B 3) — the
  anchors were tightened until the reads converged, per the never-widen-tolerance discipline.
- **Provenance integrity (A 5 · B 5).** Both reads: `source: authored` is in-enum and
  `origin: src/examples/patterns.ts` is a resolvable repo path.
- **Dedup adjacency (A 4 · B 5).** The honest ±1 spread. A: shares the `Card > CardContent > Column`
  scaffold with four other `pattern-*` cards, so distinct-intent-but-familiar-structure → 4. B: the
  destructive-confirmation intent + the action-name-as-intent idiom is covered by no other shard record →
  5. Both ≥ 4; the admission outcome is identical (`qualityScore` 4, `passed` true), so the spread is
  within tolerance and does not require an anchor repair.

### D6 calibration record (2026-10-04, GH #1741, rubric 1.3)

No anchor moved, so no version bump (the P7 reconciliation precedent above).

**Record scored:** `mt-rsvp-form-submit`, the first multi-turn record
(`packages/agent-ui/a2ui/corpus/multi-turn/v1_0/agent-ui.jsonl`, origin
`src/examples/multi-turn-seeds.ts`). The prior turn is a `FormProvider > Card` RSVP form (name, guests, a
dietary note) with a footer submit Button (`submit_rsvp`, `submit:true`, `disabled` bound to
`/status/sent`) on a `sendDataModel:true` surface. The action is that submit, with the filled-in model.
The follow-up is one `updateDataModel` at `/status`, which echoes the submitted values in the bound status
line and flips the bound `disabled`, plus one `updateComponents` that resends only the footer action
`Row` to add a soft "Add to calendar" Button. Two independent fresh-context `a2ui-review-agent` scorings
were taken: A authored the VerdictsFile, and B was dispatched blind to A. D1 was read on the merged
stream, as 1.3 requires. D5 was read against the exemplar shard, because no multi-turn shard existed at
judging time.

| Gated dimension | Scoring A | Scoring B | Δ (must be ≤ 1) |
|---|---|---|---|
| Ground-truth validity (merged stream) | 4 | 5 | 1 |
| Prompt/description quality | 5 | 5 | 0 |
| Target-clarity | 5 | 5 | 0 |
| Provenance integrity | 5 | 5 | 0 |
| Dedup adjacency | 4 | 4 | 0 |
| Turn coherence (D6) | 5 | 5 | 0 |
| qualityScore (MIN of gated dims) | 4 | 4 | 0 |
| passed (≥ 4) | true | true | n/a |

**Reasoning, per dimension:**

- **D6 (A 5 · B 5).** Both reads cite the floor (`btn_rsvp` declares `submit_rsvp`; the prior-seeded
  follow-up validates) and land on the 5 anchor for the same reasons:
  - The follow-up answers the submit by echoing the submitted values through an existing binding.
  - The `disabled` flip rides the same data write.
  - The one structural change is the footer row gaining a Button.
  - Root, card and fields are not resent.

  The D6 anchors converged with no tightening.
- **D1 (A 4 · B 5).** This is the honest ±1, and it sits in the cited P9 read, not in any 1.3 text. A
  reads P9 at 4, because after the turn the only live footer affordance is the soft secondary beside a
  disabled solid primary. B reads P9 at 5, because the footer is still one solid primary plus one
  secondary. The admission outcome is identical.
- **D5 (A 4 · B 4).** The prior is the `feedback-form` scaffold. The new axis is the
  submit-acknowledge turn technique.
- **Observation (no anchor change):** D2's wording assumes a standalone request. A multi-turn
  `promptText` is necessarily a first-person turn narration. Both reads scored it 5. Watch for drift
  here in later multi-turn waves before touching the anchor.

The second record, `mt-order-list-select`, was judged by A at qualityScore 4 (D1 4, the P5 read of a
Button as a `List` template node; D2 to D6 at 5), after the maker took A's two P4/P5 hand-backs. B scored
the pre-revision stream at the same qualityScore 4.

### D7 calibration record (2026-10-04, GH #1742, rubric 1.3)

No anchor moved, so no version bump (the P7 reconciliation precedent above).

**Records scored:** `rp-agenda-components-map` and `rp-plan-card-footer-containment`, two of the first
five repair records (`packages/agent-ui/a2ui/corpus/repair/v1_0/agent-ui.jsonl`, origin
`src/examples/repair-seeds.ts`).

- The agenda record's `invalidInput` sends `updateComponents.components` as an id-keyed object. The
  recomputed set is `SCHEMA [2].updateComponents.components` plus the consequential
  `IDGRAPH agenda:root-missing`. The correction sends the same three records as an array.
- The plan record's `invalidInput` nests the `CardFooter` inside the content column (`CONTAINMENT
  pl_footer`). The correction moves that one reference to the `Card`.

Two independent fresh-context `a2ui-review-agent` scorings were taken on the final streams. A authored
the VerdictsFile, and B was dispatched blind to A. D1 was read on the corrected stream, as 1.3 requires.
D5 was read against the exemplar and multi-turn shards, because no repair shard existed at judging time.

| Gated dimension | Agenda A | Agenda B | Δ | Plan A | Plan B | Δ |
|---|---|---|---|---|---|---|
| Ground-truth validity (corrected stream) | 5 | 5 | 0 | 5 | 4 | 1 |
| Prompt/description quality | 5 | 5 | 0 | 5 | 5 | 0 |
| Target-clarity | 5 | 5 | 0 | 5 | 5 | 0 |
| Provenance integrity | 5 | 5 | 0 | 5 | 5 | 0 |
| Dedup adjacency | 4 | 4 | 0 | 4 | 4 | 0 |
| Repair fidelity (D7) | 5 | 5 | 0 | 5 | 5 | 0 |
| qualityScore (MIN of gated dims) | 4 | 4 | 0 | 4 | 4 | 0 |
| passed (≥ 4) | true | true | n/a | true | true | n/a |

Every Δ is ≤ 1.

**Reasoning, per dimension:**

- **D7 (5 on all four reads).** Both scorings cite the floor (recomputation equality on `invalidInput`
  plus the corrected stream's exemplar path) rather than re-deriving it. Both land on the 5 anchor for
  the same three reasons:
  - The breakage is one a producer actually emits: an id-keyed map, or a footer treated as the last
    content row.
  - The diff is exactly the recorded error path. The agenda diff is the envelope field, with records,
    ids and order unchanged. The plan diff is two reference lines, with all nodes otherwise identical.
  - The intent survives the fix.

  A consequential error that clears with the root fix (the agenda's `root-missing`) read as part of the
  one breakage for both scorers, not as a second edit. The D7 anchors converged with no tightening.
- **D1 on the plan card (A 5 · B 4).** This is the honest ±1, and it sits in the cited P5 read, not in
  any 1.3 text. B docks a `List` with static `Text` children, because no shelf seed uses `List` outside a
  template. A cites `list.md`, which sanctions static children for an itemized collection. The admission
  outcome is identical.
- **D5 (4 on all four reads).** Each record has a familiar scaffold. The new axis is the breakage class,
  which `recordIdentity` folds in through `validatorErrors`.

**Observations (no anchor change):**

- **A first-pass divergence that the revision removed.** On the pre-revision plan stream, A read D1 at 2,
  because the price was a `Text` `h2` with no seed precedent (P5 2, P7 3). A first blind B read the same
  stream at 4. That is a Δ of 2 on the cited payload rubric's P5, not on D7. The maker took A's hand-back
  (`pl_price` became a `Stat`, the shelf's price idiom), and the table above is on the revised stream. If
  a later wave shows the same split on an in-enum value with no seed precedent, tighten `a2ui-payload.md`
  P5, not this rubric.
- **D5 is silent on the breakage class.** For repair records, D5's evidence column does not say whether
  the breakage class counts as a technique axis. Both scorings credited it as one, and every repair MIN
  sits on D5 = 4. A reader who excludes it lands at 3, which flips admission. This is the first candidate
  for a versioned clarification.
- **D2 wording.** D2's 5 anchor ("names the UI shape + the idiom it teaches") is written for an exemplar
  description. A repair description describes the correction. Both scorers graded it without friction.
  This is the same watch item the D6 record raised.

All five admitted records, with A's final-pass scores (each passed at qualityScore 4; the agenda and plan
rows are the A columns of the table above):

| Record | Breakage (stored `validatorErrors`) | D1 | D2 to D4 | D5 | D7 | qualityScore |
|---|---|---|---|---|---|---|
| `rp-invite-dangling-button` | `IDGRAPH inv_actions->btn_send` | 4 (P7 4) | 5 | 4 | 5 | 4 |
| `rp-checkout-button-text-prop` | `CATALOG btn_continue.text` | 5 | 5 | 4 | 5 | 4 |
| `rp-plan-card-footer-containment` | `CONTAINMENT pl_footer` | 5 | 5 | 4 | 5 | 4 |
| `rp-prefs-pointer-slash` | `POINTER [1].updateDataModel.path` | 4 (P7 4) | 5 | 4 | 5 | 4 |
| `rp-agenda-components-map` | `SCHEMA [2].updateComponents.components`, `IDGRAPH agenda:root-missing` | 5 | 5 | 4 | 5 | 4 |

The invite and plan records first failed D1 at 2 and passed after the maker's hand-back round. The invite
failure was P6: no `sendDataModel` on a surface whose Send action round-trips the model.

<!-- Independent critic: the doc-checker agent scores this rubric against rubric-for-rubrics (generator ≠ critic). Author self-check only: D1 typed/scaled ✓ · D3 anchors ✓ · D5 evidence column ✓ · D8 gate+aggregation+top-failure ✓ · harness_checks.py rubric exit 0. -->
