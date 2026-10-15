---
id: T-0014
title: "Build-time asset embed for the producer toolkit: ship ./agent, generate the Worker shim (GH #1808)"
type: feature        # feature | bug | chore | spike | idea
status: done     # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: M              # S | M | L | XL
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The a2ui ./agent toolkit reads prompts and selection sidecars from repo-relative paths at process.cwd(); the Worker mirrors them through a hand-listed packages/agent-ui/a2ui/tools/agent/worker/fs-shim-content.ts (FILES/DIRS) kept honest by fs-shim.test.ts; scripts/publish/publish-packages.mjs drops ./agent from the npm exports for exactly this reason. One generated embed step, discovering assets (

## Intent
- Do: design only in this lane (architect then plan); no build until the no-barrels wave (#1814) has merged, because it edits the same generated surface.
- Non-goals: any build or merge before the design is reviewed.
- Done when: an architect result and a reviewed plan exist, or the first design fork is recorded for Kim.

## Context
GH #1808: full text via `gh issue view 1808`. Origin: the 2026-10-05 generative-systems review of agent-ui. Epic: GH #1817. Read `.sdlc/rollout-2026-10-05.md` and `.claude/docs/references/agent-model.md` first. Evidence in the issue is from a review: verify before building. Related designs: ADR-0232 (selection sidecars), ADR-0233 (no barrels, ratified), `.sdlc/work/no-barrels/`.

## Constraints
No key reaches a headless run (ADR-0073); no em dashes; ADRs never self-ratified; accepted ADRs and dated reports are historical.

## Rulings
- Kim ruled 2026-10-05: dogfood fleet snapshot is a2ui-owned derived rows (deletes the Worker shim; descriptor edits red an a2ui freshness gate until regen). Architect: `architect-L1.md`.
- Plan is design-only until the no-barrels wave (#1814) merges: a build step must not start before then; record that as a `Depends on` line in step 1.

## Closed

2026-10-06: Merged to main in #1834
