---
id: T-0381
title: "PlayingCard size sm renders its index under the type floor (round 12 cluster N)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
No agent can choose PlayingCard size sm: the croupier catalog offers md and lg only. ui-playing-card itself is unchanged from main.

## Intent
- Ruling (Kim 2026-10-19): drop sm from the catalog instead of enlarging its index; the 9px floor on the control was built, verified and then reverted.
- Do: remove "sm" from the PlayingCard size enum in `packages/agent-ui/a2ui/src/catalog/personas/croupier/catalog.json` (the only catalog that exposes PlayingCard); regenerate what derives from catalogs (`npm run generate:registry`, `generate-agent-assets.mjs`, `generate-agent-content.mjs`: all wrote no diff, the enum is not embedded).
- Done when: a croupier test shows a PlayingCard with size sm fails `validateCatalogConformance` (CATALOG at `<id>.size`) on both bases while md and lg pass; `git diff main -- packages/agent-ui/components scripts` is empty; the a2ui package tests, the dogfood render lint and `npm run check` exit 0.

## Acceptance criteria
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/index.test.ts` exit 0 (red on main: sm accepted)
- `npx vitest run packages/agent-ui/a2ui` exit 0
- `git diff 4d5a18d43 --exit-code -- packages/agent-ui/components scripts` exit 0
- `npm run check` exit 0

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster N: `five-card-draw-haiku-1` (:63 to :72) sizes every PlayingCard sm; the render lint reads the index at 7.875px and the pip at 8.4px. T-0189 exempted the corner index as card art at the default size only.

## Constraints
No one-off heights (ADR-0245 ramp). Kim approves a visible change by screenshot.

## Outcome

2026-10-20 · lane: full L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 4d5a18d43fe1
- Changed: see commits
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/index.test.ts` exit 0 (red o...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui` exit 0: pass
- Check: 3 `git diff 4d5a18d43 --exit-code -- packages/agent-ui/components scripts` exit 0: pass
- Check: 4 `npm run check` exit 0: pass
- Follow-up: note: the croupier catalog is the only catalog.json that declares... -> notes.md
- Follow-up: note: generate-agent-assets.mjs --check and generate-agent-content.mjs... -> notes.md
