---
id: T-0008
title: "Selection guidance for the genui dogfood inventory (GH #1815 item 3, needs a design decision)"
type: feature        # feature | bug | chore | spike | idea
status: done
size: M
priority: P3
depends: []
created: 2026-10-05
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Decide and, if warranted, build selection guidance for the genui dogfood inventory. Tracks GH #1815 item 3 (second part). This is a design question first; use `find-intent` or an architect before any build.

## Intent
- Do: settle the shape (a descriptor-side field versus reusing the catalog sidecar through a tag mapping), the byte and budget effect, and whether it needs an ADR-0232 amendment (proposed, never self-ratified); then build.
- Non-goals: the browser-safe projection of the sidecars (separate optional ticket).
- Done when: a decision is recorded and, if building, `prompt-drift.test.ts` and the parity test cover the new behavior.

## Context
`packages/agent-ui/a2ui/src/agent/dogfood-inventory.ts` (387 lines): `dogfoodInventory()` (about lines 375-384) renders `- tag, summary (attrs: ...)` from descriptors; it carries no guidance and is never byte-captured; it is guarded by the drift and parity tests. The A2UI catalog inventory carries guidance since PR #1800. Unverified: the intended shape and the clause total against `SELECTION_GUIDANCE_CHAR_BUDGET = 8_600`.

## Constraints
Stay Node-only and inside the `src/agent/` fence (relative or `node:*` imports); do not touch the catalog baseline; ADR-0232 changes are proposed only; no em dashes.

## Scrub and upsert list
`.claude/docs/adr/0232-catalog-selection-guidance-sidecar.md` (the dogfood follow-up bullet); `.claude/skills/a2ui-prompt-authoring/SKILL.md` (about line 56), `a2ui-build`, `a2ui-multi-catalog`, `component-catalog`, `a2ui-payload-authoring`; `.claude/agents/a2ui-build-agent.md`, `a2ui-payload-authoring-agent.md`; `.claude/docs/references/agent-model.md`; `.claude/docs/spec/a2ui-catalog.spec.md`; `packages/agent-ui/a2ui/AGENTS.md`: stale only if the contract changes.

## Dependencies and conflicts
Same-doc contention with T-0003 and the sidecar rewrite. If a descriptor field is chosen it touches the descriptor schema and the no-barrels and registry design (GH #1814, #1807): decide after that architect report.

## Size and lane
M; design first (architect or `find-intent`), then `solo`.

## Acceptance outline
A recorded decision; if built: new behavior covered by `prompt-drift.test.ts` and the dogfood parity test, `npm run check` and a2ui tests exit 0, scrub list applied.

## Rulings
- Kim ruled 2026-10-05: FULL clause (use and not-for on every dogfood row, about +8.4k chars per turn, `DOGFOOD_GUIDANCE_CHAR_BUDGET` 8800 and SPEC-R13(b) amendment). Architect: `architect-L1.md`.
- Plan is design-only until the no-barrels wave (#1814) merges: a build step must not start before then; record that as a `Depends on` line in step 1.

## Closed

2026-10-07: Merged in #1825
