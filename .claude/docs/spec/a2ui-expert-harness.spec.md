# SPEC — A2UI Expert Harness (agents · skills · rubrics · gates)

> Status: proposed · v0.2 · 2026-07-03 (v0.1 2026-06-26) · Layer: SPEC (execution contract)
> **v0.2 reconciliation (2026-07-03, the expert-harness intake):** the v0.1 draft predated the corpus
> store (ADRs 0060–0064, all shipped `23e2494`), the `a2ui-builder` seat, the seed shelf (ADR-0055),
> and the form-family catalog rows (ADR-0053/0054); every requirement is re-ruled against that tree.
> Headlines: **SPEC-R4's deterministic gates are REALIZED** (the shared `validateA2ui` + admission's
> `E_*` codes + the standing `corpus-data.test.ts` gate — no gate code left to build); **SPEC-R2's
> three maker agents become one maker/critic pair** (`a2ui-composer` + `a2ui-reviewer`; catalog-author
> is `a2ui-builder` territory, corpus-curator is the realized pipeline); **SPEC-R1's four skills
> become two** (`a2ui-compose` merges patterns+composition; `a2ui-corpus-curate` is a thin pointer;
> `a2ui-jsonl-mcp` is trigger-deferred to the streaming producer wave); **rubrics live at
> `.claude/docs/rubrics/`** (the estate's home — the v0.1 `specs/rubrics/` path never existed);
> **SPEC-R3's corpus-quality rubric activates the ADR-0060 judge seam** via a deterministic
> verdict-adapter (ADR-0068 — judgment stays with a critic seat, plumbing stays code); **SPEC-R6's
> loop is procedural this wave** (composer charter + a `validate-payload` CLI), the programmatic
> driver being the live-agent wave's (NEXT item 4); **SPEC-N2 re-binds to the realized routing
> instrument** (`routing_eval.py` is a tripwire aid, not a certification). Scope/reshape decisions:
> ADR-0067; judge mechanism: ADR-0068 (both proposed).
> Refines: [`../a2ui-expert-system.prd.md`](../prd/a2ui-expert-system.prd.md) — primarily **PRD-G3, PRD-G4**; supports PRD-G6. Honors Constraint **C3** (governance via the `skill-author`/`agent-author`/`rubric-author` family + `process.md`).
> Refined by: [`../lld/a2ui-harness-wiring.lld.md`](../lld/a2ui-harness-wiring.lld.md).
> Altitude: owns *what authoring capabilities exist and how they compose + verify*. The concrete files/frontmatter/wiring are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Define the **expert system** that makes A2UI authoring guided and graded (PRD-G3) and its output provably valid (PRD-G4): the domain-expertise **skills**, authoring **agents**, eval **rubrics**, and deterministic **gates**, and how they discover, compose, and verify each other — now over a realized substrate: the corpus store's admission pipeline, retrieval/export surfaces, the ONE shared healer, and the injected tier-2 judge seam (`admit(candidate, { …, judge? })`, ADR-0060) this harness is the first real consumer of.

This mirrors `process.md`'s governing model, applied to *authoring A2UI*: anything with a true/false answer is a script/gate (never agent judgment); judgment grounds against a small rubric; progressive disclosure keeps context economical; the generator and the critic are never the same actor.

## 2. Definitions

- **Skill** — a `SKILL.md` procedure (progressive disclosure: description always loaded, body on demand), authored via `skill-author`.
- **Agent** — a subagent that *makes* or *grades* an A2UI artifact in an isolated context, authored via `agent-author`.
- **Rubric** — a referential scoring standard, authored via `rubric-author`; the thing judgment checks against. A rubric is always ONE document; any runtime binding (the corpus judge) is deterministic plumbing over verdicts a critic authored against it.
- **Gate** — a deterministic script/probe returning pass/fail. The A2UI gates are **realized**: the shared validator (`renderer/validate.ts` ≡ `corpus/validate.ts`), admission's `E_*` codes, and the standing shard gate.
- **Judge / verdict** — the corpus SPEC-R8 tier-2 actor: a critic seat scores a record against the corpus rubric and emits a **verdicts file**; the `Judge` object admission consumes is an adapter over that file (ADR-0068).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 The capability inventory

**SPEC-R1 — Domain-expertise skills.** The harness MUST provide progressive-disclosure skills covering the realized authoring surfaces: (a) **composing A2UI** — idiomatic node shapes per catalog type AND composability (adjacency-list trees, `ChildList` templating, data binding, actions/checks) as ONE skill, `a2ui-compose` (the v0.1 patterns/composition split shared one routing surface and is merged — ADR-0067; the v0.1 §6 granularity item, resolved); (b) **corpus curation** — a THIN procedure over the realized pipeline (seed authoring → `import-seeds` → gates → judge verdicts → rescore), `a2ui-corpus-curate`, citing the corpus LLD rather than restating it. The v0.1 (c) JSONL+MCP skill is **trigger-deferred**: the streaming pipeline's producer scope is deliberately unbuilt (streaming LLD v0.2); a skill teaching unbuilt workflows would fabricate — it lands with the streaming producer wave. *(→ PRD-G3)*
- **AC1** *Given* the two skills, *when* checked, *then* each passes `harness_checks.py skill` (trigger-bearing description, ≤500-line body, validation loop present) and each description fences its siblings (`component-author`, `a2ui-builder` dispatch territory, `docs-author`, each other).
- **AC2** *Given* the trigger corpora, *when* the SPEC-N2 tripwire runs, *then* it passes and the named misses are dispositioned by a human/critic read.

**SPEC-R2 — Authoring agents: one maker/critic pair.** The harness MUST provide: **`a2ui-composer`** (maker — emits valid `createSurface`→`updateComponents`→`updateDataModel` payloads/streams with bindings/actions/checks, conditioned by the corpus, self-checked ONLY against deterministic gates, graded by the `a2ui-payload` rubric) and **`a2ui-reviewer`** (critic — grades ONE a2ui artifact: payload, catalog row, or corpus record, against the named rubric; authors the corpus judge verdicts). Each MUST declare scoped `tools:`, a `model:`, a when-to-dispatch description, and (makers) the rubric it is graded by. The v0.1 **catalog-author is RETIRED** — catalog rows are package source bound to `ui-*` factories, `a2ui-builder`'s charter (`.claude/agents/a2ui-builder.md`); the v0.1 **corpus-curator is RETIRED** — curation's deterministic half is the realized pipeline (`tools/corpus/import-seeds.ts` + `admit()`), its judgment half is the judge (SPEC-R3); an agent would re-own what scripts decide (`process.md` rule 1). The composer/builder routing boundary MUST be repaired in the same change that lands the composer (payload *composition* → composer; package/renderer/catalog *code* → builder). *(→ PRD-G3; ADR-0067)*
- **AC1** *Given* each agent file, *when* checked, *then* it passes `harness_checks.py agent` (scoped tools, model set, trigger description, no enforcement-in-prose).
- **AC2** *Given* a composer artifact, *when* it is verified, *then* the verifier is a gate or the critic seat — never the composer's self-assessment (SPEC-R8).

**SPEC-R3 — Eval rubrics.** The harness MUST provide three rubrics at **`.claude/docs/rubrics/`** (the estate's rubric home — `component.md` is the exemplar; the v0.1 `specs/rubrics/` path is corrected): **`a2ui-payload.md`**, **`a2ui-catalog.md`**, and **`a2ui-corpus.md`**. Each MUST type its dimensions `[gate]`/`[review]`, carry 1/3/5 anchors, state a gate-to-promote rule, and pass `harness_checks.py rubric`. `[gate]` dimensions MUST cite the realized deterministic probes as their evidence — a rubric dimension never re-judges what a script decides. **`a2ui-corpus.md` is the corpus tier-2 judge standard** (corpus SPEC-R8): it MUST define the aggregation the judge seam reads — `qualityScore` = the MINIMUM across `[gate]`-typed dimensions (1–5), `passed` = `qualityScore ≥ 4` — and MUST carry an explicit `version:` marker, which every verdicts file cites as its `rubricVersion` (a verdict is meaningless without the standard it scored against); its runtime binding is the ADR-0068 verdict adapter: the critic scores against the document; the `Judge` object is deterministic plumbing; judgment never executes inside `admit()`. *(→ PRD-G3, PRD-G4; ADR-0068)*
- **AC1** *Given* each rubric, *when* checked, *then* it passes the rubric gate and names which gated dimensions must clear to promote.
- **AC2** *Given* the same reference artifact scored in two independent contexts against a rubric, *when* compared, *then* every gated dimension agrees within ±1 (the calibration record ships with `a2ui-corpus.md`).

**SPEC-R4 — Deterministic gates (REALIZED — a standing invariant, not a build item).** Every true/false correctness check MUST be a script, not agent judgment — and every named v0.1 gate now IS one: A2UI schema/catalog-conformance/id-graph/pointer/version = the shared `validateA2ui` (ONE function object across renderer, admission, and CI — parity proven by `src/corpus/validate.test.ts`); the admission mapping to `E_*` codes = `corpus/admit.ts` (corpus LLD §6/§8); corpus-leak = the realized `E_LEAK` arms (the CI hook lands with corpus LLD-C8); version-pin = `E_PIN` + the standing shard gate `corpus-data.test.ts`. The harness therefore adds **no new gate code** beyond the SPEC-R5 wiring check; any new payload-facing check MUST extend the shared validator, never fork it. *(→ PRD-G4)*
- **AC1** *Given* the labelled invalid-payload classes (the corpus LLD §8 matrix, realized as `admit.test.ts` + the standing gate), *when* the gates run, *then* 0 known invalid classes pass and each failure reports its code.
- **AC2** *Given* the validator, *when* invoked from a gate, the renderer, and corpus admission, *then* all three return identical verdicts (the realized same-function-object parity probe).

### 3.2 How they compose & verify

**SPEC-R5 — Discovery & composition (orchestration).** Skills, agents, rubrics, and gates MUST discover and compose through declared wiring (frontmatter + descriptions): a skill captures a *procedure*; a subagent is dispatched for *isolated making or grading*; a rubric is *referenced* for judgment; a gate is *invoked* for a true/false check. The artifact map lives in THIS SPEC (§5.1 — one fact, one home; the v0.1 separate `a2ui-artifact-map.md` is retired). Reachability MUST be mechanically checked: every maker names a resolvable grading rubric, every skill's referenced tools/rubrics resolve, no rubric is an orphan. *(→ PRD-G3)*
- **AC1** *Given* the artifact set, *when* `scripts/harness_wiring_check.py` runs, *then* it exits 0, and a planted dangling rubric reference or self-grading maker line makes it exit 1 (negative controls).

**SPEC-R6 — Generation→verification→self-correction loop.** The harness MUST encode the bounded loop: an agent generates an artifact conditioned by the corpus (few-shot over the committed shard now; `retrieve()` programmatically at scale), the deterministic gates verify it FIRST, the critic rubric grades only what gates pass, and on failure the maker self-corrects — bounded at `maxRounds = 3`, then halt-and-report (no unbounded retry). Rounds are HOST-orchestrated (the maker cannot invoke the critic): gate failures feed straight back to the maker within a round; a below-bar critic verdict — the per-dimension scores + cited findings — returns to the maker as the next round's input (the self-correction channel; the maker still never ASSIGNS scores to its own output, SPEC-R8). This wave the loop is **procedural** — encoded in the composer charter + the `a2ui-compose` skill, with `tools/harness/validate-payload.ts` as the deterministic check any seat can run; the **programmatic driver** (prompt→stream→validate→retry as code) is the live-agent wave's (NEXT item 4), and the streaming LLD-C2 dependency is re-pointed there (ADR-0067; applied in `a2ui-streaming-pipeline.lld.md` §1/§3). *(→ PRD-G3, PRD-G4)*
- **AC1** *Given* a generation task, *when* the loop runs, *then* an artifact is accepted only after passing its gates and meeting its rubric bar, or the loop halts at its bound and reports the failure — the round count and verdicts recorded.

**SPEC-R7 — Authored-via-harness + governance.** Every skill/agent/rubric MUST be authored with the corresponding authoring skill (`skill-author` / `agent-author` / `rubric-author`), pass its `harness_checks.py` mode, and score ≥ its authoring rubric's bar under an independent reviewer seat (`skill-reviewer`/`agent-reviewer`/`doc-reviewer`); every artifact MUST obey `process.md` placement (deterministic→script; judgment→rubric; procedure→skill). *(→ PRD-G3; Constraint C3)*
- **AC1** *Given* each authored artifact, *when* scored by its authoring-skill rubric, *then* it clears the gated dimensions; *when* placement is checked, *then* no true/false check lives in agent prose.

**SPEC-R8 — Generator/critic separation.** No agent MAY grade its own output. Verification MUST be a deterministic gate or a separate critic/rubric invocation in an independent context. The corpus judge honors this by construction: the critic (`a2ui-reviewer`) authors verdicts against `a2ui-corpus.md`; the composer and the pipeline never do. *(→ PRD-G4)*
- **AC1** *Given* an agent's artifact, *when* it is verified, *then* the verifier is a gate or a distinct critic — never the producing agent's self-assessment.

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Progressive disclosure | Skill/agent descriptions are always-loaded; bodies/rubrics/scripts load on demand; no rubric or corpus content sits in always-on context (context economy per `process.md`). |
| **SPEC-N2** | Routing legibility | Each new skill ships a `scripts/routing-corpus.json` (≥8 positives incl. paraphrases, ≥6 sibling-territory negatives); `routing_eval.py --min-f1 0.7` exits 0 as a **tripwire**, and the named misses/grabs are dispositioned by a human/critic read — the aid is not a certification (its own policy); the PRD-G3 ≥90% routing target reads over the trigger corpus under that combined check. |
| **SPEC-N3** | Zero false-pass | Gates admit 0 known invalid-payload classes (PRD-G4); a false pass is an incident that stales the responsible gate. *(Realized surface: the corpus LLD §8 matrix.)* |
| **SPEC-N4** | Reference-artifact quality | Each MAKER agent ships a reference artifact scoring ≥ 4/5 on every gated rubric dimension (PRD-G3), produced within the SPEC-R6 bound; critics are calibrated instead (SPEC-R3 AC2). |

## 5. Typed contracts

### 5.1 Artifact inventory (the harness's `process.md`-style map — the SPEC-R5 single home)

| Artifact | Kind | Authored via | Verified by | Implements |
|---|---|---|---|---|
| `a2ui-compose` | skill | skill-author | `harness_checks.py skill` + skill-reviewer | SPEC-R1a |
| `a2ui-corpus-curate` | skill | skill-author | `harness_checks.py skill` + skill-reviewer | SPEC-R1b |
| `a2ui-composer` | agent (maker) | agent-author | graded by `a2ui-payload` rubric via `a2ui-reviewer` | SPEC-R2, R6 |
| `a2ui-reviewer` | agent (critic) | agent-author | `harness_checks.py agent` + agent-reviewer; calibrated per SPEC-R3 AC2 | SPEC-R2, R8 |
| `a2ui-payload.md` | rubric | rubric-author | `harness_checks.py rubric` + doc-reviewer | SPEC-R3 |
| `a2ui-catalog.md` | rubric | rubric-author | `harness_checks.py rubric` + doc-reviewer | SPEC-R3 |
| `a2ui-corpus.md` (judge standard) | rubric | rubric-author | rubric gate + doc-reviewer + calibration record | SPEC-R3 |
| `validateA2ui` · admission `E_*` · `corpus-data.test.ts` | gates | **realized** (renderer/corpus LLDs) | the parity probe + the §8 matrix suites | SPEC-R4 |
| `tools/harness/validate-payload.ts` | tool (CLI) | a2ui-builder | fixture run-log (good + 4 invalid classes) | SPEC-R6 |
| `src/corpus/judge.ts` + `tools/corpus/rescore.ts` + `import-seeds --verdicts` | tool | a2ui-builder | `judge.test.ts` + the activation run | SPEC-R3 (ADR-0068) |
| `scripts/harness_wiring_check.py` | script | hand | its negative controls | SPEC-R5, R7 |
| `scripts/routing-corpus.json` (per skill) | eval corpus | skill-author | `routing_eval.py` tripwire + read | SPEC-N2 |

### 5.2 Agent frontmatter contract (per SPEC-R2; keys as the installed build uses them — `a2ui-builder.md` is the live precedent)

```yaml
---
name: a2ui-composer
description: >-
  Compose ONE A2UI payload/stream for a given intent against a named catalog … Use when …
  NOT for package source (a2ui-builder), ui-* controls (component-builder), grading (a2ui-reviewer).
tools: Read, Grep, Glob, Write, Bash     # scoped; Bash solely for the validate-payload CLI
model: sonnet
effort: high
skills: [a2ui-compose]
---
# graded by: a2ui-payload rubric (.claude/docs/rubrics/a2ui-payload.md) — never self-grades (SPEC-R8)
```

### 5.3 The judge/verdicts contract (per SPEC-R3; the realized seam is `admit.ts:39-62` — the harness FILLS it, never re-defines it)

```ts
// realized in src/corpus/admit.ts (ADR-0060) — cited, not redefined:
interface JudgeVerdict { qualityScore: number; passed: boolean; failingDimensions?: string[] }
interface Judge { score(record: CorpusRecord): JudgeVerdict | Promise<JudgeVerdict> }

// ADR-0068 — the artifact a critic authors against a2ui-corpus.md; the adapter is deterministic:
interface VerdictsFile {
  rubric: 'a2ui-corpus'; rubricVersion: string; judgedBy: string; date: string;
  verdicts: Record<string /* record.name */, JudgeVerdict>;
}
// rubricVersion MUST equal a2ui-corpus.md's explicit `version:` marker — enforced by
// parseVerdictsFile(text, expectedRubricVersion): the CALLER supplies the expected version (the Node
// shell reads the rubric doc; the pure core never touches the filesystem, ADR-0062).
// createVerdictJudge(file): Judge — score() on a name ABSENT from the file THROWS (fail-closed:
// a wired judge means every candidate must be judged); the import tool maps that to report+halt.
// Quarantine survivability (ADR-0068 cl.5-6): dedup warming enumerates quarantined records; routine
// imports HALT on a dedup-clearing quarantined-name collision; `--replace <name>` is the sanctioned
// judged exit (its predecessor's signatures omitted from warming for that run — the self-collision
// rule); the standing shard gate is amended in the same change (quarantined lines legal,
// consumption-excluded). Rescore leaves records not named in the file untouched, reported still-unjudged.
```

## 6. Open items (non-normative)

- **`a2ui-jsonl-mcp` skill** — trigger-deferred to the streaming producer wave (streaming LLD-C1..C7 unbuilt by design).
- **Eval set, contamination, scoring/lift** — the harness ships NO corpus eval records; corpus LLD-C8 keeps its trigger (the first eval record) and LLD-C12's Inspect-AI scoring/lift leg waits with it (only its judge half activates this wave — ADR-0068). Before THAT wave designs, the host must fetch/verify upstream `eval/a2ui_eval/scorers.py` + `eval/a2ui_eval/dataset.py` (google/A2UI) — the scorer/judge interfaces are unverified C1 facts.
- **Wiring-check promotion** — `harness_wiring_check.py` is a manual gate (the `npm run size` precedent, ADR-0040 §3); promotion into a standing gate triggers on the first observed wiring-drift incident.
- **The reference artifact's corpus admission** — whether the composer's SPEC-N4 artifact becomes a shelf seed (12th record, through the judged pipeline) is a curation call after activation, not this SPEC's.

## 7. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R2, R5, R6, R7, N1, N2, N4 | PRD-G3 (guided + graded authoring) |
| SPEC-R3, R4, R6, R8, N3 | PRD-G4 (provable validity) |
| SPEC-R4 (version-pin, realized), R7 | PRD-G6 (coherence) |

_Covers PRD-G3 fully and co-serves PRD-G4 with the runtime/catalog/corpus SPECs. See [`../README.md`](../archive/a2ui-expert-system/README.md)._
