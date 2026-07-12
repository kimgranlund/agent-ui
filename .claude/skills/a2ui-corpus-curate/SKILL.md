---
name: a2ui-corpus-curate
description: >-
  Curate the A2UI training corpus when adding an authored exemplar or back-scoring records: author a
  seed (the `src/examples` shape), admit it through the REALIZED store pipeline, and judge/rescore it —
  a thin procedure over the SHIPPED mechanism, never a re-implementation of it. Use for importing seeds
  (`import-seeds --verdicts`), back-scoring phase-1 records (`rescore`), resolving an admission HALT
  (near-duplicate between distinct seeds · unjudged candidate under a wired judge · quarantined-name
  collision), or the judged quarantine exit (`--replace`). It POINTS at the owning docs (corpus LLD §6 ·
  harness LLD §7 · ADR-0055/0060–0064/0068); it never restates the record schema (`record.ts` owns it),
  the dedup math, or the pipeline internals. NOT for composing an A2UI payload from the catalog — that is
  `a2ui-compose`; NOT for writing the pipeline / renderer / validator / catalog code — that is the
  `a2ui-builder` agent. This skill only DRIVES the realized pipeline, as a curator.
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
- **Healer contract** (the closed repair list) → `ADR-0061`.

## Procedure — seed → admit → judge → back-score

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

3. **Clear the gates** — the standing shard gate (`src/corpus/corpus-data.test.ts`), **amended for
   quarantine per `ADR-0068` cl.6 (the amendment lands with the judge wiring, slice h11)**, backs the
   shard: quarantined lines are legal (parse + `validateRecord`
   + facet for all lines; tier-1/hash legs run for non-quarantined lines only). Run `npm test`; it must be
   green before and after any curation.
4. **Obtain judge verdicts** — the `a2ui-reviewer` agent grades each record against
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

## The three halts — recognize, then resolve at the owner (corpus/harness LLD §8)

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

## Validation loop — the pipeline is the check

Finalize only when the pipeline runs clean end-to-end:

1. `import-seeds` **exits clean** — a HALT (any of the three above) is resolved at its owner and the import
   re-run, never worked around.
2. `npm test` is green — the amended standing gate accepts the shard (including any new quarantine legs).
3. A back-score's shard diff touches only `qualityScore` / `status`; a second identical run is a no-op.

Never edit a gate or the pipeline code to make a halt disappear — that is `a2ui-builder`'s surface and a
contract change, not curation. Re-run after every resolution.

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
| `.claude/docs/rubrics/a2ui-corpus.md` | The standard the `a2ui-reviewer` critic judges verdicts against |
| `[[a2ui-compose]]` | The task is composing an A2UI PAYLOAD from the catalog, not curating the corpus |
