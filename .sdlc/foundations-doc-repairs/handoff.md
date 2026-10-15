---
id: T-0118
title: "Repair the records the foundations cut invalidated (ADR-0245 booked repairs, issue 1915)"
type: chore
status: done
size: L2
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
ADR-0245 is accepted and the cut is on main (#1932). Stale context is a defect: execute the booked repairs in GitHub issue #1915 (read it with gh issue view 1915; its checklist is the ADR's own Repairs cell) so every record matches the shipped system, and tick each box when done.

## Scope (one brief paragraph, per the Inner loop rule)
Docs, descriptors and skills only, no production code: (1) ADR header edits, bodies untouched: ADR-0046, ADR-0078, ADR-0007, ADR-0015 cl.5 and ADR-0018 gain Partially superseded by ADR-0245; ADR-0223 gains Extended by ADR-0245; ADR-0038, ADR-0041 and ADR-0150 flip to superseded now the cut has landed (use scripts/adr_ratify.py conventions and the doc-standards skill; if the adr-status-guard hook or a gate refuses an edit, stop and report it, never bypass); (2) references geometry.md, geometry-sizing-spec.md, naming.md section 12, tokens.md, dimensional-standard.md, and rubrics/component.md rewritten to the derived system (one n, tiers, the pill exception, the 2n icon and 2n - 2c glyph boxes, A2UI surfaces at data-scale md, data-foundations legacy opt-out); (3) AGENTS.md (Never hand-edit gains foundations.gen.css and foundations-bridge.gen.css) and CLAUDE.md (the Inner loop ramp line becomes sm 24 / md 28 / lg 32 and the A2UI canvas note: actions are the md step 36px); (4) the skills component-standards, component-design, component-patterns, fleet-review and seat-map where they state the old ramp, [scale], [density] or the glyph prop; (5) every control descriptor geometry: line that still names the old ramp or [scale]/[density] (grep packages/agent-ui/components/src/controls/*/*.md); (6) .sdlc/notes.md deferred items turned into one GitHub issue each only when they are real follow-ups (final cleanup after one release, swatch size ruling, body-small and label-small roles, part-level sizes in service-card, product-card and board-grid, nav-rail ui-glyph chevron, badge marks to ui-glyph). Gate: docs-only diffs gate on doc_lint plus npm run check; if an ADR title or index changes also regenerate the sitemap indexes (node scripts/generate-sitemap.mjs). No em dashes anywhere. Commit locally, do not push, no per-ticket verifier; report in one short message with what you ticked in issue 1915.

## Closed

2026-10-13: merged as #1934
