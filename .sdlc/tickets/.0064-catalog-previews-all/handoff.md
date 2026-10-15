---
id: T-0064
title: "A2UI catalog preview: a catalog selector covering a2ui-basic and the persona catalogs, with a coverage gate"
type: feature        # feature | bug | chore | spike | idea
status: done        # proposed | ready | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-12
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The A2UI catalog preview shows every shipped catalog, not only the default `agent-ui` one, with a seeded example for every component type, and a gate fails when any catalog type has no example. The six renderer pages that do not warm the lazy catalog stop being at risk of an empty canvas.

## Intent
- Audit evidence (2026-10-12): `site/pages/a2ui-catalog.ts` derives its 73 browsable cards from `defaultCatalog` only. `a2ui-basic` (14 types) has seeds (13, `Card` excluded on purpose at `basic-exemplars.ts:15`) but no page. Persona fragments have zero seeds: concierge (BookingForm, BookingConfirmation), croupier (PlayingCard), fixture-demo (FixtureBanner). Derived catalogs (base--persona) are not enumerated. Type coverage is gated only for the default catalog (`examples.test.ts:421`, GH #729). 29 default types have exactly one gallery seed (Tabs, Modal, Toast, Popover, Tooltip, FormPopover, ChoiceGroup, Slider, Rating, SliderMulti, ComboBox, MultiSelect, Split, BarChart, PieChart, ColumnChart, Gauge, Pagination, SourceList, Suggestions, FileDrop, Video, AudioPlayer, Ramp, Ladder, Toolbar, ColorPicker, Drill, Breadcrumb). Pages that call createRenderer without importing `site/lib/warm-catalog.ts`: a2ui-patterns, a2ui-list, a2ui-canvas, a2ui-chat, a2ui-authoring, gallery (cold behavior unverified; the gate `site/lib/warm-catalog.test.ts` pins only 7 entries). Stale comments: `site/lib/a2ui-catalog-tiers.ts:3` says 60 types (real 73; INPUT 18, PATTERN 18), `site/pages/a2ui-catalog.ts:6-9` says 54-item list.
- Do: (1) a catalog selector on the preview page (default `agent-ui`; `a2ui-basic`; each persona fragment; and the derived `base--persona` catalogs the registry exposes), reading the registry/manifest so a new catalog appears without editing the page, rendering each type through the same lazy-warm path; (2) example seeds for every persona type and for `a2ui-basic` types that lack one (Card stays a documented exemption); (3) a coverage gate over EVERY shipped catalog, enforcing (fails on a type with no example), with an explicit allowlist that has a residue guard like the existing ones; (4) verify cold-load behavior of the six unwarmed pages with a real check; add the warm import and extend the `WARM_ENTRIES` gate where a page reads its mount synchronously after ingest; (5) repair the stale counts and comments; (6) update the owning skill (`.claude/skills/a2ui-catalog-rendering-review/**`) and the rubric if their steps change.
- Non-goals: new catalog types or props; the renderer; the 29 single-seed variant seeds (optional later); the agent-admin Catalogs shelf.
- Done when: `npm run check` and full `npm test` (--maxWorkers=4) exit 0; the touched real-engine test file(s) pass in their browser shard run alone (`npm run test:browser` shard that owns them, one at a time); sitemap/registry/llms regenerated if affected (`node scripts/generate-sitemap.mjs`, `node scripts/generate-llms-full.mjs`, `npm run generate:registry`, `node scripts/generate-agent-assets.mjs` if a sidecar changes); the new gate is red at base (prove with a seeded missing example) and green after; no em dash in any added line; records repaired in the same change. A screenshot of the selector page for each catalog saved under `.sdlc/0064-catalog-previews-all/shots/` (do not commit).

## Context
Read first: `site/pages/a2ui-catalog.ts`, `site/lib/a2ui-catalog-tiers.ts`, `site/lib/component-preview-catalog.ts`, `packages/agent-ui/a2ui/src/examples/**` (including `basic-exemplars.ts`, `allSeeds`), `packages/agent-ui/a2ui/src/catalog/**`, the persona fragments and `packages/agent-ui/a2ui/src/registry/**`, `site/lib/warm-catalog.ts` and its test, ADR-0241 (+ Amendment 1), ADR-0169, skills a2ui-catalog-rendering-review and a2ui-multi-catalog, rubric `.claude/docs/rubrics/a2ui-catalog-example.md`. Never hand-edit generated files. Selected by Kim 2026-10-12 (AskUserQuestion: "Full job: add a catalog selector").

## Constraints
Imports point inward only (site may import a2ui; a2ui must not import site). No new runtime dependency. Components stay light DOM; ARIA via ElementInternals; the selector uses existing ui-* controls. Keys and produce() never enter devtools. Commit in worktrees; PRs merge on CI green plus one verifier pass (close-first).

## Closed

2026-10-12: Merged in #1888; steps 1-3 verified, step 4 gates green, no source change
