---
id: T-0205
title: "Context archaeology: how the a2ui producer builds context and routes"
type: spike           # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Question
How does the a2ui producer assemble model context and decide routing (catalog, persona, domain, mini-skill, composite, response type), why is each layer built the way it is, and is that routing stable and resilient as context grows?

## Goal
A map, with evidence, of how the a2ui producer builds model context and decides routing, why each layer exists, and where routing is unstable or will degrade as context grows. Read-only; no code changes.

## Questions
1. Generation: what is generated (assets.gen.ts, dogfood-fleet.gen.ts, selection-projection.gen.ts, registry, catalog.json and selection.json sidecars, catalog/layers.ts and domains, mini-skills, the prompt stack under packages/agent-ui/a2ui/src/agent/prompts/, persona manifests and checks), by which script, from which sources, with which drift gates.
2. Assembly: in what order the per-turn context is built (system prompt layers, catalog projection, mini-skills, persona overlay, history, tool schema for render_surface), with file:line entry points and the prompt budget (prompt-budget.ts).
3. Routing: how catalog, persona, domain, mini-skill, composite and response type are chosen; which are deterministic code and which are left to the model reading prose.
4. Layers: classify each artifact as ontology, taxonomy, registry, manifest, rule (deterministic check) or teaching (prose); where one concept is defined in more than one place.
5. History: why each layer exists (git log, tickets T-0172, T-0193, T-0200, T-0201, T-0202, specs .claude/docs/spec/a2ui-catalog-architecture.spec.md, agent-closed-loop.spec.md, agent-content.spec.md, frozen ADRs as history).
6. Risks: where routing is unstable or degrades as context grows: budget pressure, duplicated or conflicting rules, teaching-only steering that models ignore (evidence: CardTable used only once a check forced it; Concierge and Lexicographer still hand-build Cards after T-0200), order sensitivity, cache breakpoints.

## Output
Findings with file:line and commit evidence, a layer table, a per-turn assembly diagram, and a ranked list of stability risks each with the smallest structural fix (e.g. move a rule from prose to a registry edge or a check).

## Outcome

2026-10-17 · lane: full L1 · verdict: closed by reason (Answered by the archaeologist L1 run in .sdlc/runtime/tasks/context-archaeology/archaeologist-L1.md and the routing architecture review that followed) · verifier: none · base: none
- Changed: see commits
- Commits: none
