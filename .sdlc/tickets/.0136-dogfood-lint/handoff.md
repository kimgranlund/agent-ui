---
id: T-0136
title: "Dogfood lint: a computed-style render lint and a composition lint, gated like the census"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: [T-0134, T-0135]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim 2026-10-13: "we need some kind of linter strategy that ensures dogfooding standards are adhered to". Her dogfood catches (sharp badges and selects, a rectangular icon button, a hand-built date field) were all measurable, so make them gates, not reminders. Starts after T-0134 (pill radius) and T-0135 (date input) merge, so the rules encode those rulings.

## Scope (one brief paragraph, per the Inner loop rule)
Layer 1, render lint: one rules table `scripts/dogfood-rules.json` (each rule: id, the ADR clause it enforces, selector or role, the measure, the expected value derived from scale.mjs resolve() at the element's register) and one browser test in the site shard that visits every docs demo page and every A2UI catalog widget at 400 and 1000px, light and dark, and checks getComputedStyle: radius by role (pill h/2 for single-line controls and chips, concentric for panels, level radius for cards), icon-only buttons square, no text under the type floor, no element past the content column at 400 (reuse the escapees() predicate), no ui-card directly inside a ui-card, control heights on the ramp, text edge 2n - c. Layer 2, composition lint: a Node script over A2UI factories, seeds, presets and site demos with a "use X, not Y" table (a ui-calendar plus ui-button standing in for a date field means ui-text-field type=date; a Grid of cell Buttons means BoardGrid; inline style geometry), joined to check:scripts. Both layers get an allowlist where every entry carries a reason, a stale-entry check, and a negative control per rule proving it fails (an injected violation turns the gate red), all modelled on scripts/foundations-census.mjs. Day one may allowlist current violators with reasons; report how many. Document the strategy in .claude/docs/references/ (one page: the four layers, how to add a rule, how a ui-designer review finding becomes a rule) and add a line to AGENTS.md Gates. Local gate: npm run check, the new tests, the site shard, each in the foreground (gate_lock.py); send the conductor a one-line progress message after each major step; commit locally, do not push, no per-ticket verifier, no em dashes.

## Closed

2026-10-13: merged as #1953
