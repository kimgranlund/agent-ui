# ADR-0067 — the expert harness right-sizes onto the realized estate: two skills + the `a2ui-composer`/`a2ui-reviewer` pair; catalog-author/corpus-curator retired; rubrics at `.claude/docs/rubrics/`; gates already realized; the loop is procedural until the live-agent wave

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-03
>
> | Field | Value |
> |---|---|
> | **Status** | accepted *(2026-07-04 — ratified on Kim's "proceed"; the right-sizing survived a full doc-review + a delta re-check [PROMOTE] with zero architectural reopening — one blocker + four majors fixed in the corpus-quality judge's realized-code fidelity, not this ADR's shape; harness_checks spec/lld + coverage --strict + adr_check all green at ratification.)* |
> | **Date** | 2026-07-03 |
> | **Proposed by** | planner (design seat — the expert-harness intake, NEXT item 1) |
> | **Ratified by** | orchestration (host), 2026-07-04 — on Kim's "proceed" + the green gate |
> | **Repairs** | `a2ui-expert-harness.spec.md` v0.1 → v0.2 (R1/R2/R3 home/R4-realized/R5 map fold/R6 split/N2 re-bind — edited this change) · `a2ui-harness-wiring.lld.md` v0.1 → v0.2 (§0 reconciliation table; C4 no-build; C6 split; C7 reshape — edited this change) · `a2ui-streaming-pipeline.lld.md` §1 LLD-C2 row + §3 lead (the loop-driver dependency re-pointed to the live-agent wave — edited this change) · `.claude/agents/a2ui-builder.md` description (the composer/builder routing fence + the stale "rubrics pending" line — build slice h8, gated on ratification) |
> | **Supersedes / Superseded by** | Relates ADR-0060 (the judge seam whose activation trigger is this wave) · the streaming LLD v0.2 (whose LLD-C2 dependency re-points to the live-agent wave's driver) |

## Context

The harness SPEC/LLD were drafted v0.1 on 2026-06-26, before the estate they wire existed. Since then
the tree realized: the corpus store's full admission pipeline with the shared validator as tier-1 and a
standing shard gate (`corpus-data.test.ts`), the `a2ui-builder` build seat whose charter already covers
catalog rows ("add the catalog entry"), the seed shelf + `import-seeds.ts` (a deterministic curator),
the repo rubric home `.claude/docs/rubrics/` (component/element/kernel/template), and the global
authoring/reviewer skill+agent family (`skill-author`/`agent-author`/`rubric-author` +
`skill-reviewer`/`agent-reviewer`/`doc-reviewer`). The v0.1 docs therefore prescribe artifacts that now
exist under other owners (gate scripts, a curator agent), a rubric path that never existed
(`specs/rubrics/`), a Node loop driver that cannot dispatch Claude Code seats, and a skill
(`a2ui-jsonl-mcp`) teaching a producer pipeline the streaming LLD v0.2 deliberately left unbuilt.
Building to the v0.1 letter would duplicate realized surfaces and violate the repo's anti-ceremony
discipline (`process.md`: no agent for what a script decides; no rubric/agent for what a probe checks).

## Decision

We will build the harness at its reconciled, right-sized scope:

1. **Two skills, not four** — `a2ui-compose` (the v0.1 patterns + composition areas merged: one routing
   surface, one procedure, carrying the SPEC-R6 bounded loop) and `a2ui-corpus-curate` (a THIN pointer
   procedure over the realized pipeline). `a2ui-jsonl-mcp` is trigger-deferred to the streaming
   producer wave — a skill must teach a realized workflow, not a planned one.
2. **One maker/critic agent pair, not three makers** — `a2ui-composer` (composes payloads/streams,
   corpus-conditioned, graded by the `a2ui-payload` rubric) and `a2ui-reviewer` (grades ONE a2ui
   artifact — payload, catalog row, or corpus record — against the named rubric; authors the corpus
   judge verdicts). The v0.1 catalog-author is retired (catalog rows are package source —
   `a2ui-builder`'s charter); the v0.1 corpus-curator is retired (its deterministic half is
   `import-seeds.ts` + `admit()`; its judgment half is the judge, ADR-0068). The `a2ui-builder`
   description is repaired in the same change that lands the composer: payload *composition* routes to
   the composer, package/renderer/catalog *code* stays with the builder (mutual fence).
3. **Rubrics live at `.claude/docs/rubrics/`** — `a2ui-payload.md` · `a2ui-catalog.md` ·
   `a2ui-corpus.md`, beside the estate's existing rubrics; the v0.1 `specs/rubrics/` path is corrected.
   `[gate]` dimensions cite the realized deterministic probes; no dimension re-judges a script's verdict.
4. **No harness gate code** — SPEC-R4 is realized by the shared validator + admission's `E_*` codes +
   the standing shard gate; the only new script is the governance/reachability check
   (`scripts/harness_wiring_check.py`, a MANUAL gate per the `npm run size` precedent, ADR-0040 §3,
   with promotion to a standing gate triggered by the first observed wiring-drift incident).
5. **The SPEC-R6 loop is procedural this wave** — encoded in the composer charter + skill body, with
   `tools/harness/validate-payload.ts` (heal + shared validator + default catalog, zero new deps) as
   the deterministic check any seat can run; bounded at `maxRounds = 3`, halt-and-report. The
   PROGRAMMATIC driver is the live-agent wave's (NEXT item 4): a Node script cannot dispatch Claude
   Code seats, and the first real programmatic generator is the live agent itself — streaming LLD-C2's
   "harness LLD-C6" dependency re-points there.
6. **No eval facet this wave** — corpus LLD-C8 keeps its trigger (the first eval record); the harness
   ships no corpus eval records, so the Inspect-AI scoring/lift leg (corpus LLD-C12's second half)
   stays deferred with it. Only the judge half of C12 activates (ADR-0068).

## Consequences

- **The wave is small and honest**: 3 rubrics + 2 skills + 2 agents + 2 small tool surfaces + 1 script
  + the activation run — no duplicated ownership, no artifact whose substrate doesn't exist yet.
- **PRD-G3's "guided + graded" lands without new gate code** — guidance = skills/agents, grading =
  rubrics + critic seats; the deterministic floor was already bought by the corpus wave.
- **Deferred pieces carry named triggers** (jsonl-mcp skill → streaming producer wave; programmatic
  driver + retrieval CLI → live-agent wave; eval/scoring/lift → first eval record; wiring-check
  promotion → first drift incident) — the reserved-arm discipline, not silent scope loss.
- **The v0.1 SPEC's three-agent inventory shrinks** — PRD-G3's metric surface (reference artifacts,
  routing, consistency) is re-read over the pair + skills; if a future need shows catalog authoring
  really wants its own maker seat, that is a new ADR against this one's clause 2.
- **Routing accuracy is a tripwire + read, not a number** — `routing_eval.py` is by its own policy an
  aid; SPEC-N2 v0.2 binds the ≥90% PRD target to the corpus + tripwire + dispositioned read. Cost: the
  metric is less mechanical; benefit: it cannot be gamed by keyword-echo descriptions.
- **Stale → re-verify on the build gate:** `a2ui-builder.md` description (h8 — the routing fence AND
  its stale "the a2ui-specific rubrics land with the expert harness — pending" line) · the SPEC §5.1
  map rows · streaming LLD-C2's re-pointed dependency row (edited this change) when the live-agent
  wave designs its driver.

## Acceptance

- `harness_checks.py spec` and `lld` exit 0 on the v0.2 docs; every v0.1 SPEC-R#/LLD-C# carries a
  ruling in the LLD §0 table with file:line evidence for each REALIZED claim.
- The built wave contains NO `tools/gates/` dir, NO `a2ui-artifact-map.md`, NO catalog-author or
  corpus-curator agent — greppable absences matching clauses 1–4.
- `a2ui-composer.md` and the repaired `a2ui-builder.md` fence each other by name; dispatching "compose
  a payload for X" routes to the composer, "add the catalog entry for X" to the builder.
- `validate-payload.ts` exits 0/1 with structured output on the good/planted fixtures; no new deps.
- The decomp manifest (`a2ui-expert-harness.decomp-v2.json`) passes `coverage_check.py --strict` exit 0.

## Alternatives considered

- **Build the v0.1 letter (4 skills, 3 makers, gate scripts, artifact map, Node loop driver)** —
  rejected: duplicates realized owners (validator, import-seeds, a2ui-builder), creates a gate fork the
  parity probe exists to prevent, and ships a driver that cannot drive (no seat-dispatch API from Node).
- **Fold payload composition into `a2ui-builder` (no new maker)** — rejected: composing a payload is
  corpus-conditioned artifact-making graded by a rubric, not spec-faithful package code graded by
  acceptance rows; one seat carrying both muddies routing and the generator/critic ledger. The pair
  mirrors the proven `component-builder`/`component-reviewer` shape.
- **A separate corpus-curator agent anyway (v0.1 letter)** — rejected: every curation step with a
  true/false answer is already a script; the only judgment is the judge's, and giving the same agent
  both curation and its quality verdict re-creates the generator=critic fault SPEC-R8 exists to ban.
- **Author the jsonl-mcp skill now against the streaming SPEC** — rejected: the producer scope is
  deliberately unscoped until a producer need arrives (streaming LLD v0.2); a skill over an unbuilt
  workflow is fabricated context that will drift before first use.
- **Make the wiring check a standing vitest gate now** — rejected for this wave: vitest's include is
  packages-only and `.claude/` governance is not package behavior; the manual-gate precedent (`npm run
  size`, ADR-0040 §3) fits, with a named promotion trigger instead of speculative wiring.
