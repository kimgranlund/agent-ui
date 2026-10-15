---
id: T-0025
title: "Browser-safe projection of the selection sidecars for in-page tooling (ADR-0232 follow-up, GH #1815 item 3)"
type: feature
status: done
size: M
priority: P3
depends: []
created: 2026-10-07
router: .sdlc/AGENTS.md
---

## Goal
GH #1815 item 3: the `selection.json` sidecars (ADR-0232) are loaded only by `src/agent/selection-guidance.ts` (Node-fence rules). In-page tooling (agent-admin, devtools harness page) has no browser-safe projection. Add one, derived from the same sources, never a second source of truth.

## Intent
- Do: a pure, `node:*`-free projection (intents and notFor per type, per catalog id) exported on an existing subpath or the registry model (ADR-0237 `src/registry/`), generated from the sidecars at build time, with a freshness gate; one real consumer or a typed seam test.
- Non-goals: changing sidecar content, prompt bytes (the byte-pinned baseline must not move), the Node loader.
- Done when: `npm run check` and full `npm test` exit 0; `generate:registry` and `generate-agent-assets` rerun if touched; no em dashes. If a ruled contract needs an ADR change, stop and report.

## Context
`packages/agent-ui/a2ui/AGENTS.md` (catalogs, registry, Node fence), ADR-0232, ADR-0236, ADR-0237. Never hand-edit generated files.

## Constraints
Imports point inward only; no new dependency; `src/agent/` stays free of `node:*`.


## Closed

2026-10-07: Merged in #1849
