---
id: T-0141
title: "Dogfood: gauge, stat, breadcrumb, table, charts, sparkline, timeline, tabs overflow, calendar, card and container demos"
type: bug             # feature | bug | chore | spike | idea
status: ready
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
From the T-0137 dogfood design review (Kim asked for it after catching sharp badges and a rectangular icon button). Part C findings on data display, charts, navigation and containers.

## Scope (one brief paragraph, per the Inner loop rule)
Your files: gauge, stat, breadcrumb, table (css and ts), column-chart, sparkline, timeline-item, tabs (overflow trigger only), calendar, card (nested radius), menu, site/lib/component-preview.css, site/pages/_page.css (only the line the finding names), site/pages/{menu,drawer,card,table,stat,sparkline,timeline,gauge,column-chart,bar-chart,calendar,breadcrumb,tabs,pagination}-demo.ts. The coverage gap (open-state shots of modal, drawer, popover, toast) is not a defect: skip it. Findings: read the ## Findings sections of .sdlc/dogfood-design-review/part-{a,b,c}/ui-designer-L1.md and fix every finding whose cause file is in your list (each finding names the screenshot, the cause and the fix; screenshots are in .sdlc/dogfood-design-review/shots/). Where a finding proposes a measurable rule, add it to scripts/dogfood-rules.json only if that file exists on main; otherwise list the rule in your report for T-0136. Stay inside your file list; another lane owns the rest, and a finding that needs a file outside your list is reported, not fixed. Root n 5 / 6 / 7. Local gate: npm run check, census, probe --strict, the touched folders' unit and browser tests through gate_lock.py in the foreground, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots of each fixed finding at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed / not fixed (why), exit codes, and the shots folder.
