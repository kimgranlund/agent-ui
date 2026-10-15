---
id: T-0119
title: "A2UI canvas on the widget tier at scale md; revert the size step-down stamps (ADR-0245 Amendment)"
type: feature
status: done
size: L3
priority: P1
depends: []
created: 2026-10-13
router: .sdlc/AGENTS.md
---

## Goal
Kim 2026-10-13: the A2UI surface root uses data-tier="widget" data-scale="md" (sm / md / lg = 24 / 28 / 32, the same n as the page root), not product/md with hand-shifted stamps. 'The scale shifts down one whole step so 32 will be 28, which is fine for widget cards.'

## Scope (one brief paragraph, per the Inner loop rule)
Switch the A2UI surface root (packages/agent-ui/app/src/controls/surface-host and wherever data-scale="md" was set by the cut) to data-tier="widget" data-scale="md" and add the matching ADR-0245 Amendment 2 (append-only; supersedes the 'A2UI canvas at data-scale md' ruling). Revert the cut's one-step-down size stamps in packages/agent-ui/a2ui (commits 64244198 and c445e1e9: actionRowButtons back to the original stamps, unsized catalog Buttons and BookingForm fields default size again, not sm), so the factories mean what they say again: lg is 32, md 28, sm 24 on a canvas. Re-pin the A2UI tests (box-region, concierge, checkbox-group-layout, persona tests), regenerate parity shots of the A2UI widgets (BookingForm, CardTable, QuestionCard, ProductCard, ResultCard, ContrastPair) before and after at 400px and 1000px light and dark into the ticket folder, and re-mint only the a2ui and app goldens that move after eye review. Local gate: npm run check, the touched folders' tests, the app and rest browser shards and the visual shard; no per-ticket verifier; regenerate generated files with scripts; no em dashes; commit locally, do not push; report in one short message with the changed px per widget.

## Closed

2026-10-13: merged as #1936
