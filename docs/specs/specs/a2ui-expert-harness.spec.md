# SPEC — A2UI Expert Harness (agents · skills · rubrics · gates)

> Status: proposed · v0.1 · 2026-06-26 · Layer: SPEC (execution contract)
> Refines: [`../a2ui-expert-system.prd.md`](../a2ui-expert-system.prd.md) — primarily **PRD-G3, PRD-G4**; supports PRD-G6. Honors Constraint **C3** (governance via the local `authoring-*`/`agent-*` skill family + `process.md`).
> Refined by: [`../llds/a2ui-harness-wiring.lld.md`](../llds/a2ui-harness-wiring.lld.md).
> Altitude: owns *what authoring capabilities exist and how they compose + verify*. The concrete files/frontmatter/CI wiring are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Define the **expert system** that makes A2UI authoring guided and graded (PRD-G3) and its output provably valid (PRD-G4): the domain-expertise **skills**, authoring **agents** (subagents), eval **rubrics**, and deterministic **gates**, and how they discover, compose, and verify each other.

This mirrors `process.md`'s governing model, applied to *authoring A2UI* instead of *authoring components*: anything with a true/false answer is a script/hook (never agent judgment); judgment grounds against a small rubric; progressive disclosure keeps context economical; the generator and the critic are never the same actor.

## 2. Definitions

- **Skill** — a `SKILL.md` procedure (progressive disclosure: description always loaded, body on demand), authored via `authoring-skills`.
- **Agent** — a subagent that *makes* an A2UI artifact in an isolated context, authored via `authoring-agents`.
- **Rubric** — a referential scoring standard, authored via `authoring-rubrics`; the thing judgment checks against.
- **Gate** — a deterministic script/hook returning pass/fail (schema, catalog, id-graph, pointer, leak, version-pin).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 The capability inventory

**SPEC-R1 — Domain-expertise skills.** The harness MUST provide skills covering the four focus areas: (a) **A2UI core component patterns** (idiomatic node shapes per catalog type); (b) **composability into modules** (adjacency-list trees, `ChildList` templating, data binding, actions/checks); (c) **JSONL + MCP workflows** (stream serialization, MCP serving/validation/retrieval); (d) **training-corpus authoring** (create/maintain per the corpus SPEC). Each MUST be a progressive-disclosure `SKILL.md` with a routing description. *(→ PRD-G3)*
- **AC1** *Given* the four focus areas, *when* the skill set is inventoried, *then* each area has ≥1 skill whose `description` states its trigger and whose body loads on demand (passes `harness_checks.py skill`).
- **AC2** *Given* a representative trigger eval set, *when* run, *then* routing accuracy ≥ 90% (PRD-G3 metric).

**SPEC-R2 — Authoring agents.** The harness MUST provide subagents that MAKE A2UI artifacts: a **catalog author** (define/extend a catalog + factories), an **A2UI payload/stream composer** (emit valid `createSurface`→`updateComponents`→`updateDataModel` streams with bindings/actions/checks), and a **corpus curator** (source/canonicalize/admit per corpus SPEC). Each MUST declare a scoped `tools:` list, a `model:`, and a when-to-dispatch description, and MUST name the rubric it is graded by. *(→ PRD-G3)*
- **AC1** *Given* each agent file, *when* checked, *then* it passes `harness_checks.py agent` (scoped tools, model set, trigger description, no enforcement-in-prose).
- **AC2** *Given* an agent, *when* it produces an artifact, *then* the artifact is scored by a *separate* rubric/critic, never by the producing agent (SPEC-R8).

**SPEC-R3 — Eval rubrics.** The harness MUST provide rubrics: **A2UI-payload-quality**, **catalog-quality**, and **corpus-quality** (the corpus admission tier-2 gate). Each MUST type its dimensions `[gate]`/`[review]`, carry anchors, and state an aggregation/gate rule (passes `harness_checks.py rubric`). *(→ PRD-G3, PRD-G4)*
- **AC1** *Given* each rubric, *when* checked, *then* it passes the rubric gate and names which gated dimensions must clear to promote.
- **AC2** *Given* two authors scoring the same artifact with a rubric, *when* compared, *then* scores agree within the rubric's calibration tolerance.

**SPEC-R4 — Deterministic gates.** Every true/false correctness check MUST be a script/hook, not agent judgment: A2UI schema, catalog-conformance, single-root/acyclic id-graph, JSON-pointer validity, corpus leak, and version-pin. Gates MUST run in CI and MUST be the same implementations used at runtime (the shared validator) and in corpus admission. *(→ PRD-G4)*
- **AC1** *Given* a labelled invalid-payload set, *when* the gates run, *then* 0 known invalid classes pass (PRD-G4 target) and each failure reports its code.
- **AC2** *Given* the validator, *when* invoked from a gate, the renderer, and corpus admission, *then* all three return identical verdicts (parity).

### 3.2 How they compose & verify

**SPEC-R5 — Discovery & composition (orchestration).** Skills, agents, rubrics, and gates MUST discover and compose through declared wiring (frontmatter + descriptions), with an explicit skill-vs-subagent boundary: a skill captures a *procedure*; a subagent is dispatched for *isolated making*; a rubric is *referenced* for judgment; a gate is *invoked* for a true/false check. The wiring MUST be authored via `orchestration-design`. *(→ PRD-G3)*
- **AC1** *Given* the artifact set, *when* the orchestration map is inspected, *then* every agent names its grading rubric, every skill names the gates/rubrics it invokes, and no capability is unreachable (no orphan).

**SPEC-R6 — Generation→verification→self-correction loop.** The harness MUST encode A2UI's prompt→generate→validate→self-correct loop: an agent generates an artifact conditioned by the corpus (few-shot/retrieval), the deterministic gates + the relevant rubric verify it, and on failure the agent self-corrects before the artifact is accepted. The loop MUST be bounded (a stop condition). *(→ PRD-G3, PRD-G4)*
- **AC1** *Given* a generation task, *when* the loop runs, *then* an artifact is accepted only after passing its gates and meeting its rubric bar, or the loop halts at its bound and reports the failure (no unbounded retry).

**SPEC-R7 — Authored-via-harness + governance.** Every skill/agent/rubric MUST be authored with the corresponding authoring skill (`authoring-skills` / `authoring-agents` / `authoring-rubrics`) and score ≥ its rubric bar; every artifact MUST obey `process.md` placement (deterministic→script/hook; judgment→rubric; procedure→skill). *(→ PRD-G3; Constraint C3)*
- **AC1** *Given* each authored artifact, *when* scored by its authoring-skill rubric, *then* it clears the gated dimensions; *when* placement is checked, *then* no true/false check lives in agent prose.

**SPEC-R8 — Generator/critic separation.** No agent MAY grade its own output. Verification MUST be performed by a deterministic gate or a separate critic/rubric invocation in an independent context. *(→ PRD-G4)*
- **AC1** *Given* an agent's artifact, *when* it is verified, *then* the verifier is a gate or a distinct critic — never the producing agent's self-assessment.

---

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Progressive disclosure | Skill/agent descriptions are always-loaded; bodies/rubrics/scripts load on demand; no rubric or corpus content sits in always-on context (context economy per `process.md`). |
| **SPEC-N2** | Routing accuracy | The skill set routes a trigger eval set ≥ 90% to the correct capability (PRD-G3). |
| **SPEC-N3** | Zero false-pass | Gates admit 0 known invalid-payload classes (PRD-G4); a false pass is an incident that stales the responsible gate. |
| **SPEC-N4** | Reference-artifact quality | Each agent ships a reference artifact scoring ≥ 4/5 on every gated rubric dimension (PRD-G3). |

## 5. Typed contracts

### 5.1 Artifact inventory (the harness's `process.md`-style map)

| Artifact | Kind | Authored via | Verified by | Implements |
|---|---|---|---|---|
| `a2ui-component-patterns` | skill | authoring-skills | skills rubric | SPEC-R1a |
| `a2ui-composition` | skill | authoring-skills | skills rubric | SPEC-R1b |
| `a2ui-jsonl-mcp` | skill | authoring-skills | skills rubric | SPEC-R1c |
| `a2ui-corpus-authoring` | skill | authoring-skills | skills rubric | SPEC-R1d |
| `a2ui-catalog-author` | agent | authoring-agents | catalog-quality rubric | SPEC-R2 |
| `a2ui-payload-composer` | agent | authoring-agents | a2ui-payload-quality rubric | SPEC-R2 |
| `a2ui-corpus-curator` | agent | authoring-agents | corpus-quality rubric | SPEC-R2 |
| `a2ui-payload-quality` | rubric | authoring-rubrics | rubric-for-rubrics | SPEC-R3 |
| `catalog-quality` | rubric | authoring-rubrics | rubric-for-rubrics | SPEC-R3 |
| `corpus-quality` | rubric | authoring-rubrics | rubric-for-rubrics | SPEC-R3 |
| `a2ui-validate` (schema·catalog·idgraph·pointer) | gate | hand + shared validator | parity test | SPEC-R4 |
| `corpus-leak` · `version-pin` | gate | hand + hook | CI | SPEC-R4 |

### 5.2 Agent frontmatter contract (per SPEC-R2)

```yaml
---
name: a2ui-payload-composer
description: Use when composing/streaming an A2UI payload for a given intent + catalog … (trigger phrasing)
tools: [Read, Grep, Glob, Write]          # scoped — no full-toolset inheritance
model: <tier>
---
# graded by: a2ui-payload-quality rubric   (never self-grades — SPEC-R8)
```

### 5.3 Gate interface (per SPEC-R4)

```ts
type GateResult = { pass: boolean; code?: ErrorCode; path?: string; message?: string };
interface Gate { name: string; run(input: unknown, ctx: { catalog?: Catalog }): GateResult[] }
// a2ui-validate composes the shared validator (renderer validate.ts); identical verdict everywhere
```

## 6. Open items (non-normative)

- **Exact skill granularity** (4 skills vs splitting composition/patterns further) is an LLD/authoring call; this SPEC fixes the four *focus areas* must be covered, not the file count.
- **Critic agents** (a dedicated A2UI reviewer subagent vs rubric-only verification) — deferred to the LLD; SPEC-R8 requires *separation*, not a specific critic shape.

## 7. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1, R2, R5, R6, R7, N1, N2, N4 | PRD-G3 (guided + graded authoring) |
| SPEC-R3, R4, R6, R8, N3 | PRD-G4 (provable validity) |
| SPEC-R4 (version-pin), R7 | PRD-G6 (coherence) |

_Covers PRD-G3 fully and co-serves PRD-G4 with the runtime/catalog/corpus SPECs. See [`../README.md`](../README.md)._
