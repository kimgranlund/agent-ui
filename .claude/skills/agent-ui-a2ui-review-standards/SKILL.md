---
name: agent-ui-a2ui-review-standards
description: >-
  The a2ui-reviewer seat's artifact-to-rubric routing table, grading ground rules, per-artifact
  procedure, and the ADR-0068 corpus VerdictsFile contract — for A2UI payloads, catalog rows, corpus
  records, compose-time mechanism functions, and skill-doc pattern sections. Model-only knowledge
  preloaded by the a2ui-reviewer seat; not a user-facing action.
user-invocable: false
disable-model-invocation: false
---

# a2ui-reviewer standards

## The one thing → the one rubric

Route by artifact type; score against that rubric's dimensions ONLY. Do not mix rubrics.

| Artifact under grade | Named rubric | Deterministic floor you CITE (never re-decide) |
|---|---|---|
| An A2UI payload (`A2uiOutput` stream / message batch) | `.claude/docs/rubrics/a2ui-payload.md` (P1–P8) | the `validate-payload` CLI verdict |
| A catalog row (one `catalog.json` type ↔ `ui-*` factory, its tests/example/doc) | `.claude/docs/rubrics/a2ui-catalog.md` (D1–D6) | `naming.ts`/`conformance.ts`/`registry` probes via `npm test` |
| A corpus record (one `CorpusRecord` line) | `.claude/docs/rubrics/a2ui-corpus.md` (D1–D5) | `a2ui-payload.md` (folded), `validateRecord`'s enum, the θ_dup index |
| A compose-time mechanism function (`compose.ts`-class — code that assembles/derives/selects at compose time) | `.claude/docs/rubrics/a2ui-mechanism.md` (M1–M4) | M1: the co-located `*.test.ts` via `npm test` · M2's cited floor: `layering.test.ts` + the biting test (M2 itself is [review], definitional) |
| A skill-doc pattern section (an `a2ui-multi-catalog`-class pattern row) | `.claude/docs/rubrics/a2ui-skill-pattern.md` (S1–S3) | none — S1 is [review], definitional (fixed open-and-diff method against every cited source; no realized script) |

The last two rows are the GH #493 siblings — before them, mechanism functions and pattern sections were
graded against `a2ui-catalog.md` by analogy (PR #492's escalation); never do that again. A persona
fragment's own rows (`catalog/personas/*/`) are catalog rows and take the catalog-row route.

## Ground rules (the judgment layer)

1. **Gates first; cite, do not re-judge (`process.md` rule 1).** For each `[gate]` dimension, run the
   named deterministic probe, read its verdict, and score the dimension *from* that verdict — you do
   not recompute or overrule what the script decides. The `[review]` dimensions are scored ONLY on a
   gate-green artifact: a payload the CLI exits 1 on cannot be graded on composition (SPEC-R6 order).
2. **The `repairs: []` signal.** On the payload gates, the excellence tier (5) turns on the CLI
   returning `repairs: []` — authored-clean, not heal-rescued. A class that passes but leaned on heal
   caps that gate dimension at 3 (`a2ui-payload.md` gate-excellence note).
3. **No cross-dimension compensation.** Apply the named rubric's own gate-to-promote exactly: every
   `[gate]` dimension is a hard pass AND every dimension ≥ 4. A 5 elsewhere cannot lift a sub-4
   dimension. For corpus records the aggregation is a **MIN** across the applicable `[gate]` dims —
   one weak dimension sinks the record.
4. **Adversarial stance.** A green self-audit is the maker's claim, not your verdict — distrust it.
   Hunt the shape that PASSES the gate but is off-idiom (a gate-legal but non-catalog `variant`), the
   `{path}` that resolves syntactically but names nothing in the data model, the `mapsTo` that renders
   inert. A `[gate]` whose evidence you cannot watch bite is capped, and you name the missing evidence.
5. **Evidence to file:line.** Every score traces to the artifact or the probe output; an unproven
   claim caps the score. Findings are severity-classified with a concrete location.
6. **Scope your reads.** Read the ONE artifact, its named rubric, and the evidence the rubric cites
   (the seed shelf `src/examples/`, `src/catalog/default/`, `validateRecord`, the shard) — not the
   whole repo. Return a result-only verdict; do not re-do your read for the next seat.
7. **Ambiguity escalates, it does not average.** If an anchor cannot decide a score (two defensible
   reads more than ±1 apart), report it as a rubric-anchor ambiguity finding and escalate — the fix is
   repairing the anchor at its source, not widening tolerance or silently picking (harness LLD §8).
   Any LLD/rubric contradiction: escalate to the host, do not improvise the standard.

## Per-artifact procedure

- **Payload → `a2ui-payload.md`.** Run
  `node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts <payload.json> --catalog agent-ui`.
  Score P1–P3 from the exit code + codes + the `repairs` array; then, only if it exits 0, judge P4–P8
  (composition · catalog idiom incl. the enum-range check the gate skips · binding hygiene ·
  accessibility intent · declared-scope fidelity — P8, the GH #474 deceptive-composition defense,
  hard-blocks promotion regardless of the other dimensions) against the seed shelf, citing the seed the payload should read like.
- **Catalog row → `a2ui-catalog.md`.** Cite `naming.test.ts`/`conformance.test.ts`/`registry.test.ts`
  for D1–D3 (name conformance · load/payload conformance · factory binding & coverage), then judge
  D4–D6 (mapping fidelity to the real `ui-*` surface · PropDef typing idiom · example/doc coverage)
  against `factories.ts` + `catalog.json` + the row's tests/example/doc.
- **Corpus record → `a2ui-corpus.md`.** D1 folds the payload rubric: run the CLI on the record's
  `a2uiOutput` and take `MIN` across `a2ui-payload.md` P1–P8 (N/A + omitted for an eval-facet record).
  D2–D5 apply each dimension's deterministic floor (non-empty `promptText`/`description`; the
  `target ?? description` ADR-0063 consumer rule — grade the *effective* target, never `target` raw;
  the closed `source` enum + a resolvable `origin`; the θ_dup neighbour), then judge above that floor.
  Then emit the VerdictsFile below.
- **Mechanism function → `a2ui-mechanism.md`.** Run the mechanism's co-located suite via `npm test`
  (exit code, never grep) for M1 [gate] (contract tests incl. anti-vacuous negative controls); score
  M2 ([review], definitional — hard-gated like a gate) by READING the imports/call sites for
  called-not-copied, citing its deterministic floor (layering trip-wire + the biting test) without
  re-judging it; then judge M3–M4 (fail-loud policy fidelity against the cited SPEC/ADR clauses —
  verify each citation at its source · purity + single-sourcing) against the function's `file:line`.
- **Skill pattern section → `a2ui-skill-pattern.md`.** For S1 ([review], definitional — hard-gated
  like a gate) open EVERY cited symbol/clause and diff the claim verbatim (record the claim-by-claim
  result — a fabricated citation is a drift tell), then judge S2–S3 (routing & boundary · worked
  example + policy teaching). Lane note: you grade the section's A2UI substance ONLY — the skill
  document's contract (frontmatter, routing grammar, body shape) is harness `skill-checker`'s lane
  (doc-checker's own charter fences SKILL.md files to it), not yours.

## The VerdictsFile (corpus records only)

When you judge one or more corpus records, ALSO emit ONE verdicts file naming every record judged this
run. It is consumed verbatim by `parseVerdictsFile` (`packages/agent-ui/a2ui/src/corpus/judge.ts:46`)
and `createVerdictJudge` — the shape is a contract, not a suggestion:

```json
{
  "rubric": "a2ui-corpus",
  "rubricVersion": "1.0",
  "judgedBy": "a2ui-reviewer",
  "date": "2026-07-03",
  "verdicts": {
    "<record.name>": { "qualityScore": 4, "passed": true, "failingDimensions": [] }
  }
}
```

- The values above are illustrative. **`rubric`** is exactly `"a2ui-corpus"`; **`rubricVersion`** is the
  value of `a2ui-corpus.md`'s `version:` marker copied verbatim (read it at grade time; if the rubric
  bumps, this follows it, or `parseVerdictsFile` rejects the file). **`judgedBy`** is `"a2ui-reviewer"`;
  **`date`** is the grade date. No other top-level keys — unknown keys are rejected.
- Per record: **`qualityScore`** = the `MIN` across the applicable `[gate]` dims (D1 omitted for
  eval-facet); **`passed`** = `qualityScore ≥ 4` (the SPEC-R8 bar); **`failingDimensions`** lists every
  gated dimension scoring < 4 (omit or `[]` when none fail). No other per-verdict keys.
- The per-dimension scores + file:line findings still go in your findings block — the VerdictsFile is
  the machine-consumed distillation of them, not a replacement.
