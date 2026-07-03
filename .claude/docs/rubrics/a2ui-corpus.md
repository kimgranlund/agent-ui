# Rubric — A2UI Corpus Quality (the tier-2 admission judge standard)

version: 1.0

> Layer: rubric (a **runtime-consumed** judge standard, not a graded-once document) · 2026-07-03
> Grades one `CorpusRecord` for tier-2 admission (corpus SPEC-R8). It is read at runtime by
> `admit()`'s injected judge seam (ADR-0060) through the verdict adapter (ADR-0068): the
> `a2ui-reviewer` critic scores each record against **these exact dimensions** and authors a
> VerdictsFile; `createVerdictJudge` plumbs those verdicts into the pipeline; `import-seeds --verdicts`
> and `rescore` consume them. Change a dimension name or the aggregation and you change what the corpus
> admits — treat this document as load-bearing code, not prose.
> Companions: the shard is `packages/agent-ui/a2ui/corpus/exemplar/v1_0/agent-ui.jsonl`; the record
> schema is `src/corpus/record.ts` (SPEC §5.1 — this rubric never restates it). Scale 1–5; 1 = failure,
> 3 = adequate, 5 = excellent.

## Runtime role — why the shape is fixed (read before editing)

1. **The aggregation is the SPEC-R8 bar.** `qualityScore = MIN across the applicable [gate]-typed
   dimensions` on the 1–5 scale; `passed = (qualityScore ≥ 4)`. Because the score is a MIN, a record is
   admitted only when **every** applicable gated dimension is ≥ 4 — one weak dimension sinks the record.
   The critic's VerdictsFile records `{ qualityScore, passed, failingDimensions }` per record, where
   `failingDimensions` lists every gated dimension scoring < 4 (corpus SPEC-R8 AC2 · ADR-0068 cl.3).
2. **The `version:` marker is a runtime contract.** The `version: 1.0` line above is the rubric's
   identity. Every VerdictsFile MUST cite it as `rubricVersion` (ADR-0068 cl.1 · SPEC §5.3); the Node
   shell reads this marker and `parseVerdictsFile(text, expectedRubricVersion)` (build slice h11)
   **rejects** any verdicts file whose `rubricVersion` ≠ this marker — a verdict is meaningless without
   the standard it scored against. Bump this version whenever a dimension or an anchor moves, and every
   prior VerdictsFile must be re-authored against the new version. The VerdictsFile also carries
   `rubric: "a2ui-corpus"` (the name) separately; `rubricVersion` is only this marker's value.
3. **Tag semantics in this rubric.** `[gate]` marks a dimension whose score **gates admission** — it is
   one of the terms of the `qualityScore` MIN; `[review]` (none used here — see below) would mark an
   advisory dimension scored but excluded from the MIN. Every `[gate]` dimension names a **deterministic
   evidence floor** — a script/enum/CLI verdict that fixes its 1↔3 boundary — and the critic applies
   judgment only above that floor. This specializes the rubric-for-rubrics `[gate]` (which reads "purely
   mechanical") for a tier-2 judge, where corpus SPEC-R8 requires the score itself to carry judgment; the
   floor keeps the tag honest, the judgment above it is what tier-2 is *for*. All five dimensions are
   `[gate]` because a record failing **any one** of them is unfit for the corpus — there is no advisory
   quality axis here.
4. **Cite, never re-judge a script.** Each gated dimension's floor **cites** a realized deterministic
   verdict (the `validate-payload` CLI via `a2ui-payload.md`, `validateRecord`'s enum, the θ_dup index)
   — it does not recompute it (`process.md` rule 1). A record that already failed tier-1 (`E_SCHEMA`,
   `E_CATALOG`, `E_IDGRAPH`, `E_POINTER`) or dedup (`E_DUP`) never reaches this judge; the floors here
   are the *low anchors* those same mechanisms define, not a second implementation of them.

## Dimensions

| # | Dimension | Type | What it checks · evidence | Anchors: 1 → 3 → 5 |
|---|---|---|---|---|
| D1 | Ground-truth validity | [gate] | The exemplar's `a2uiOutput` is a valid, idiomatic A2UI stream. This rubric does **not** re-judge the payload internals — it **cites `a2ui-payload.md`** (the sibling payload rubric): D1's score = that rubric's verdict for this record's `a2uiOutput`, folded as **`MIN` across `a2ui-payload.md`'s dimensions P1–P7** (its `[gate]` `validate-payload` CLI dims P1–P3 + its `[review]` composition dims P4–P7) — this rubric's own MIN convention, arithmetically identical to `a2ui-payload.md`'s "every dimension ≥ 4" promote bar. It never restates those dimensions (cite, don't duplicate). *Applicability:* exemplar-facet only (records carrying `a2uiOutput`); on an eval-facet record D1 is N/A and omitted from the MIN. | 1: `a2uiOutput` absent on an exemplar, OR `MIN` across `a2ui-payload.md` P1–P7 ≤ 2 — a red `[gate]` (the `validate-payload` CLI exits 1: schema / catalog / id-graph / pointer) or a failing composition dim · 3: `MIN` across `a2ui-payload.md` P1–P7 = 3 — tier-1 green (CLI exits 0) but a composition dim (P4–P7) only adequate · 5: `MIN` across `a2ui-payload.md` P1–P7 = 5 — an exemplary, fully idiomatic ground-truth stream |
| D2 | Prompt/description quality | [gate] | `promptText` reads as a realistic standalone user request a generating agent would actually receive, and `description` accurately + specifically names the UI and the technique the record teaches; the two are mutually consistent and consistent with the `a2uiOutput`. Deterministic floor: `validateRecord` requires non-empty `promptText` + `description` (blank → `E_SCHEMA`, corpus SPEC-R1 AC2 — a stripped record never reaches this judge); above that floor the realism + pedagogy is judged by reading `promptText` + `description` against the output. | 1: `promptText` is vacuous/meta ("test button") or mismatched to the output, OR `description` is blank/generic ("a form") or contradicts the output (a truly empty field is already `E_SCHEMA` at tier-1) · 3: `promptText` is a plausible request and `description` is accurate but generic — correct, low pedagogical signal · 5: `promptText` reads as a genuine, specific user intent AND `description` precisely names the UI shape + the idiom it teaches (e.g. "action names carry the intent"), fully consistent with the output |
| D3 | Target-clarity | [gate] | The record's **effective judge target — computed as `target ?? description`, NEVER `target` raw (the ADR-0063 consumer rule)** — is a clear, gradeable criterion. A scorer that reads `target` raw ignores the fallback and grades `undefined` on every target-less record (all 11 seeds omit `target`); this dimension exists to catch exactly that. Evidence: compute `target ?? description`; confirm it is non-empty and states checkable criteria. | 1: reading `target ?? description` yields empty/undefined — the raw-`target` bug on a target-less record, or a blank description · 3: the effective target is present via the fallback but is only a **topic label** — it names *what* the UI is, not *what a correct output must contain*, so two judges could grade the same output differently · 5: the effective target states **gradeable criteria** — the specific elements/behavior a correct output must exhibit — so a judge reaches a consistent verdict (for an exemplar leaning on the description fallback, the description enumerates the concrete checkable features, not just the topic) |
| D4 | Provenance integrity | [gate] | `meta.provenance.source` ∈ the closed enum `{authored, distilled, mined}` (SPEC-R5) and `meta.provenance.origin` is non-empty **and traceable** — a real, resolvable reference (a repo path, a session id, a mine URI), not a placeholder. Evidence: the enum is enforced deterministically by `validateRecord` (the mechanical floor); judge whether `origin` actually resolves. | 1: `source` outside the enum (rejected mechanically before scoring), OR `origin` empty/placeholder ("TODO", "unknown") · 3: `source` in-enum and `origin` non-empty but weakly traceable — a bare label with no resolvable reference · 5: `source` in-enum AND `origin` is a specific, resolvable reference (e.g. `src/examples/patterns.ts`, a session URI) an auditor can follow |
| D5 | Dedup adjacency | [gate] | Beyond the mechanical `E_DUP` cutoff (canonical-hash / θ_dup similarity, SPEC-R7 — anything at or above the threshold is already rejected before scoring), the record adds **genuine diversity** relative to the current shard, rather than being a trivial variant that inflates it without teaching anything new. Evidence: the θ_dup similarity to the nearest shard neighbor (the mechanical floor); above it, judge distinctness of intent/technique/component-mix vs the nearest neighbours. | 1: a near-duplicate the θ_dup threshold barely missed — same intent + near-identical output as an admitted record; adds no diversity · 3: overlaps substantially with an admitted record (same pattern family) but varies one meaningful axis · 5: clearly distinct from every shard neighbour — a new intent, technique, or component composition the corpus did not already cover |

## Gate to promote (admit a record at tier 2)

- **Aggregation (the Judge seam reads this):** `qualityScore = MIN across the applicable [gate] dimensions`
  (D1–D5; D1 omitted for eval-facet records) on the 1–5 scale. `passed = (qualityScore ≥ 4)`. Equivalent
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

| Gated dimension | Scoring A | Scoring B | Δ (must be ≤ 1) |
|---|---|---|---|
| Ground-truth validity | 5 | 5 | 0 |
| Prompt/description quality | 5 | 5 | 0 |
| Target-clarity | 4 | 4 | 0 |
| Provenance integrity | 5 | 5 | 0 |
| Dedup adjacency | 4 | 5 | 1 |
| qualityScore (MIN of gated dims) | 4 | 4 | 0 |
| passed (≥ 4) | true | true | — |

**Reasoning, per scoring:**

- **Ground-truth validity (A 5 · B 5).** Both reads: the stream is single-root, idiomatic (semantic
  `soft`/`solid` variants, `justify:end` action row, `wantResponse` on the destructive action), and the
  record ships tier-1-green (status `valid`, hash present), so `MIN` across `a2ui-payload.md` P1–P7 = 5.
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

<!-- Independent critic: the doc-reviewer agent scores this rubric against rubric-for-rubrics (generator ≠ critic). Author self-check only: D1 typed/scaled ✓ · D3 anchors ✓ · D5 evidence column ✓ · D8 gate+aggregation+top-failure ✓ · harness_checks.py rubric exit 0. -->
