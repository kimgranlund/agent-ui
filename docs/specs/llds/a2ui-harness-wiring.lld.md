# LLD — A2UI Expert Harness Wiring

> Status: proposed · v0.1 · 2026-06-26 · Layer: LLD (implementation plan)
> Implements: [`../specs/a2ui-expert-harness.spec.md`](../specs/a2ui-expert-harness.spec.md) (SPEC-R1..R8, SPEC-N1..N4).
> Altitude: adds the **how** — concrete files, frontmatter, and CI wiring; cites `SPEC-R*` for behavior. The shared validator it gates with is owned by the renderer LLD (`a2ui-renderer`, `validate.ts`); the corpus pipeline by `a2ui-corpus-store`.

---

## 1. Component map (traceability)

| ID | Component | Implements | Location |
|---|---|---|---|
| **LLD-C1** | Domain skill files | SPEC-R1 | `.claude/skills/a2ui-*/SKILL.md` (+ `references/`) |
| **LLD-C2** | Authoring agent files | SPEC-R2 | `.claude/agents/a2ui-*.md` |
| **LLD-C3** | Rubric files | SPEC-R3 | `docs/specs/rubrics/a2ui-*.md` |
| **LLD-C4** | Deterministic gate scripts/hooks | SPEC-R4 | `packages/agent-ui/a2ui/tools/gates/` + CI + pre-commit |
| **LLD-C5** | Orchestration wiring | SPEC-R5 | frontmatter + `docs/specs/rubrics/a2ui-artifact-map.md` |
| **LLD-C6** | Generation→verification loop driver | SPEC-R6 | `packages/agent-ui/a2ui/tools/loop/compose-verify.ts` |
| **LLD-C7** | Authoring/governance check | SPEC-R7, R8 | `tools/gates/governance-check.py` (wraps `harness_checks.py`) |

## 2. Skills — LLD-C1 (SPEC-R1)

Four progressive-disclosure skills, one per focus area; each `SKILL.md` carries a routing `description` (trigger phrasing) + an on-demand body + `references/` for depth.

| Skill dir | Covers | Key references |
|---|---|---|
| `a2ui-component-patterns/` | idiomatic node shapes per catalog type (SPEC-R1a) | per-type pattern cards |
| `a2ui-composition/` | adjacency-list trees, `ChildList` templating, bindings, actions/checks (SPEC-R1b) | module composition recipes |
| `a2ui-jsonl-mcp/` | stream serialization + MCP serving/validation/retrieval (SPEC-R1c) | message-envelope + MCP tool cards |
| `a2ui-corpus-authoring/` | create/maintain the corpus (SPEC-R1d) | the corpus SPEC + record schema |

**Invariant:** each passes `harness_checks.py skill` (≤500-line body, `name`+`description`, trigger phrasing). Bodies/`references/` load on demand (SPEC-N1).

## 3. Agents — LLD-C2 (SPEC-R2, R8)

Three maker subagents; each frontmatter declares scoped `tools:`, a `model:`, a trigger `description`, and a `# graded by:` line naming its rubric (never self-grades).

```
.claude/agents/
  a2ui-catalog-author.md     # tools:[Read,Grep,Glob,Write] · graded by: catalog-quality
  a2ui-payload-composer.md   # tools:[Read,Grep,Glob,Write] · graded by: a2ui-payload-quality
  a2ui-corpus-curator.md     # tools:[Read,Grep,Glob,Edit,Write] · graded by: corpus-quality
```

**Invariant:** each passes `harness_checks.py agent` (tools scoped, model set, trigger description, no enforcement-in-prose). The corpus-curator dispatches the corpus admission pipeline (`a2ui-corpus-store` LLD) but does not author its verifier (generator/critic split, SPEC-R8).

## 4. Rubrics — LLD-C3 (SPEC-R3)

```
docs/specs/rubrics/
  a2ui-payload-quality.md   # dims: catalog-conformance · binding-correctness · composition · idiom · accessibility
  catalog-quality.md        # dims: naming(UAX-31) · factory-coverage · prop-typing · design-system-fit
  corpus-quality.md         # dims: ground-truth-validity · provenance · dedup-cleanliness · target-clarity
```

Each typed `[gate]`/`[review]`, with anchors + a gate-to-promote rule; passes `harness_checks.py rubric`. `corpus-quality` is the corpus admission tier-2 gate (corpus SPEC §4.3).

## 5. Gates — LLD-C4 (SPEC-R4)

Deterministic scripts; the correctness floor. `a2ui-validate` **composes the shared validator** (renderer `validate.ts`) so the verdict is identical at runtime, in admission, and in CI (parity).

```
packages/agent-ui/a2ui/tools/gates/
  a2ui-validate.ts      # schema · catalog-conformance · id-graph · pointer  (wraps validate.ts)
  corpus-leak.ts        # exemplar↔eval contamination (corpus SPEC-R3)
  version-pin.ts        # every record/catalog pins a protocolVersion (corpus spec §4.3)
```

Wired as: a CI job (runs all gates on changed payloads/catalogs/corpus) + a pre-commit hook for `corpus-leak`/`version-pin` (true/false → hook, never agent judgment — `process.md`).

## 6. Orchestration & loop — LLD-C5, LLD-C6

**LLD-C5 wiring (SPEC-R5):** an artifact map (`a2ui-artifact-map.md`, `process.md`-style) records, for every capability: kind · authored-via · verified-by · what it routes to. Frontmatter cross-refs make composition discoverable: each agent's `# graded by:` points to a rubric; each skill body points to the gates/rubrics it invokes. **Reachability check:** the governance script (LLD-C7) asserts no capability is an orphan (every agent has a rubric; every skill resolves its referenced gates/rubrics).

**LLD-C6 loop driver (SPEC-R6):** the bounded generate→verify→self-correct loop.
```ts
async function composeVerify(task, opts:{maxRounds:number}) {
  let artifact = await dispatchAgent(task.agent, withCorpusConditioning(task));  // few-shot/retrieval
  for (let round = 0; round < opts.maxRounds; round++) {
    const gate = runGates(artifact, task.ctx);                 // LLD-C4 — deterministic floor
    const judged = gate.allPass ? scoreRubric(artifact, task.rubric) : null;  // LLD-C3 — only if gates pass
    if (gate.allPass && judged.meetsBar) return { accepted: artifact, round };
    artifact = await dispatchAgent(task.agent, selfCorrect(artifact, gate, judged)); // feed failures back
  }
  return { halted: true, lastFailures: /* gate+rubric */ };    // bounded — no unbounded retry (SPEC-R6 AC1)
}
```

## 7. Error & edge-case handling

| Code / edge | Stage | Handling |
|---|---|---|
| gate false-pass | LLD-C4 | an invalid payload that passes is an **incident** → stale the responsible gate, RCA, add the missing case (SPEC-N3) |
| routing miss | LLD-C1 | trigger eval < 90% → tune skill `description` via `authoring-skills` (SPEC-N2) |
| agent self-grade attempt | LLD-C2/C7 | governance check fails if an agent embeds its own pass/fail verdict (SPEC-R8) |
| unbounded loop | LLD-C6 | hard `maxRounds` cap → halt + report; never silent infinite retry (SPEC-R6) |
| orphan capability | LLD-C5/C7 | agent without a rubric, or skill referencing a missing gate → reachability check fails |
| true/false in agent prose | LLD-C7 | placement violation → governance check flags (move to a gate/hook) |
| validator drift | LLD-C4 | a gate that forks the shared validator → parity test fails (SPEC-R4 AC2) |

## 8. File & integration plan

```
.claude/skills/a2ui-component-patterns/  a2ui-composition/  a2ui-jsonl-mcp/  a2ui-corpus-authoring/
.claude/agents/  a2ui-catalog-author.md  a2ui-payload-composer.md  a2ui-corpus-curator.md
docs/specs/rubrics/  a2ui-payload-quality.md  catalog-quality.md  corpus-quality.md  a2ui-artifact-map.md
packages/agent-ui/a2ui/tools/  gates/{a2ui-validate,corpus-leak,version-pin}.ts  governance-check.py  loop/compose-verify.ts
```

**Integration:** gates compose the renderer's `validate.ts` and the corpus store's leak/pin checks (no forks — parity). The loop driver dispatches the agents (LLD-C2), conditions them via the corpus exporters/retriever (`a2ui-corpus-store` LLD), and verifies via gates (LLD-C4) + rubrics (LLD-C3). The governance check wraps the harness skills' `harness_checks.py` + `trace_check.py`.

## 9. Build sequence (dependency-ordered; each step verifiable)

1. **LLD-C4 gates** — first: the shared validator must exist (renderer LLD step 1); wrap it + leak/pin; CI + hook. *(checkpoint: 0 known invalid classes pass — SPEC-R4 AC1 / PRD-G4)*
2. **LLD-C3 rubrics** — author via `authoring-rubrics`; each passes the rubric gate; `corpus-quality` wired as corpus tier-2. *(checkpoint: rubric gate green)*
3. **LLD-C1 skills** — author via `authoring-skills`; run the trigger eval. *(checkpoint: routing ≥ 90% — SPEC-N2)*
4. **LLD-C2 agents** — author via `authoring-agents`; each names its rubric, scoped tools, model. *(checkpoint: `harness_checks.py agent` green; reference artifact ≥ 4/5 — SPEC-N4)*
5. **LLD-C5 orchestration** — artifact map + frontmatter cross-refs; reachability (no orphan). *(checkpoint: governance reachability green)*
6. **LLD-C6 loop driver** — wire generate→gate→rubric→self-correct with `maxRounds`; corpus conditioning on. *(checkpoint: a failing artifact is corrected or the loop halts bounded — SPEC-R6)*
7. **LLD-C7 governance check** — placement + authored-via-harness + reachability as one CI gate. *(checkpoint: a planted self-grading agent + a planted prose true/false both fail)*

**Discovered-reality note:** if the trigger eval cannot reach 90% by description tuning (skills genuinely overlap), that is a SPEC-R1 granularity gap — revise `a2ui-expert-harness.spec.md` §3.1 (merge/split focus areas), do not paper over routing in the loop driver.
