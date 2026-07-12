---
doc-type: ticket
id: tkt-0022
status: done
date: 2026-07-11
owner:
kind: feature
size: small
---
# TKT-0022 — the corpus-admission drain: exemplar seeds enter the judged corpus store

## Summary
Kim's goal directive (2026-07-11): close the standing corpus-admission gap (recorded at the
token-surfaces M2 wave, carried across ~6 waves since). The example seeds under
`packages/agent-ui/a2ui/src/examples/` (catalog-coverage.ts, message-lifecycle.ts,
generative-form.ts, dynamic-lists.ts, patterns.ts, canvas-button.ts) render on the site gallery
and pass validator gates, but were never ADMITTED through the corpus pipeline — the retrieval
corpus (`corpus-data`) doesn't contain them, so retrieval-conditioned generation can't imitate
exactly the worked shapes the waves built to teach (the kpi-panel lifecycle arc, the
color-picker-form fence, etc.). The machinery all exists: `tools/corpus/import-seeds.ts`,
`src/corpus/{admit,judge,dedup,canonical}.ts`, the ADR-0068 VerdictsFile seam (judge = the
`a2ui-reviewer` seat emitting verdicts against `.claude/docs/rubrics/a2ui-corpus.md`), and the
never-admit-unjudged throw (judge.ts:138).

## Acceptance
- Every current example seed is either ADMITTED to the corpus store (imported → judged via the
  ADR-0068 verdicts flow → passing the gate-to-promote rule) or explicitly DISPOSITIONED with a
  recorded reason (e.g. a deliberately-minimal smoke seed that would teach nothing — the
  disposition list lives where the corpus docs expect it, not in a chat log).
- The judging is REAL generator≠critic: `a2ui-reviewer` scores each candidate record against the
  corpus rubric and emits the VerdictsFile; the import applies it; no self-scored admissions.
- The gap itself gets a TRIP-WIRE so it cannot silently reopen: a gate asserting every
  examples/ seed is either present-in-corpus or on the recorded disposition list (the
  fleet-derived-gate precedent — a future wave adding a seed without dispositioning it goes red).
- Corpus invariants hold: dedup, canonical form, single-surface discipline where the rubric
  demands it; `corpus-data` regenerated through the sanctioned tool (never hand-edited);
  retrieve tests green.
- The derived system prompt / retrieval behavior re-validated per the ADR-0087 consequence
  pattern if admission changes what retrieval returns (run the round-trip/prompt gates).

## Links
- `packages/agent-ui/a2ui/src/examples/` (the candidates) · `src/corpus/` + `tools/corpus/`
  (the pipeline) · `.claude/docs/rubrics/a2ui-corpus.md` (the rubric) · ADR-0068 (VerdictsFile) ·
  ADR-0064 (single-surface) · the a2ui-corpus-curate skill (`.claude/skills/a2ui-corpus-curate/`).

## Scope / Open
- Which seeds are corpus-worthy vs smoke-only — the curate pass decides per the rubric, recorded.
- **Non-goals:** new seeds; rubric changes; retrieval-algorithm changes.

## Findings

**2026-07-11 — inventory + root cause.** `src/examples/index.ts`'s `allSeeds` carries 22 seeds; the
committed shard (`corpus/exemplar/v1_0/agent-ui.jsonl`) carries 11, all `status:"valid"`,
`qualityScore:4` (canvas-button, list-display/people/form/nested, generative-form,
pattern-settings-form/confirmation-card/wizard/dashboard-tiles/schedule-picker). The gap is exactly the
10 `catalogCoverageSeeds` (booking-reservation, rental-filter-panel, document-row-toolbar,
stats-grid-dashboard, report-card-dashboard, ops-report, deployment-report, agent-task-status,
brand-palette, color-picker-form) + the 1 `messageLifecycleSeeds` (kpi-panel-lifecycle). Root cause:
`tools/corpus/import-seeds.ts`'s `SEEDS_BY_MODULE` was never updated when `catalog-coverage.ts` /
`message-lifecycle.ts` were added to the shelf — running the script HALTS immediately at the
`checkGrouping()` drift guard (11 grouped vs 22 on the shelf), confirmed by an actual run before any fix.

**2026-07-11 — dedup dry-run (read-only, no shard write).** Wrote a throwaway script
(`/private/tmp/.../scratchpad/dry-run-corpus.ts`, never committed) that loads the REAL store read-only
via `fs-store.ts#loadStore`, warms the dedup index from it, then runs the real `admit()` for all 11
candidates in sequence with NO `deps.judge` (tier-2 is simply skipped per `admit.ts` stage 10 — legal,
`qualityScore` stays unset) and never calls `saveStore` — nothing on disk changed. Result: **all 11
candidates clear every mechanical stage** (schema/pin, tier-1 `validateA2ui`, pointer resolution, leak
gate, canonicalize+hash, dedup) with zero `E_DUP` — no exact or near (θ_dup=0.9) collision against any of
the 11 already-admitted records OR against each other in-batch. Only stage 10 (the judge) remains.

**2026-07-11 — wiring fix.** Added the two missing groups to `import-seeds.ts`'s `SEEDS_BY_MODULE`
(`catalog-coverage.ts`'s 10 seeds + `message-lifecycle.ts`'s 1) — registering already-authored seeds per
the `a2ui-corpus-curate` skill's documented procedure step 1, not a new seed/rubric/algorithm change
(the ticket's non-goals). `npm run check` green (incl. `check:tools`, which type-checks this file).

**2026-07-11 — trip-wire built.** New `src/corpus/admission-coverage.test.ts`: every `allSeeds` name
must be present-by-name in the real corpus shard(s) OR on a `DISPOSITION_ALLOWLIST` (currently empty —
every current seed triaged corpus-worthy, none disposition-only), mirroring the `EXCLUSION_ALLOWLIST`
comment-with-citation precedent (`catalog/default/index.test.ts`) plus its residue guard and synthetic
negative controls. `npx vitest run packages/agent-ui/a2ui`: **980 passed, 1 failed** — the ONE failure is
this new gate's coverage assertion, correctly RED for the 11 not-yet-admitted candidates (proving the
gate bites); every other suite, including `examples.test.ts` and `corpus-data.test.ts`, is unaffected.
Expected to go green once the verdicts land and step 5's import runs.

**2026-07-11 — STOP at step 3, reported to host** with the triage table, dedup findings, and the exact
post-verdict command lines (see team-lead message / task thread). Awaiting `a2ui-reviewer` verdicts
before proceeding to import + gate re-run.

**2026-07-11 — step 5 import HALTED — a pre-existing, unrelated drift found, NOT worked around.**
Verdicts arrived (10 PROMOTE, 1 REJECT — `stats-grid-dashboard`, D5, see host message). Running
`import-seeds --verdicts` HALTED before writing anything (`git status`/`git diff --stat` on
`packages/agent-ui/a2ui/corpus/` confirm zero changes): `"no verdict for record \"generative-form\""`.
Root cause, confirmed read-only (a throwaway diff script, never committed, no writes): the COMMITTED
`generative-form` record and the CURRENT `src/examples/generative-form.ts` source have genuinely
DIFFERENT content — not a key-order artifact (verified by deep-sorting both before diffing). The current
seed's second `updateComponents` message has an extra `form_col` (`Column`, `gap:"md"`) wrapping the
field list; the committed record lacks it. The seed file's own code comment dates this: "Without it the
fields render crashed together (gallery bug, 2026-07-08)" — i.e. the seed source was fixed after the
corpus was originally seeded, and the corpus was never re-imported to pick up the fix. This is why it
falls through dedup (`jaccard≈0.625`, θ=0.9 — too different to catch as a near-dup) and reaches the
judge stage unjudged. This is the skill's documented halt #2 ("unjudged candidate under a wired judge") —
its sanctioned resolution is "grade the missing candidate," but `generative-form` is OUTSIDE this
ticket's 11 named candidates, so I am not self-authorizing that verdict. Also worth flagging as a
separate, latent pipeline observation (not fixed, not this ticket): because `store.put()` upserts by
name with no guard beyond dedup, a routine (non-`--replace`) import of a same-named candidate that
merely escapes near-dup detection would silently REVISE an already-`valid` record's content — there is
no quarantine-style halt for that case today, only for a QUARANTINED existing record. Escalated to host;
nothing written, no scope expansion taken unilaterally.

**2026-07-11 — host ruled path 1 (grow the verdicts file to 12).** `generative-form`'s current content
scored `qualityScore:4, passed:true` (a genuine refresh — the stored exemplar predates the 2026-07-08
layout fix). Re-ran the import with the 12-entry file. Result: **HALTED again, nothing written** —
`import-seeds: 1 seed(s) failed admission for a non-duplicate reason: - stats-grid-dashboard: E_QUALITY —
below the corpus-quality rubric bar. Nothing was written.` Confirmed via `git status`/`git diff --stat`
on `packages/agent-ui/a2ui/corpus/`: zero changes, even for the 11 seeds that verdicted PASS.

Root cause: `import-seeds.ts`'s batch-error branch (`if (report.errors.length > 0) { ...; process.exit(1) }`)
treats EVERY non-duplicate rejection code — `E_SCHEMA`/`E_CATALOG`/`E_IDGRAPH`/`E_POINTER`/`E_PIN`/`E_LEAK`
AND `E_QUALITY` alike — as an all-or-nothing abort: it collects every result before writing anything, so
one legitimately-REJECTED candidate blocks every PASSING one in the same run. This is arguably correct
for the schema/catalog/id-graph codes (a real defect worth stopping the batch to investigate), but
`E_QUALITY` is different: the rubric doc itself describes a below-bar score as a NORMAL, anticipated
admission outcome ("Below-bar on admission → reject `E_QUALITY`"), the same way `E_DUP` already gets its
own non-aborting `alreadyPresent` handling — yet `E_QUALITY` has no equivalent per-candidate-skip path.
This is a pipeline-contract gap, not something to patch silently (it changes system-wide E_QUALITY
handling under ADR-0060/0068) — escalated to host rather than fixed unilaterally.

**2026-07-11 — host authorized the E_QUALITY fix (option 1). Built, tested, shipped.** New
`src/corpus/import-report.ts` (pure, zero-fs): `classifyRejections`/`shouldAbort` split a batch's
collected non-`E_DUP` rejections into `qualityRejected` (E_QUALITY — reported, never written, does NOT
abort) and `hardErrors` (every other code — reported, aborts the whole run exactly as before). New
co-located `import-report.test.ts` (5 tests): the pure classification in isolation (quality-only batch →
no abort; mixed quality+hard-error → still aborts; empty batch → no abort) PLUS two integration-style
legs driving the REAL `admit()` pipeline in-memory (`createStore([])`, no fs, a fake `Judge`) proving what
actually lands in the store — a pass+E_QUALITY batch writes the passer and excludes the reject
(`shouldAbort` false); a pass+E_SCHEMA batch reports `shouldAbort` true (the negative control — the CLI's
`if (!abort) saveStore(...)` gate would never fire). `import-seeds.ts` rewired to use both functions:
the hard-abort branch now lists only `hardErrors`; the success path always calls `saveStore()` when no
hard errors exist and prints three distinctly-countable lanes (admitted / already-present / quality-
rejected, each with names+messages). Header comment cites the rubric's own "Below-bar on admission →
reject E_QUALITY" framing as the authority (ADR-0060/0068 territory; no ADR edited).

**2026-07-11 — re-ran the import. Actual per-record output:**
```
import-seeds: 11 admitted, 10 already present (E_DUP, idempotent), 1 quality-rejected (E_QUALITY, not written).
  admitted: generative-form, booking-reservation, rental-filter-panel, document-row-toolbar, report-card-dashboard, ops-report, deployment-report, agent-task-status, brand-palette, color-picker-form, kpi-panel-lifecycle
  already present: canvas-button, list-display, list-people, list-form, list-nested, pattern-settings-form, pattern-confirmation-card, pattern-wizard, pattern-dashboard-tiles, pattern-schedule-picker
  quality-rejected: "stats-grid-dashboard" — below the corpus-quality rubric bar [failing: D5]
```
Exactly the expected outcome. The shard now holds 21 records (`corpus/exemplar/v1_0/agent-ui.jsonl` +
`index.json`, both regenerated through the tool, never hand-edited), all `status:"valid"`,
`qualityScore:4`. `stats-grid-dashboard` was never written.

**2026-07-11 — the `stats-grid-dashboard` disposition entry landed** in
`src/corpus/admission-coverage.test.ts`'s `DISPOSITION_ALLOWLIST`, citing the judged E_QUALITY verdict
(D5=3, strict-subset duplicate of `pattern-dashboard-tiles`, container-swap-only), noting Grid coverage
survives via `kpi-panel-lifecycle`, and recording the repair path (differentiate the tile or teach a
Grid-specific behavior Row can't express, then re-admit via a fresh judged import — never `--replace`,
since this record was never written).

**2026-07-11 — final gates, all green.** `npm run check` clean (tsc + check:site + check:tools).
`npx vitest run packages/agent-ui/a2ui`: **55 test files, 1006 tests, all passing** — the trip-wire
(`admission-coverage.test.ts`) flipped GREEN (every `allSeeds` name now present-by-name in the corpus OR
on the disposition allowlist). The ADR-0087 re-validate consequence (admission changes what retrieval
returns): `corpus/retrieve.test.ts`, `live-agent/round-trip.test.ts`,
`live-agent/system-prompt-grammar.test.ts`, `live-agent/prompt-drift.test.ts`,
`live-agent/structural-transcript.test.ts` re-run explicitly — **5 files, 83 tests, all passing**.
(One transient gate failure mid-session traced to an untracked, unrelated scratch file
`_tkt0023-scratch.test.ts` from a concurrent, different ticket in this shared working tree — not created
or touched by this ticket's work; its own owner removed it independently before the final gate run above.)

**Summary — acceptance closed:** all 22 example-shelf seeds are now either ADMITTED (21) or explicitly
DISPOSITIONED with a recorded reason (1, `stats-grid-dashboard`). Judging was real generator≠critic
throughout (`a2ui-reviewer` verdicts, never self-scored). The trip-wire gate is live and green. Corpus
invariants hold (dedup/canonical/single-surface unaffected; `corpus-data` regenerated only through
`import-seeds.ts`). Retrieval/round-trip/prompt gates re-validated. Files touched this ticket:
`packages/agent-ui/a2ui/tools/corpus/import-seeds.ts`, `packages/agent-ui/a2ui/src/corpus/{import-report.ts,
import-report.test.ts, admission-coverage.test.ts}`, `packages/agent-ui/a2ui/corpus/{exemplar/v1_0/
agent-ui.jsonl, index.json}` (regenerated via the tool). No commits made — host commits.
