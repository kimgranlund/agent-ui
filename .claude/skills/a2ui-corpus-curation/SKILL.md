---
name: a2ui-corpus-curation
description: >-
  Curate the A2UI training corpus when adding an authored exemplar or back-scoring records: author a
  seed (the `src/examples` shape), admit it through the REALIZED store pipeline, and judge/rescore it —
  a thin procedure over the SHIPPED mechanism, never a re-implementation. Use for importing seeds
  (`import-seeds --verdicts`, its archived verdicts file COMMITTED with the shard), back-scoring records
  (`rescore`), resolving an admission HALT (near-duplicate · unjudged candidate · quarantined-name
  collision · a recorded disposition on an unjudged run), or the judged quarantine exit (`--replace`).
  It POINTS at the owning docs (corpus/harness LLDs · ADR-0055/0060–0064/0068/0165), never restating the
  record schema, dedup math, or pipeline internals. NOT for composing an A2UI payload — `a2ui-payload-authoring`;
  NOT for writing pipeline/renderer/validator/catalog code — the `a2ui-build-agent` agent.
disable-model-invocation: false
user-invocable: true
---

# Curating the A2UI corpus

The curator's procedure over the **already-realized** corpus store — sequence the shipped pipeline and
recognize its halts. The store (admission, dedup, canonicalization, retrieval, export) shipped in the
corpus-store wave (`packages/agent-ui/a2ui/src/corpus/*`), and the tier-2 judge activates via the
verdict adapter in the harness wave. This skill is a **procedure pointer, not a re-implementation
surface**: every mechanism below has one owner doc, and the procedure cites it — it never reproduces the
schema, the dedup math, or the pipeline internals.

## The cardinal discipline — cite the pipeline, never restate it

Each mechanism is owned and contract-frozen elsewhere. Point at the owner; reproducing it forks the
contract:

- **Record schema** → `src/corpus/record.ts` + `ADR-0063` (unconditional `description`, `E_NO_TARGET`
  retired) + `ADR-0064` (single-surface v1). Do **not** transcribe the field list into this skill.
- **Admission pipeline** (stages · codes · order) → `.claude/docs/lld/a2ui-corpus-store.lld.md` §6
  and its §8 error table. Name the shape; read §6 for the detail.
- **Dedup / MinHash math** (`θ_dup`, shingles, permutations) → corpus LLD §5. Cite the value, not the code.
- **Judge activation** (verdict adapter · parse logic · rescore · `--replace`) →
  `.claude/docs/lld/a2ui-harness-wiring.lld.md` §7 + `ADR-0068`.
- **Verdict archive** (what a judged run writes · filename · precedence · no-expiry) → `ADR-0165` +
  `packages/agent-ui/a2ui/corpus/verdicts/README.md`. The curator's ONE obligation over it is procedural
  (commit it — step 7); every rule about it is the tool's.
- **Healer contract** (the closed repair list) → `ADR-0061`.

## Procedure — seed → admit → judge → back-score → commit the archive

1. **Author the seed** in the `src/examples/` shape — an `ExampleSeed` (`ADR-0055`;
   `packages/agent-ui/a2ui/src/examples/types.ts`) is package SOURCE and a pre-aligned authored admission
   candidate. Add the module, export it from `src/examples/index.ts` (named export + `allSeeds`), and
   register it in the import script's drift-guarded `SEEDS_BY_MODULE` (`tools/corpus/import-seeds.ts` — a
   half-wired seed HALTS at the drift guard). It never imports corpus code; the seed→`CorpusRecord` mapping
   is the import script's (corpus LLD §3 "Seed pre-alignment").
2. **Import through the single write path** — run the seed-import script (corpus LLD-C14). A seed enters
   `admit()` and runs the corpus LLD §6 pipeline (heal → schema/pin gates → tier-1 `validateA2ui` → … →
   dedup → tier-2 judge → write; §6 owns the full stage list and codes). With a judge wired, pass
   `--verdicts`:

   ```
   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus/import-seeds.ts --verdicts <verdicts.json>
   ```

   That run also **writes**: it archives the verdicts file under
   `packages/agent-ui/a2ui/corpus/verdicts/` — a COMMITTED artifact, not scratch, and step 7 is where it
   lands in the tree. The curator's action is to give each wave's `--verdicts` file a distinct name; the
   archive's own filename, collision, and precedence rules belong to `ADR-0165` cl.1/2 +
   `corpus/verdicts/README.md` (fenced above), never restated here.

3. **Clear the gates** — the standing shard gate (`src/corpus/corpus-data.test.ts`), **amended for
   quarantine per `ADR-0068` cl.6 (the amendment lands with the judge wiring, slice h11)**, backs the
   shard: quarantined lines are legal (parse + `validateRecord`
   + facet for all lines; tier-1/hash legs run for non-quarantined lines only). Run `npm test`; it must be
   green before and after any curation.
4. **Obtain judge verdicts** — the `a2ui-review-agent` agent grades each record against
   `.claude/docs/rubrics/a2ui-corpus.md` and emits ONE verdicts file whose `rubricVersion` equals the
   rubric's `version:` marker (`ADR-0068` cl.1). The adapter (`src/corpus/judge.ts`, `createVerdictJudge`)
   is deterministic plumbing — judgment is authored in the critic seat, never inside `admit()`
   (harness LLD §7; `process.md` rule 1 + SPEC-R8).
5. **Back-score the phase-1 records** — `tools/corpus/rescore.ts` (`ADR-0068` cl.4) applies verdicts only
   to records with absent `qualityScore`: at/above bar → `meta.qualityScore`; below bar →
   `status:"quarantined"` (one-way under rescore). It is all-or-nothing (the whole file validates and every
   update computes before one serialize); an identical re-run is a byte-level no-op.
6. **Exit quarantine only through the judged path** — `import-seeds --replace <name>` (`ADR-0068` cl.5) is
   the sanctioned re-admission of an improved seed through the FULL judged pipeline; it recomputes status
   honestly and logs the prior status + hash. Rescore never un-quarantines.
7. **Commit the archive WITH the shard — one change, one wave.** A judged run's diff is the shard *and*
   `corpus/verdicts/<date>--<slug>.json`; `git status` after the import shows both. This is not tidiness:
   the archived `passed:false` entries ARE the durable `E_QUALITY` record (`ADR-0165` cl.1/3) — the outcome
   `admit()` writes nowhere. Leave it uncommitted and YOUR tree still guards — `loadVerdictArchive` walks the
   filesystem, not git, so an untracked-but-present archive fires cl.4 locally and the warning will look
   wrong if you test it here. The exposure is **every other checkout** — CI, a fresh clone, the next agent's
   worktree — where the archive does not exist and a later unjudged run naming that seed re-admits it
   silently, exactly as before the archive existed. A wave that admitted NOTHING still has an archive to
   commit — zero admissions is not zero record.
   **Then drop the refused seed.** A refusal's expected disposition is that the seed leaves `src/examples/`
   entirely — module, `index.ts` export + family array, `SEEDS_BY_MODULE` row (`ADR-0165` REV 2026-07-30, GH
   #361 reading (b); the `retreat-reschedule` precedent). It needs no `DISPOSITION_ALLOWLIST` entry because
   it is no longer a candidate any coverage leg iterates; the archive re-arms cl.4's halt if it is ever
   re-added. Keep it on the shelf instead (a repair pending) and it DOES owe an allowlist entry, or the
   coverage gate reds.

## The halts — recognize, then resolve at the owner (corpus/harness LLD §8; `ADR-0165` cl.2/4)

A halt is a **stop-and-resolve**, never a bypass. The pipeline fails closed; act on the cause:

1. **θ_dup near-duplicate between two DISTINCT seeds** — two independently-authored seeds collide at/above
   `θ_dup`. Import reports and HALTS for a human ruling (corpus LLD §5/§8); never a silent skip or merge.
   Resolve by differentiating or dropping one seed — not by lowering `θ_dup`.
2. **Unjudged candidate under a wired judge** — a candidate absent from the verdicts file makes
   `createVerdictJudge().score()` THROW the unjudged-candidate error; `import-seeds --verdicts` reports and
   HALTS (`ADR-0068` cl.2). It never silently admits an unjudged record into a judged-era corpus. Resolve
   by grading the missing candidate — not by skipping it.
3. **Quarantined-name collision at import** — a candidate that clears dedup whose `name` matches a stored
   QUARANTINED record HALTS with nothing written (`ADR-0068` cl.5); identical content instead hits `E_DUP`
   (warming enumerates quarantined records). Resolve through the sanctioned `--replace <name>` re-admission
   — a routine import may never overwrite a quarantined line.
4. **A recorded disposition on an unjudged run** — a plain run whose candidate was never admitted
   but carries an archived `passed:false` verdict (or a `DISPOSITION_ALLOWLIST` entry) HALTS with
   nothing written (`ADR-0165` cl.4/5 own the guard order + the stored-name early-return). Resolve by
   re-running with `--verdicts` so the name is judged FRESH; never delete the archived file — it IS the
   record.

## Validation loop — the pipeline is the check

Finalize only when the pipeline runs clean end-to-end:

1. `import-seeds` **exits clean** — a HALT (any of those above) is resolved at its owner and the import
   re-run, never worked around.
2. `npm test` is green — the amended standing gate accepts the shard (including any new quarantine legs).
   Its coverage leg reds on an **unjudged admission** (`ADR-0165` cl.5) — the shape a missing archive
   eventually produces, never the archive's own absence: after a judged wave every admitted record carries
   `meta.qualityScore` (`ADR-0068` cl.3), so this leg is GREEN with the archive missing and only reds once a
   later unjudged run has already re-admitted the refused seed. The archive's absence is caught by item 4
   below, not by any gate. And a refused seed is expected to leave the shelf (`ADR-0165` REV 2026-07-30,
   step 7), so no coverage leg iterates it at all.
3. A back-score's shard diff touches only `qualityScore` / `status`; a second identical run is a no-op.
4. The judged run's diff carries the archive — no untracked `corpus/verdicts/*.json` is left behind.

Never edit a gate or the pipeline code to make a halt disappear — that is `a2ui-build-agent`'s surface and a
contract change, not curation. Re-run after every resolution.

## Hand-back — the stopping predicate

Done when: the judged run committed BOTH the store diff AND its `corpus/verdicts/<date>--<slug>.json`
archive (no untracked verdicts file left behind), the coverage gate is green, and the report names
each candidate's outcome — admitted · `E_DUP` · a HALT resolved-and-re-run, or a HALT handed back to
the owner. A halt left unresolved is a blocker reported, never a bypassed gate.

## Do NOT restate (fences)

Cite these; reproducing them here forks the frozen contract and rots on the next change:

- the **record schema** — `src/corpus/record.ts`, `ADR-0063`/`ADR-0064`;
- the **dedup MinHash math** — corpus LLD §5;
- the **judge parse logic** — `src/corpus/judge.ts`, `ADR-0068` cl.2;
- the **heal repair list** — `ADR-0061`.

## References & tools

| Path | Use when |
|---|---|
| `.claude/docs/lld/a2ui-corpus-store.lld.md` §6/§8 | The admission pipeline stages, codes, and order — the authority this procedure sequences |
| `.claude/docs/lld/a2ui-harness-wiring.lld.md` §7 | The judge activation — verdict adapter, rescore, `--verdicts`/`--replace`, the halt table |
| `ADR-0055` | The seed shelf (`src/examples/` shape) an authored candidate is written in |
| `ADR-0060` … `ADR-0064` | The corpus store: injected judge seam · shared healer · packaging · record schema |
| `ADR-0068` | The verdict adapter, back-score/quarantine semantics, and the standing-gate amendment |
| `ADR-0165` + `packages/agent-ui/a2ui/corpus/verdicts/README.md` | The verdict archive — the committed record a judged run writes, its filename/precedence/no-expiry rules, and the unjudged-run guard that reads it |
| `.claude/docs/rubrics/a2ui-corpus.md` | The standard the `a2ui-review-agent` critic judges verdicts against |
| `[[a2ui-payload-authoring]]` | The task is composing an A2UI PAYLOAD from the catalog, not curating the corpus |
