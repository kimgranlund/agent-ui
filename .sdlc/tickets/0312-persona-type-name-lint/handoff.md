---
id: T-0312
title: "Persona text type names are a modality leak: lint them and reword the Croupier persona; pin tests per ruling (P6)"
type: chore           # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-16 (P6): catalog type names in persona text count as a modality leak. The persona lint (`site/pages/agent-admin-presets.test.ts:50-121`) flags them; the Croupier persona (`agent-admin-presets.ts:187`, `:193`) is reworded. One pin test per standing ruling in `.sdlc/notes/notes.md` that has no test yet (the T-0285 pin in `agent-admin-app.test.ts:1049-1056` is the shape). The contract-audit mapping is committed under `.sdlc/evals/fog/`; the audit stays advisory. Source: `.sdlc/work/routing-architecture-review/` (proposals, challenge and rebuttal under `.sdlc/runtime/tasks/routing-architecture-review/`).

## Done when
- The lint test fails on a persona naming a type and passes on the reworded seeds; the new pins are red when their ruling is broken; seedVersion bumped and manifests regenerated where a seed changes; `npm run check` exits 0.
