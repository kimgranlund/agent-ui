# ADR-0068 — the corpus-quality judge is a deterministic verdict-adapter over critic-authored verdicts: `createVerdictJudge` fails closed on unjudged candidates; back-scoring quarantines below-bar records; the standing gate and the import path learn quarantine in the same change

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the expert-harness intake, NEXT item 1) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green gate |
> | **Repairs** | `a2ui-expert-harness.spec.md` §5.3 (the verdicts contract — edited this change) · `a2ui-harness-wiring.lld.md` §7 LLD-C8 (edited this change) · `a2ui-corpus-store.lld.md` §0/§1/§11 (the LLD-C12 split: judge half activates this wave, Inspect-AI scoring/lift stays deferred — v0.5.1 note, edited this change) · `src/corpus/corpus-data.test.ts` (the never-quarantined assertion + its over-broad invariant-ii cite — clause 6; build slice h11, gated on ratification) · `src/corpus/store.ts` (the `includeQuarantined` filter flag — clause 5; h11) · `src/corpus/judge.ts` + `tools/corpus/rescore.ts` + `import-seeds --verdicts`/`--replace` + the corpus barrel (h11/h12, gated on ratification) |
> | **Supersedes / Superseded by** | Relates ADR-0060 (the injected seam this activates — its named trigger IS this wave) · ADR-0063 (the `target ?? description` consumer rule the rubric's target-clarity dimension reads) · corpus SPEC-R8/R13 (the bar + the quarantine semantics) |

## Context

ADR-0060 shipped admission with an injected tier-2 seam — `admit(candidate, { …, judge?: Judge })`,
`Judge.score(record) → { qualityScore, passed, failingDimensions? }` (`admit.ts:39-62`) — and named the
harness's corpus-quality rubric as the activation trigger. The rubric is a DOCUMENT
(`.claude/docs/rubrics/a2ui-corpus.md`) whose scoring is judgment; but `admit()` is pure pipeline code
that runs Node-side under the import tools, where no Claude seat can be dispatched mid-call. Wiring
"judgment" directly into the pipeline would either fake it (a heuristic scorer pretending to be
judgment — exactly what `process.md` rule 1 bans scripts from impersonating) or block admission on an
interactive session. Meanwhile 11 phase-1 records sit honestly unjudged (absent `qualityScore`,
ADR-0060's queryable marker) and corpus SPEC-R8 AC2 (`E_QUALITY` with failing dimensions) has never
been falsifiable against a real rubric.

Introducing `status:"quarantined"` into the shard collides with two realized surfaces the design must
repair in the same change, not step around: (1) **the standing gate forbids it** —
`corpus-data.test.ts:45` asserts `expect(rec.meta.status).not.toBe('quarantined')` for every shard
line, citing "LLD §2 invariant ii", which is actually FACET-only (a shard file carries one facet);
the gate over-asserts relative to its cite, and a below-bar back-score would turn it red. (2) **the
import path would erase a quarantined record through routine use** — `warmDedupIndex`
(`import-seeds.ts:104`) iterates `store.all()`, which SKIPS quarantined records (`store.ts:116`), and
`store.put()` upserts by name (`store.ts:126`): a plain re-run after a quarantine finds no `E_DUP`,
re-admits the seed unjudged-content-identical, and silently overwrites the quarantined line. Two
further semantics are unowned: what happens to an already-STORED record that scores below bar at
back-scoring, and what a wired judge does with a candidate nobody graded.

## Decision

We will activate the seam with a strict split — **judgment in a critic seat, plumbing in code** — and
make quarantine survivable end-to-end:

1. **The critic authors verdicts.** The `a2ui-reviewer` agent grades each record against
   `a2ui-corpus.md` (which defines the aggregation: `qualityScore` = MIN across `[gate]`-typed
   dimensions on the 1–5 scale; `passed` = `qualityScore ≥ 4` — the SPEC-R8 bar) and emits ONE
   verdicts file: `{ rubric: 'a2ui-corpus', rubricVersion, judgedBy, date,
   verdicts: Record<record.name, JudgeVerdict> }`. `rubricVersion` MUST equal the explicit `version:`
   marker the rubric document carries — a verdict is meaningless without the standard it scored against.
2. **The adapter is deterministic.** `src/corpus/judge.ts` (pure core, joins the `"./corpus"` barrel):
   `parseVerdictsFile(text, expectedRubricVersion)` validates the shape with structured errors — the
   CALLER supplies the expected version (the Node shell reads the rubric doc's `version:` marker; the
   pure core never touches the filesystem, ADR-0062); `createVerdictJudge(file)`
   returns a `Judge` whose `score()` is a name lookup. **A candidate ABSENT from the file makes
   `score()` THROW** the named unjudged-candidate error — with a judge wired, every candidate must be
   judged; the import tool surfaces the throw as report + halt (the θ_dup escalation precedent), never
   a silent unjudged admit into a judged-era corpus.
3. **Admission activates via the existing seam only.** `tools/corpus/import-seeds.ts` gains
   `--verdicts <path>`, passing `createVerdictJudge(...)` as `deps.judge`. Stage order is unchanged
   (corpus LLD §6): the judge runs last before write; below-bar candidates reject `E_QUALITY` with
   `failingDimensions` (SPEC-R8 AC2, falsifiable at last).
4. **Back-scoring rides repair-loop semantics, all-or-nothing, one-way.** `tools/corpus/rescore.ts`
   (Node shell — the only writer of the data dir, per ADR-0062) applies verdicts ONLY to records with
   absent `qualityScore`: at/above bar → write `meta.qualityScore`; below bar →
   `status:"quarantined"` (corpus SPEC-R13's state — excluded from consumption by `all()`, kept in the
   shard for audit). Edge semantics: the WHOLE verdicts file is validated and every update computed
   BEFORE one serialize (all-or-nothing — no partial shard write); a verdict naming a record not in
   the store → report + halt; a verdict naming an already-judged record with a DIFFERENT verdict →
   report + halt (a re-judge is the deliberate clause-5 path, never a drive-by overwrite); an
   identical verdict → no-op (idempotence — a second identical run is a byte-level no-op). Records
   NOT named in the verdicts file are untouched and reported still-unjudged (rescore is deliberately
   partial; only admission fails closed on the unjudged).
   **Rescore never un-quarantines**: `quarantined` is one-way under rescore.
5. **Quarantine survives the import path (two guards + one sanctioned exit).** (a) Dedup warming
   enumerates quarantined records too: `store.all()` gains an `includeQuarantined?: boolean` filter
   flag (default false — every existing caller keeps consumption semantics; the flag is the storage-
   integrity read), and `warmDedupIndex` passes it — a re-imported identical seed hits `E_DUP` against
   the quarantined line instead of re-admitting. (b) `import-seeds` HALTS (report, nothing written) on
   any candidate that clears dedup whose `name` matches a stored QUARANTINED record (`store.get()`
   sees all statuses) — routine imports can never overwrite a quarantined line. (c) The sanctioned
   exit is **`import-seeds --replace <name>`**: a deliberate re-admission of the (typically improved)
   seed through the FULL pipeline — judge required — which replaces the quarantined record, logging
   the prior status + `canonicalHash` in the run report; `status` is recomputed honestly by admission
   (`valid`/`repaired` from heal). Because an improved seed is near-identical to its predecessor BY
   CONSTRUCTION and warming now includes quarantined signatures, `--replace` omits the replaced
   record's exact+near dedup signatures from warming for that run — otherwise it would `E_DUP`
   against the very record it replaces. The shard is git-committed, so the replaced line also
   survives in history; the run report + git are the audit trail.
6. **The standing gate learns quarantine in the same change** (build slice h11, BEFORE any back-score
   run): `corpus-data.test.ts` — quarantined lines are LEGAL in the shard; every line still parses and
   passes `validateRecord`; the facet assertion holds for ALL lines; the tier-1 + hash-recomputation
   legs run for NON-quarantined lines only (a quarantined record may legitimately no longer validate
   against the current catalog — that is what quarantine records, SPEC-R13); the invariant cite is
   corrected (LLD §2 invariant ii is facet-only; the consumption exclusion belongs to `all()`, and
   this ADR is the citation for the gate's quarantine legs).
7. **Corpus LLD-C12 splits.** Its judge half is THIS activation; its Inspect-AI scoring/lift half
   (SPEC-R14/R15/R16) stays deferred with corpus LLD-C8 (trigger: the first eval record) — and that
   wave must first have the host verify upstream `eval/a2ui_eval/scorers.py` + `dataset.py`
   (unverified C1 facts; the repo-absence ≠ spec-absence discipline).

## Consequences

- **Judgment stays gradeable and separable** — the verdicts file is an auditable artifact naming its
  rubric version and judge; the pipeline stays deterministic and testable with fake verdicts (the
  ADR-0060 seam tests carry over unchanged).
- **The phase-1 debt clears mechanically**: after the back-score run the "absent `qualityScore`"
  count goes 11 → 0 (or the quarantine delta is itemized in the run report) — the ADR-0060 marker
  did its job and retires from active duty.
- **Quarantine, not deletion, for below-bar stored records — and now it actually holds**: the
  audit trail survives through the clause-5 guards (warming sees quarantined; name-collision halts;
  replacement is explicit, judged, and logged) plus git history of the committed shard — not through
  an unenforced "never deleted" promise. Cost: a quarantined record still occupies its `name`; the
  only way past it is the explicit `--replace` re-admission.
- **The standing gate gets STRONGER, not weaker** (clause 6): it stops over-asserting beyond its
  cite, keeps every current assertion for consumable records, and gains explicit quarantine legs —
  a hand-edited `status` flip is still caught by `validateRecord`'s enum.
- **The throw-on-unjudged rule makes partial verdicts loud** — importing 5 candidates with 4 verdicts
  halts; the fix is grading the 5th, not skipping it. Same posture at rescore: unknown names and
  conflicting re-verdicts halt.
- **Asymmetry: admission rejects (`E_QUALITY`), back-scoring quarantines, replacement re-admits** —
  a candidate can be refused entry; a stored record is never erased by a grade; leaving quarantine
  is a deliberate, judged, logged act. All three outcomes are queryable.
- **Stale → re-verify on the build gate:** corpus LLD §6's judge-stage note (now "adapter-filled") ·
  `corpus-data.test.ts`'s invariant-ii comment + quarantine legs · `import-seeds.ts` usage text
  (`--verdicts`/`--replace` + the quarantined-name halt) · the seed shard's post-rescore lines ·
  the h12 run report.

## Acceptance

- `parseVerdictsFile(text, expectedRubricVersion)` rejects malformed input (missing `rubric`,
  `rubricVersion` ≠ the caller-supplied expected version, non-numeric score, unknown keys) with
  structured errors; a valid file round-trips.
- `admit` with `createVerdictJudge`: a below-bar candidate rejects `E_QUALITY` listing
  `failingDimensions`; an at/above-bar candidate admits with `meta.qualityScore` set; a candidate
  absent from the file throws the unjudged-candidate error and `import-seeds --verdicts` reports+halts.
- `rescore` on the 11-record shard: every record ends with `qualityScore` or `quarantined`; the
  AMENDED `corpus-data.test.ts` is green; the shard diff touches only `qualityScore`/`status` fields;
  a second identical run is a byte-level no-op; an unknown name and a conflicting re-verdict each
  halt with nothing written (all-or-nothing proven by a planted mid-file failure); a record not
  named in the file is untouched and reported still-unjudged.
- The amended standing gate: a planted quarantined line passes the gate (parse + `validateRecord` +
  facet) while its tier-1/hash legs are skipped; a planted quarantined line with a schema defect
  still fails; the old never-quarantined assertion is gone and the invariant-ii cite corrected.
- Import-path guards: with a quarantined record in the store, (a) re-importing the identical seed
  yields `E_DUP` (warming saw it), (b) importing a same-name different-content candidate HALTS with
  nothing written, (c) `--replace <name>` with a NEAR-IDENTICAL improved variant of the quarantined
  seed (the fixture MUST be near-identical — the self-collision case, not a dissimilar payload)
  admits it through the full judged pipeline (its predecessor's signatures omitted from warming for
  that run) and the run report logs the prior status + hash.
- The corpus barrel exports the adapter; the purity greps (zero `node:*`/third-party under
  `src/corpus/`) stay green.

## Alternatives considered

- **A heuristic scorer inside `admit()` (length/complexity/lint proxies as "quality")** — rejected:
  scripts impersonating judgment is the exact placement violation `process.md` rule 1 exists to ban;
  a proxy bar would grade formatting, not intent, and silently redefine SPEC-R8.
- **An LLM API call inside the pipeline** — rejected: adds a dependency + a secret to a zero-dep pure
  core, makes admission non-deterministic and unrunnable offline/CI, and the repo's judgment idiom is
  seats, not API calls.
- **Skip-on-absent-verdict instead of throw** — rejected: silently mixes judged and unjudged records
  in one run; the absent-`qualityScore` marker would no longer mean "phase-1 era" but "maybe someone
  forgot", destroying its query value.
- **Back-score below-bar → reject/delete the stored record** — rejected: deletion erases the audit
  trail and the dedup identity; corpus SPEC-R13 already defines the honest state (`quarantined`,
  excluded from consumption).
- **Move quarantined records to a side file so the standing gate stays untouched** — rejected: forks
  the storage model (two homes for one shard's records), breaks `name`-uniqueness enforcement and
  dedup warming in one move, and hides the quarantine state from the very gate that should see it.
- **Let rescore un-quarantine on an above-bar re-verdict** — rejected: the stored record cannot
  honestly recover `valid` vs `repaired` (heal's `changed` fact lives at admission time; re-healing
  an already-healed form is always `changed:false`), so rescore would have to guess; the `--replace`
  re-admission recomputes it truthfully through the single write path.
- **Have the composer or the pipeline self-compute `passed` from dimension scores it invents** —
  rejected: generator = critic (SPEC-R8); the bar's aggregation belongs to the rubric document, the
  scoring to a separate critic seat.
