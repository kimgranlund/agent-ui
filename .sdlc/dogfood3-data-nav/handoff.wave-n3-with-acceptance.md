---
id: T-0149
title: "Dogfood round 3: table scroll cue, stat rings, gauge legend, chart inks and empty states, bar-chart zero rule, calendar, timeline, overflow triggers, carets to glyphs"
type: bug             # feature | bug | chore | spike | idea
status: ready
size: L3
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 3 of the dogfood fixes (Kim 2026-10-14: fan out the pass-2 findings, T-0145).

## Scope (one brief paragraph, per the Inner loop rule)
Your files: table (edge-fade scroll cue at narrow widths, like ui-card-content), stat (one ring diameter per row), gauge (legend near its rings; empty state), _chart/chart-axis.css (series 1 and 2 inks more than one ramp step apart; chips readable on bars), column-chart and bar-chart (empty states; bar-chart diverging zero rule), calendar (the capped panel aligns to the text edge, not centred; disabled versus outside inks distinct; its carets become ui-glyph), timeline-item (active dot and done disc read as one set), tabs and breadcrumb (overflow trigger has a resting shape), pagination (stop ink), disclosure and form-popover (carets become ui-glyph), and their descriptors and tests. Findings: read the ## Findings of /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/dogfood-review-2/part-{a,b,c}/ui-designer-L1.md (absolute paths, in the main checkout) and fix every NEW finding and every partly-fixed pass-1 finding whose cause file is in your list; screenshots are in /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/dogfood-review-2/shots/. Standing rulings (do not reopen): pills for single-line controls and chips, square entry cells round squares at radius n, icon-only buttons round, segmented pill, icon versus glyph (glyph box max(8px, 2n - 2c); a mark like a caret, tick or chevron is a glyph in ui-glyph, not a Phosphor icon), one fleet disabled recipe, field outline role at least 3:1, cards keep their level radius, the full-width toggle label, the slider thumb, agent-admin's uppercase provider headings. Do NOT edit scripts/dogfood-rules.json, the render or compose lint or dogfood-lint.md, except to delete an allowlist line your change clears; list every measurable rule in your report instead (a later lane adds them). Stay inside your file list; report a finding whose cause is outside it. Root n 5 / 6 / 7. Local gate, foreground, through gate_lock.py: npm run check, census, probe --strict, touched folders' unit and browser tests, the render lint, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots per fixed finding at 400 and 1000, light and dark, viewed, not committed. A one-line progress message after each major step. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed or not (why), exit codes, proposed rules.

## Acceptance criteria
- `npm run check` exits 0.
- `node scripts/foundations-census.mjs --gate` exits 0.
- `node scripts/foundations-probe.mjs --strict` exits 0.
- `npx vitest run packages/agent-ui/components/src/controls/table packages/agent-ui/components/src/controls/stat packages/agent-ui/components/src/controls/gauge packages/agent-ui/components/src/controls/_chart packages/agent-ui/components/src/controls/bar-chart packages/agent-ui/components/src/controls/column-chart packages/agent-ui/components/src/controls/pie-chart packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/timeline-item packages/agent-ui/components/src/controls/tabs packages/agent-ui/components/src/controls/breadcrumb packages/agent-ui/components/src/controls/pagination packages/agent-ui/components/src/controls/disclosure packages/agent-ui/components/src/controls/form-popover` exits 0.
- `npx vitest run --config vitest.browser.config.ts --project packages packages/agent-ui/components/src/controls/table packages/agent-ui/components/src/controls/stat packages/agent-ui/components/src/controls/gauge packages/agent-ui/components/src/controls/bar-chart packages/agent-ui/components/src/controls/column-chart packages/agent-ui/components/src/controls/calendar packages/agent-ui/components/src/controls/timeline-item packages/agent-ui/components/src/controls/tabs packages/agent-ui/components/src/controls/breadcrumb packages/agent-ui/components/src/controls/pagination packages/agent-ui/components/src/controls/disclosure packages/agent-ui/components/src/controls/form-popover packages/agent-ui/components/src/controls/card/containers-foundations.browser.test.ts` exits 0 (each new T-0149 browser test is the finding's measurable: equal ring diameters, legend gap, empty marks, zero rule, start-aligned cap, struck disabled day, one marker diameter, neutral stop ink, edge fade).
- `npx vitest run --config vitest.browser.config.ts --project site site/pages/dogfood-render.browser.test.ts` exits 0 (the render lint).
- `npx vitest run --config vitest.browser.config.ts --project visual` exits 0 after the goldens this change moves are re-minted one file at a time and viewed.
