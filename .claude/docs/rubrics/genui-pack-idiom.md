# Rubric — GenUI Pack-Idiom (the B3 judged eval standard)

version: 1.0

> Layer: rubric (a **runtime-consumed** judge standard, not a graded-once document) · 2026-08-22
> Grades one `GenuiCorpusRecord` for PRD §8 **m3** ("uses the source: judge-scored ≥ 4/5 against the
> corpus rubric for demonstrable use of the picked pack's idioms"). It is read VERBATIM at runtime by the
> `judge` leg (`tools/corpus-genui/legs/judge.ts`) — the whole document text is the system prompt's
> standard-of-record, one source, no drift pair between this doc and the judge prompt. `readRubricVersion()`
> (the `rescore.ts` marker-reader precedent, reused by name) reads the `version:` line above; every
> `GenuiVerdictsFile` MUST cite it as `rubricVersion` (`src/corpus-genui/verdicts.ts`'s
> `parseGenuiVerdictsFile` rejects any mismatch) — a verdict is meaningless without the standard it scored
> against. Change a dimension name or the aggregation and you change what m3 measures — treat this
> document as load-bearing code, not prose.
> Companions: the shard is `packages/agent-ui/a2ui/corpus-genui/records/v1/*.jsonl` (EMPTY at ship — the
> no-fabrication law, genui-b3-judged-eval.lld.md §0); the record schema is `src/corpus-genui/record.ts`;
> the pack registry is `src/agent/prompts/genui-packs.ts` (`GENUI_PACKS` — three packs: `animated-explainers`,
> `data-viz-layouts`, `interactive-widgets`). Scale 1–5; 1 = failure, 3 = adequate, 5 = excellent.

## Runtime role — why the shape is fixed (read before editing)

1. **The aggregation is the m3 bar.** `qualityScore = MIN across D1–D4` (all four are `[gate]` — every
   dimension gates; there is no advisory-only axis for a v1 eval corpus). `passed = (qualityScore ≥ 4)`.
   Because the score is a MIN, a record passes only when **every** dimension is ≥ 4 — one weak dimension
   sinks the record (the a2ui-corpus rubric's own posture, lifted here). The `judge` leg computes
   `qualityScore`/`passed` itself and never trusts the model's own arithmetic;
   `parseGenuiVerdictsFile` re-checks both on read.
2. **The `version:` marker is a runtime contract.** The line above (currently `1.0`) is this rubric's
   identity. Every `GenuiVerdictsFile` MUST cite it as `rubricVersion` — a mismatch is rejected on parse
   (`src/corpus-genui/verdicts.ts`). Bump this version whenever a dimension or an anchor moves, and re-run
   `--calibrate` (LLD §4, the `judge` leg's own re-score-twice-and-diff mode) before trusting a new judged
   pass; a prior `GenuiVerdictsFile` stays valid history under the version it was judged against — never
   silently reinterpreted.
3. **Tag semantics in this rubric.** `[gate]` marks a dimension whose score gates the aggregation — every
   dimension here is `[gate]`; no `[review]` member exists in v1 (a small, four-dimension eval standard,
   unlike the nine-dimension A2UI ground-truth rubric it does NOT extend or parametrize — this is a
   sibling document, mirroring that rubric's SHAPE by pattern, never its content). Each `[gate]` dimension
   names a deterministic evidence floor the judge CITES, never re-derives.
4. **Cite, never re-judge a script.** D1/D3/D4 each cite a mechanical fact already computed before the
   judge ever sees the record: `validateGenuiRecord`'s `[]`/`E_*` verdict, the wire's own hash pins, and
   `lintGenuiHtml`'s deterministic counts (`src/corpus-genui/lint.ts`) — the judge reads these numbers off
   `meta.lint`, it never re-scans the html itself for them. Only **D2** carries no mechanical floor at
   all: pack-idiom use is exactly the judgment this eval exists to make.

## Dimensions

| # | Dimension | Type | What it checks · evidence | Anchors: 1 → 3 → 5 |
|---|---|---|---|---|
| D1 | Envelope + document validity | [gate] | `validateGenuiRecord` = `[]` (the wire gate, the hash pins — a tier-1 reject never reaches the judge); `meta.lint.hasDoctype` cited, never recomputed. | 1: the document is truncated, unbalanced, or carries leftover prompt/meta prose bleeding into the markup · 3: valid but has a minor structural rough edge (e.g. no `<!doctype html>`, a stray unstyled wrapper) that does not break rendering · 5: the document is coherent — one root, no truncated/unbalanced markup, no leftover prompt prose, a clean `<!doctype html>` document |
| D2 | Pack-idiom use — the m3 dimension | [gate] | No mechanical floor — this is the judgment the eval exists for. Evidence: the pack body's named `Anatomy —` sections (`src/agent/prompts/genui-packs/*.md`) compared against the record's `html`. | 1: no named idiom present, or a generic component unrelated to the pack (e.g. a CDN chart library standing in for the pack's own CSS-driven shapes) · 3: one idiom present, only partially followed (the shape is recognizable but a stated constraint is dropped) · 5: the pack's anatomy is followed with ≥ 2 named idioms AND the pack's stated constraints (CSS-driven shapes, no external library, the `genui.action` bridge, etc.) are honored |
| D3 | Prompt fit | [gate] | `promptText` non-empty is the `E_SCHEMA` floor (already enforced before the judge sees the record); above that, whether the html answers THIS specific ask. | 1: the html ignores the prompt's actual data/labels/affordances — a generic demo of the pack, or renders nothing at all (e.g. depends on a blocked external script) · 3: answers the ask's general shape but misses or genericizes some of its specific data/labels · 5: the html answers exactly what the prompt asked — its data, its labels, its affordances — never a decontextualized demo of the pack |
| D4 | Sandbox-reality conformance | [gate] | `meta.lint.externalRefs` (0 is the 3-floor; > 0 caps the score at 2) and `meta.lint.tokenRefs` (≥ 1 is the 3-floor) — cited from `meta.lint`, never recomputed by the judge. | 1: depends on a network-fetched external resource that the sandbox denies (`externalRefs > 0`) AND carries zero token refs — a double violation · 3: `externalRefs = 0` and `tokenRefs ≥ 1`, but theming is shallow (tokens read with no literal fallback, or only cosmetically applied) · 5: `externalRefs = 0`, self-contained, themed via `var(--md-sys-color-*)`/`var(--md-sys-typescale-*)` tokens WITH literal fallbacks so the surface degrades gracefully if a bridge message never arrives |

## Gate to promote (m3's floor)

- **Aggregation (the `judge` leg reads this):** `qualityScore = MIN(D1, D2, D3, D4)`. `passed = (qualityScore ≥ 4)`.
  Equivalent rule: **every dimension must score ≥ 4.** The `report` leg's own m3 floor (LLD §5) is
  stricter still — **every judged pack-conditioned record** must pass, not merely most; a single sub-4
  record fails the run's floor (`floorMet:false`), never averaged away.
- **Top failure to look for first:** a record that is structurally clean (D1 = 5, D4 = 5 — no external
  refs, real token use) but scores 1–2 on **D2** because the model reached for a generic, catalog-shaped
  widget instead of the pack's own named anatomy — passing every mechanical floor while teaching nothing
  about the pack it was conditioned on. That is the whole reason this eval exists.
- **Calibration is mandatory (the a2ui-corpus rubric's own ±1 law, kept):** two independent reads of the
  SAME record must agree within **±1 on every gated dimension**. A wider spread means an anchor is
  ambiguous — repair the anchor, never widen the tolerance.

## Calibration record

**Fixtures scored:** the two committed calibration fixtures under
`packages/agent-ui/a2ui/corpus-genui/fixtures/` — `anatomy-data-viz.genui.json` (the POSITIVE fixture: a
`data-viz-layouts` pack anatomy snippet — a bar/column comparison + a KPI/metric grid — wrapped as a full
document) and `off-idiom-cdn.genui.json` (the NEGATIVE counter-fixture: a generic mount `<div>` deferring
to a CDN `<script src>` chart library, zero token refs). Both are scored as if answering the SAME
representative prompt (`data-viz-layouts-1`, prompts.json: "Compare monthly revenue across our four
regions, and call out the top performer."). **These are fixture calibration, authored keyless by the
build seat's own two independent fresh reads — NOT a judged run** (PRD §8 m3's real judged pass is Kim's
named manual run, AC18, out of this build's scope). Neither fixture is ever a shard record; the standing
gate (`src/corpus-genui/corpus-genui-data.test.ts`) asserts both are absent from `records/` and every
verdict file.

**Tolerance:** every per-dimension Δ ≤ 1 across the two reads (the mandatory ±1 law above). They agree —
see the table below.

| Fixture | Dimension scored | Read A | Read B | Δ |
|---|---|---|---|---|
| anatomy-data-viz (positive) | Envelope + document validity | 5 | 5 | 0 |
| anatomy-data-viz (positive) | Pack-idiom use | 5 | 5 | 0 |
| anatomy-data-viz (positive) | Prompt fit | 5 | 4 | 1 |
| anatomy-data-viz (positive) | Sandbox-reality conformance | 5 | 5 | 0 |
| anatomy-data-viz (positive) | **qualityScore (MIN)** | **5** | **4** | 1 |
| anatomy-data-viz (positive) | **passed (≥ 4)** | **true** | **true** | — |
| off-idiom-cdn (negative) | Envelope + document validity | 5 | 5 | 0 |
| off-idiom-cdn (negative) | Pack-idiom use | 1 | 1 | 0 |
| off-idiom-cdn (negative) | Prompt fit | 1 | 2 | 1 |
| off-idiom-cdn (negative) | Sandbox-reality conformance | 1 | 1 | 0 |
| off-idiom-cdn (negative) | **qualityScore (MIN)** | **1** | **1** | 0 |
| off-idiom-cdn (negative) | **passed (≥ 4)** | **false** | **false** | — |

**Reasoning, per fixture:**

- **anatomy-data-viz (positive).** D1: a well-formed single-root `<!doctype html>` document, no
  truncated/unbalanced markup — 5 both reads. D2: the html follows the `data-viz-layouts` pack's own named
  anatomy on TWO idioms (`Anatomy — a bar/column comparison` AND `Anatomy — a KPI/metric grid`), CSS-driven
  bars (`transform: scaleY()`-style growth, `border-radius`), no charting library — 5 both reads, the
  anchor-5 bar cleanly met. D3: the rendered bars name the actual regions (NA/EU/APAC) with real dollar
  figures and explicitly call out the top region (NA) — read A scores this a clean 5 (answers exactly what
  the representative prompt asked); read B is slightly more conservative (4 — the KPI grid's "Total"/
  "Regions" cards are pack-anatomy filler beyond the literal ask, a legitimate but debatable read), the
  honest ±1 spread this law exists to catch. D4: `externalRefs = 0`, six `var(--md-sys-color-*, <literal
  fallback>)` reads across the fill/surface/outline roles — a real, fallback-guarded theming — 5 both
  reads. MIN lands 5 / 4 (Δ 1, within tolerance); `passed:true` both reads — the record the standard is
  meant to reward.
- **off-idiom-cdn (negative).** D1: still a structurally coherent document (one root, no truncation) — the
  failure here is never about envelope validity, so 5 both reads (D1 measures shape, not idiom or fit).
  D2: no named `data-viz-layouts` idiom anywhere — a bare `<div id="chart-mount">` deferring entirely to an
  external library the sandbox cannot load — anchor-1's own example ("a CDN chart library standing in for
  the pack's own CSS-driven shapes") almost verbatim — 1 both reads. D3: the mount div renders NOTHING on
  its own (the CDN script never executes inside the sandbox's network-denied boundary), so it answers
  nothing of the actual ask — read A scores the harder 1 (no data, no labels, nothing rendered at all);
  read B allows a 2 (the div is at least SIZED/labeled as a chart mount, a token gesture toward the ask's
  shape) — the honest ±1 spread. D4: `externalRefs = 1` (the CDN `<script src>`) AND `tokenRefs = 0` — the
  anchor-1 double violation exactly — 1 both reads. MIN lands 1 / 1 (Δ 0); `passed:false` both reads, with
  `D2 ≤ 2` and `D4 ≤ 2` on both — the calibration requirement this record exists to prove.

<!-- Independent critic: the doc-checker agent scores this rubric against rubric-for-rubrics (generator ≠
     critic). Author self-check only: D1-D4 typed [gate] + anchored 1/3/5 ✓ · evidence column names a cited
     mechanical fact per gated dimension ✓ · gate-to-promote + top-failure + calibration ✓ ·
     harness_checks.py rubric exit 0. -->
