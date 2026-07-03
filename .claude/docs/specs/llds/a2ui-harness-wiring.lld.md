# LLD — A2UI Expert Harness Wiring

> Status: proposed · v0.2 · 2026-07-03 (v0.1 2026-06-26) · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-expert-harness.spec.md`](../specs/a2ui-expert-harness.spec.md) (SPEC-R1..R8, SPEC-N1..N4) at **v0.2**.
> **v0.2 reconciliation (2026-07-03):** the v0.1 wiring predated the corpus store; §0 rules every
> v0.1 component against the realized tree. Headlines: LLD-C4's gate scripts are **REALIZED
> elsewhere** (the shared validator + admission + the standing shard gate — the planned
> `tools/gates/` dir is obsolete); LLD-C2 shrinks three makers to the `a2ui-composer`/`a2ui-reviewer`
> pair (ADR-0067); LLD-C3's rubric home corrects to `.claude/docs/rubrics/`; LLD-C5's separate
> artifact-map file folds into the SPEC §5.1; LLD-C6's programmatic driver defers to the live-agent
> wave (the loop is procedural + a `validate-payload` CLI); **NEW LLD-C8** activates the corpus
> ADR-0060 judge seam via the verdict adapter (ADR-0068) and back-scores the 11 phase-1 records;
> **NEW LLD-C9** ships the routing-trigger corpora. The plan manifest is
> `.claude/docs/decompositions/a2ui-expert-harness.decomp-v2.json` (coverage-clean `--strict`; v1 is
> the earlier record).
> **v0.2.1 (2026-07-03, review revisions — independent doc-review, 1 blocker + 4 majors, all applied):**
> the QUARANTINE contract is made end-to-end consistent with the realized tree (ADR-0068 clauses 4–6):
> the standing gate `corpus-data.test.ts:45`'s never-quarantined assertion is AMENDED in h11 (its
> "invariant ii" cite was facet-only — the gate over-asserted), dedup warming enumerates quarantined
> records (`store.all({includeQuarantined})`), routine imports HALT on a quarantined-name collision,
> and `--replace` is the sanctioned judged exit (rescore itself never un-quarantines); loop rounds are
> explicitly HOST-orchestrated with the critic's verdict text returning to the composer (§6 — the
> composer "never self-grades", not "never sees scores"); the streaming LLD-C2 re-point is APPLIED
> (`a2ui-streaming-pipeline.lld.md` §1/§3, ADR-0067 Repairs); the payload rubric's [gate] evidence is
> the `validate-payload` CLI (not the shard-scoped corpus-data gate); `a2ui-corpus.md` carries an
> explicit `version:` the VerdictsFile must cite.
> Altitude: adds the **how** — concrete files, frontmatter, and wiring; cites `SPEC-R*` for behavior. The shared validator is the renderer LLD's (`validate.ts`); the corpus pipeline is `a2ui-corpus-store.lld.md`'s (v0.5.1).

---

## 0. Reconciliation — v0.1 claims ruled against the realized tree (2026-07-03)

| v0.1 claim | Ruling | Evidence / reshape |
|---|---|---|
| LLD-C4 gate scripts `tools/gates/{a2ui-validate,corpus-leak,version-pin}.ts` + CI/pre-commit | **REALIZED-ELSEWHERE** — no build | schema/catalog/id-graph/pointer/version: `renderer/validate.ts:47` shared as `corpus/validate.ts:7-8` (same function object, parity probe `corpus/validate.test.ts:10`); the E_* mapping: `corpus/admit.ts` (corpus LLD §6/§8, its test matrix); version-pin: `E_PIN` stages + the standing gate `corpus/corpus-data.test.ts`; corpus-leak: the `E_LEAK` arms in admission + `exportFineTune`'s planted-eval assertion (`corpus/export.ts`); the leak CI hook lands with corpus LLD-C8 (deferred, trigger unchanged) |
| LLD-C2: three maker agents (catalog-author · payload-composer · corpus-curator) | **RESHAPED** | catalog-author RETIRED — catalog rows are package source bound to `ui-*` factories, `a2ui-builder`'s charter (`.claude/agents/a2ui-builder.md`); corpus-curator RETIRED — the deterministic half is `tools/corpus/import-seeds.ts` + `admit()` (realized), the judgment half is the judge (LLD-C8); payload composition stands as the ONE genuinely new maker, `a2ui-composer`, paired with the critic `a2ui-reviewer` (ADR-0067) |
| LLD-C3 rubric home `.claude/docs/specs/rubrics/` | **CORRECTED** | the estate's rubric home is `.claude/docs/rubrics/` (`component.md`/`element.md`/`kernel.md`/`template.md` live there; no `specs/rubrics/` exists) |
| LLD-C1: four skills incl. `a2ui-jsonl-mcp` | **RESHAPED** | two skills (`a2ui-compose` merges patterns+composition; `a2ui-corpus-curate` thin over the realized pipeline); `a2ui-jsonl-mcp` trigger-deferred — the streaming producer scope (streaming LLD-C1..C7) is deliberately unbuilt (streaming LLD v0.2); teaching unbuilt workflows fabricates |
| LLD-C5: separate `a2ui-artifact-map.md` | **FOLDED** | the map is SPEC §5.1 (one fact, one home); reachability is LLD-C7's script |
| LLD-C6: `tools/loop/compose-verify.ts` dispatching agents from Node | **SPLIT** | a Node script cannot dispatch Claude Code seats — unbuildable as written. The loop CONTRACT stays SPEC-R6; its realization this wave is PROCEDURAL (composer charter + `a2ui-compose` skill + the `validate-payload` CLI, LLD-C6 below); the PROGRAMMATIC driver is the live-agent wave's (NEXT item 4) — `a2ui-streaming-pipeline.lld.md` LLD-C2's "blocked by harness LLD-C6" edge is RE-POINTED to that wave's driver (§1 row + §3 lead edited this change; ADR-0067 Repairs) |
| LLD-C7 governance `tools/gates/governance-check.py` | **RESHAPED** | `scripts/harness_wiring_check.py` (repo `scripts/`, the `measure-size.mjs` precedent); wraps `harness_checks.py` modes + reachability; MANUAL gate (Kim's `npm run size` discipline, ADR-0040 §3) with a named promotion trigger |
| "trigger eval ≥90% routing" as a mechanical certification | **RE-BOUND** | the realized instrument (`skill-author/scripts/routing_eval.py`) is BY ITS OWN POLICY a tripwire aid, not a certification — SPEC-N2 v0.2 = corpus + `--min-f1 0.7` tripwire + dispositioned human/critic read |
| (absent in v0.1) the corpus tier-2 judge activation | **NEW — LLD-C8** | corpus ADR-0060's named trigger IS this wave; mechanism ADR-0068 (verdict adapter + rescore + `--verdicts` wiring); corpus LLD-C12 SPLITS — judge half activates now, Inspect-AI scoring/lift half stays deferred with LLD-C8/the first eval record |

## 1. Component map (traceability)

| ID | Component | Implements | Location | State |
|---|---|---|---|---|
| **LLD-C1** | Domain skill files (2) | SPEC-R1 | `.claude/skills/a2ui-compose/` · `.claude/skills/a2ui-corpus-curate/` | unbuilt (slices h6/h7) |
| **LLD-C2** | Agent pair + routing repair | SPEC-R2, R8 | `.claude/agents/a2ui-composer.md` · `.claude/agents/a2ui-reviewer.md` · `a2ui-builder.md` (description repair) | unbuilt (h8/h9) |
| **LLD-C3** | Rubric files (3) | SPEC-R3 | `.claude/docs/rubrics/a2ui-{payload,catalog,corpus}.md` | unbuilt (h3/h4/h5) |
| **LLD-C4** | Deterministic gates | SPEC-R4 | — | **REALIZED** (§0 row 1 — no build) |
| **LLD-C5** | Orchestration wiring / artifact map | SPEC-R5 | SPEC §5.1 + frontmatter cross-refs | lands with C1–C3 |
| **LLD-C6** | Loop (procedural) + deterministic CLI | SPEC-R6 | composer charter + `a2ui-compose` body + `packages/agent-ui/a2ui/tools/harness/validate-payload.ts` | unbuilt (h10, h15) |
| **LLD-C7** | Governance + reachability check | SPEC-R5, R7 | `scripts/harness_wiring_check.py` | unbuilt (h14) |
| **LLD-C8** | Judge activation (corpus ADR-0060 seam) | SPEC-R3 (corpus SPEC-R8) | `packages/agent-ui/a2ui/src/corpus/judge.ts` (pure) · `store.ts` (`includeQuarantined` flag) · `corpus-data.test.ts` (quarantine legs — the B1 gate amendment) · `tools/corpus/rescore.ts` (shell) · `import-seeds --verdicts`/`--replace` + the quarantined-name halt | unbuilt (h11/h12; ADR-0068) |
| **LLD-C9** | Routing-trigger corpora | SPEC-N2 | `<skill>/scripts/routing-corpus.json` ×2 | unbuilt (h13) |

## 2. Skills — LLD-C1 (SPEC-R1)

| Skill dir | Covers | Body shape |
|---|---|---|
| `a2ui-compose/` | idiomatic node shapes per catalog type + adjacency trees, `ChildList` templating, bindings, actions/checks, and the SPEC-R6 bounded loop | procedure + `references/` idiom cards DERIVED from the realized catalog (`src/catalog/default/`) and the 11-seed shelf (`src/examples/`) — file cites, never restated `protocol.ts` facts |
| `a2ui-corpus-curate/` | seed authoring → `import-seeds --verdicts` → gates → judge verdicts → `rescore` | THIN pointer at corpus LLD §6 + ADR-0055/0060..0064/0068; states the three halt escalations (θ_dup between distinct seeds; unjudged candidate under a wired judge; quarantined-name collision — ADR-0068 cl.5, `--replace` is the exit) |

**Invariant:** each passes `harness_checks.py skill`; descriptions fence siblings (each other, `component-author`, `docs-author`, `a2ui-builder` dispatch phrasings). Bodies/`references/` load on demand (SPEC-N1).

## 3. Agents — LLD-C2 (SPEC-R2, R8)

```
.claude/agents/
  a2ui-composer.md   # maker · tools:[Read,Grep,Glob,Write,Bash] (Bash = the validate CLI only) ·
                     # model sonnet/effort high · skills:[a2ui-compose] · graded by: a2ui-payload rubric
  a2ui-reviewer.md   # critic · tools:[Read,Grep,Glob,Bash] · grades payload|catalog-row|corpus-record
                     # against the named a2ui-*.md rubric; emits the ADR-0068 verdicts shape for records
  a2ui-builder.md    # EXISTING — description repaired: payload COMPOSITION → a2ui-composer;
                     # package/renderer/catalog CODE stays here (mutual fence)
```

**Invariants:** each passes `harness_checks.py agent`; the composer conditions on the corpus by READING the committed shard + examples pages directly (≤ ~20 records; the retrieval CLI is the named scale trigger — live-agent wave or corpus >20 records, not built now); the reviewer never edits source and carries no maker verbs (generator/critic split, SPEC-R8).

## 4. Rubrics — LLD-C3 (SPEC-R3)

```
.claude/docs/rubrics/
  a2ui-payload.md   # dims: [gate] cite the validate-payload CLI verdicts (the payload-scoped probe —
                    # NOT the shard-scoped corpus-data gate) · [review] composition · idiom (vs seed
                    # shelf + catalog docs) · binding hygiene · accessibility intent
  a2ui-catalog.md   # [gate] cite naming.ts (UAX-31) + conformance.ts probes · [review] mapping
                    # fidelity to ui-* · PropDef typing idiom · example/doc coverage (anchor: ADR-0053 rows)
  a2ui-corpus.md    # the tier-2 judge STANDARD: ground-truth validity (cites a2ui-payload.md — no
                    # duplicated dims) · prompt/description quality · target-clarity (target ?? description,
                    # ADR-0063) · provenance integrity · dedup adjacency; DEFINES qualityScore = MIN over
                    # [gate] dims (1–5), passed = ≥4; carries an explicit `version:` marker the
                    # VerdictsFile MUST cite (ADR-0068 cl.1); ships the SPEC-R3 AC2 calibration record
```

Each typed `[gate]`/`[review]` with 1/3/5 anchors + a gate-to-promote rule; passes `harness_checks.py rubric`; graded ≥4 by `doc-reviewer`. `[gate]` dims cite realized probes — no dimension re-judges a script's verdict (`process.md` rule 1).

## 5. Gates — LLD-C4 (SPEC-R4) — REALIZED

No harness gate code exists to build (§0 row 1). What the harness RELIES on: `validateA2ui`'s reach (raw-string PARSE, per-message schema, `SUPPORTED_VERSIONS`, all six envelopes, catalog conformance, id-graph, pointer syntax — corpus LLD §0/§7), admission's corpus-only pointer-RESOLUTION stage, the §8 error matrix as the labelled invalid set, and the standing shard gate. Parity is structural (one function object). A new check belongs in the shared validator or admission — never in a harness-local fork (SPEC-N3 incident rule otherwise).

## 6. Loop — LLD-C6 (SPEC-R6)

**Contract (fixed here, both realizations bind it):** generate (corpus-conditioned) → deterministic gates FIRST (`validate-payload`) → critic rubric only on gate-green → self-correct on failure → `maxRounds = 3` → halt-and-report with round count + verdicts.

**Round orchestration (v0.2.1 — who drives what):** rounds are **HOST-orchestrated** — the composer has no Task tool and cannot invoke the critic; the dispatching seat runs the loop. Within a round the composer feeds the CLI's gate failures back to itself freely (deterministic self-checking is not self-grading). When the critic scores a gated dimension < 4, the host returns **the critic's verdict verbatim — the per-dimension scores + the file:line-cited findings text** — to the composer as the next round's input. The composer **never self-grades** (SPEC-R8): it never assigns rubric scores to its own output; seeing the critic's verdict between rounds is the SPEC-R6 self-correction channel, not a violation. The host records the round count + every verdict in the slice report.

**Procedural realization (this wave):** the composer charter + `a2ui-compose` body encode the loop; the deterministic step is the CLI:

```
node --experimental-strip-types packages/agent-ui/a2ui/tools/harness/validate-payload.ts \
  <payload.json> [--catalog agent-ui]
# exit 0 → {ok:true, repairs:[…]}   (heal applied first — ADR-0061's closed list; repairs named)
# exit 1 → [{code, path, message}]  (the shared validator's verdicts, unforked)
```

The CLI composes `heal` + `validateA2ui` + the default catalog via relative imports of the pure core (ADR-0062: the core computes, the shell does IO; the catalog JSON-import workaround mirrors `import-seeds.ts`). Zero new deps.

**Programmatic driver — DEFERRED (named trigger: the live-agent wave, NEXT item 4).** A Node script cannot dispatch Claude Code seats (§0), and the first real programmatic generator is the live agent itself: its server harness realizes prompt→stream→validate→retry as code over the SAME surfaces (`heal`/`validateA2ui`/`retrieve`), and streaming LLD-C2 specializes it for stream production. The contract above is what it inherits.

## 7. Judge activation — LLD-C8 (SPEC-R3; corpus SPEC-R8/ADR-0060; mechanism ADR-0068)

The corpus store shipped `admit(candidate, { catalog, store, dedupIndex, judge? })` with `Judge`/`JudgeVerdict` at `admit.ts:39-62` and named THIS wave as the activation trigger. The activation (one write path throughout — the pipeline):

```
src/corpus/judge.ts        # PURE (zero-dep, joins the "./corpus" barrel — TEN core modules):
                           #   parseVerdictsFile(text, expectedRubricVersion) → VerdictsFile   (structured errors;
                           #     rubricVersion ≠ the CALLER-supplied expected version rejects — the Node shell reads
                           #     a2ui-corpus.md's `version:` marker; the pure core never touches the fs, ADR-0062)
                           #   createVerdictJudge(file) → Judge         (score() = name lookup;
                           #                                             ABSENT name ⇒ THROW unjudged-candidate — fail-closed)
src/corpus/store.ts        # all() gains `includeQuarantined?: boolean` (default false — consumption semantics
                           #   unchanged for every existing caller; the flag is the storage-integrity read)
src/corpus/corpus-data.test.ts  # THE B1 GATE AMENDMENT (ADR-0068 cl.6, lands in h11 BEFORE any back-score):
                           #   quarantined lines are LEGAL — parse + validateRecord + facet assert for ALL lines;
                           #   tier-1 + hash-recompute legs run for NON-quarantined lines only (a quarantined
                           #   record may legitimately no longer validate — that is what quarantine records);
                           #   the ":45 never-quarantined" assertion is REMOVED and the over-broad
                           #   "invariant ii" cite corrected (it is facet-only; consumption exclusion is all()'s)
tools/corpus/rescore.ts    # Node shell: whole verdicts file validated + ALL updates computed BEFORE one
                           #   serialize (all-or-nothing); applies ONLY to records with ABSENT qualityScore:
                           #   ≥ bar → meta.qualityScore · below bar → status:"quarantined" (SPEC-R13, ONE-WAY
                           #   under rescore); unknown name → halt · conflicting re-verdict → halt · identical
                           #   verdict → no-op (idempotent, byte-level no-op on re-run) · records NOT named in the
                           #   file are untouched and reported still-unjudged (rescore is deliberately partial)
tools/corpus/import-seeds.ts  # --verdicts <path>: wires createVerdictJudge into deps.judge (unjudged-candidate
                           #   throw → report+halt, the θ_dup precedent) · warmDedupIndex now enumerates with
                           #   includeQuarantined:true (an identical re-import hits E_DUP against the quarantined
                           #   line instead of silently re-admitting) · a candidate that clears dedup whose name
                           #   matches a stored QUARANTINED record HALTS (store.get() sees all statuses; nothing
                           #   written) · --replace <name>: the sanctioned exit — deliberate re-admission through
                           #   the FULL judged pipeline; the replaced record's exact+near dedup signatures are
                           #   OMITTED from warming for that run (an improved seed is near-identical to its
                           #   predecessor BY CONSTRUCTION — it would otherwise E_DUP against the very record it
                           #   replaces); prior status + canonicalHash logged in the run report; status recomputed
                           #   honestly by admission (valid/repaired from heal)
```

**Who judges:** the `a2ui-reviewer` critic grades records against `a2ui-corpus.md` and authors the verdicts file (SPEC §5.3 shape). The adapter is deterministic plumbing — judgment never executes inside `admit()` (process.md rule 1 + SPEC-R8). **Back-scoring (slice h12):** all 11 phase-1 records are graded → rescore updates the shard → the ADR-0060 "absent `qualityScore`" marker count goes 11 → 0 (or the quarantine delta is itemized); the AMENDED standing gate stays green either way. The `E_QUALITY` end-to-end proof (corpus SPEC-R8 AC2, falsifiable at last) rides a **planted below-bar candidate: a TEMPORARY shelf seed** (touches `src/examples/<module>.ts` + `index.ts` + `SEEDS_BY_MODULE`), whose import run exits 1 with `E_QUALITY` and writes NOTHING — then the plant is reverted (the working tree returns clean; both facts shown in the run log). **Corpus LLD-C12 splits:** this judge half activates now; the Inspect-AI scoring/lift half stays deferred with corpus LLD-C8 (the first eval record) — recorded in the corpus LLD (v0.5.1 note, ADR-0068 Repairs).

## 8. Error & edge-case handling

| Code / edge | Stage | Handling |
|---|---|---|
| gate false-pass | LLD-C4 | an invalid payload that passes is an **incident** → stale the responsible gate, RCA, add the case to the shared validator/admission (SPEC-N3) — never a harness-local patch |
| routing miss | LLD-C9 | tripwire red or a bad dispositioned read → tune the skill `description` via `skill-author`; genuine skill overlap is a SPEC-R1 granularity gap — revise the SPEC, don't paper over routing |
| self-grade attempt | LLD-C2/C7 | the wiring check fails a maker whose file embeds its own verdict (SPEC-R8); the reviewer's charter carries no maker verbs |
| unbounded loop | LLD-C6 | hard `maxRounds = 3` → halt + report rounds/verdicts; never silent retry (SPEC-R6 AC1) |
| orphan capability | LLD-C5/C7 | maker without a resolvable rubric · skill referencing a missing tool/rubric · rubric no one cites → `harness_wiring_check.py` exits 1 |
| unjudged candidate under a wired judge | LLD-C8 | `createVerdictJudge().score()` THROWS; `import-seeds` reports + halts (never silently admits unjudged into a judged-era corpus) |
| malformed verdicts file | LLD-C8 | `parseVerdictsFile` rejects with structured errors before any admission runs |
| below-bar STORED record at back-score | LLD-C8 | `status:"quarantined"` (excluded from consumption, kept in the shard — corpus SPEC-R13 semantics); ONE-WAY under rescore — the only exit is the explicit `--replace` re-admission (judged, logged) |
| quarantined-name collision at import | LLD-C8 | identical content → `E_DUP` (warming enumerates quarantined, `includeQuarantined:true`); different content, same name → HALT, nothing written; `--replace <name>` is the sanctioned, judged, logged overwrite (ADR-0068 cl.5) |
| rescore unknown name / conflicting re-verdict | LLD-C8 | report + halt with nothing written (the whole file validates and every update computes BEFORE one all-or-nothing serialize); an identical verdict is a no-op |
| quarantined line vs the standing gate | LLD-C8 | the AMENDED `corpus-data.test.ts` (h11, ADR-0068 cl.6): quarantined lines legal (parse + `validateRecord` + facet), tier-1/hash legs skipped for them; a quarantined line with a schema defect still fails |
| judged-then-failing-later candidate | LLD-C8 | stage order unchanged (corpus LLD §6): the judge runs LAST before write — a candidate failing an earlier stage never consumes a verdict |
| validator drift | LLD-C4 | a check forked from the shared validator → the parity probe fails (SPEC-R4 AC2) |
| calibration miss | LLD-C3 | two independent scorings differ >±1 on a gated dim → the rubric's anchors are ambiguous; repair the rubric (the source), not the scores |

## 9. Wiring & governance — LLD-C5, LLD-C7

**LLD-C5:** the artifact map is SPEC §5.1; composition is discoverable from frontmatter (`# graded by:` lines, `skills:` preloads, rubric cites in skill bodies). **LLD-C7:** `scripts/harness_wiring_check.py` (stdlib-only) runs `harness_checks.py` (skill|agent|rubric) over the enumerated harness set AND asserts reachability (SPEC-R5 AC1): maker→rubric resolves; skill refs resolve; no orphan rubric. The enumeration is the SPEC §5.1 harness artifact set ONLY — `a2ui-builder` is deliberately OUT of the maker→graded-by check (it is graded by SPEC/LLD acceptance rows + wave reviewer seats, not a harness rubric; the script's enumeration comment states this so its absence is never misread as an orphan). **Manual gate** (the `npm run size` precedent, ADR-0040 §3): run at authoring DoD + wave close; promotion to a standing gate triggers on the first observed wiring-drift incident (vitest's include is packages-only — `.claude/` governance doesn't belong in a package suite today).

## 10. Build sequence (slices = the decomp manifest's h-nodes; gates named per slice)

Parallel-safe groups after the docs/ADR root; seats per the manifest `meta.seat`:

1. **h1 SPEC/LLD v0.2** *(this intake — done)* + **h2 ADR-0067/0068 proposed → ratified** *(host; `adr_check.py` 0; dependent slices dispatch only after acceptance)*
2. **Group A (parallel, file-disjoint):** h3 `a2ui-payload.md` · h4 `a2ui-catalog.md` · h5 `a2ui-corpus.md` (+explicit `version:` marker + calibration) · h6 `a2ui-compose/` · h7 `a2ui-corpus-curate/` *(planner/host via rubric-author/skill-author; doc/skill-reviewer ≥4; `harness_checks.py` 0)* · h10 `validate-payload.ts` · h11 the judge machinery — `judge.ts` + `store.ts` `includeQuarantined` + the **`corpus-data.test.ts` quarantine amendment (B1)** + `rescore.ts` + `--verdicts`/`--replace` + the quarantined-name halt *(a2ui-builder; `npm run check` + `npm test` green)*
3. **Group B (parallel):** h8 `a2ui-composer.md` + builder repair (routing fence + the stale "rubrics pending" line) *(needs h3, h6)* · h9 `a2ui-reviewer.md` *(needs h3, h4, h5)* *(agent-author; agent-reviewer ≥4)*
4. **Group C (parallel):** h12 back-score activation *(needs h5, h9, h11 — the shard update + the temporary-shelf-seed `E_QUALITY` plant/revert; the AMENDED `corpus-data.test.ts` green)* · h13 routing corpora *(needs h6, h7; `routing_eval.py --min-f1 0.7` + dispositioned read)* · h15 reference artifact *(needs h8, h9, h10; SPEC-N4 ≥4/5 within ≤3 host-orchestrated rounds — §6's round-orchestration rules)*
5. **h14 wiring check** *(needs h3–h9; negative controls run; exits 0; `a2ui-builder` explicitly out of the maker enumeration)* — the wave-close governance proof.

**Discovered-reality note:** if the calibration (SPEC-R3 AC2) cannot converge within ±1 by anchor repair, that is a rubric-granularity gap — fix `a2ui-corpus.md`'s anchors (the owning doc), never widen the tolerance silently. A verdict for an already-judged record with a DIFFERENT score halts the run (ADR-0068 cl.4 — a re-judge is deliberate, never a drive-by); an identical verdict is a no-op.
