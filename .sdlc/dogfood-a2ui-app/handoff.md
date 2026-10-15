---
id: T-0142
title: "Dogfood: composer icons, Basic Column gap, CardTable action row, ProductCard badge, admin model rows and demo frames"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
From the T-0137 dogfood design review (Kim asked for it after catching sharp badges and a rectangular icon button). Part A findings on the A2UI widgets and the app shell.

## Scope (one brief paragraph, per the Inner loop rule)
Your files: packages/agent-ui/app/src/controls/conversation/ (composer picker icons), packages/agent-ui/app/src/controls/agent-admin/ (model rows, provider headings), a2ui-basic/factories.ts (Basic Row and Column get the widget gutter by default) and its catalog tests, personas/croupier/factories.ts (the action buttons wrap as one group), product-card (css; badge over image gets an opaque fill, header icon), site/pages/containers.css, site/lib/specimens.ts, site/pages/{game-hud,result-card,product-card}-demo.ts, site/pages/a2ui-chat.css (empty-state lines and header). Regenerate agent assets and the registry projection by script if a factory default changes; watch the K6 prompt budget. Findings: read the ## Findings sections of .sdlc/dogfood-design-review/part-{a,b,c}/ui-designer-L1.md and fix every finding whose cause file is in your list (each finding names the screenshot, the cause and the fix; screenshots are in .sdlc/dogfood-design-review/shots/). Where a finding proposes a measurable rule, add it to scripts/dogfood-rules.json only if that file exists on main; otherwise list the rule in your report for T-0136. Stay inside your file list; another lane owns the rest, and a finding that needs a file outside your list is reported, not fixed. Root n 5 / 6 / 7. Local gate: npm run check, census, probe --strict, the touched folders' unit and browser tests through gate_lock.py in the foreground, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots of each fixed finding at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed / not fixed (why), exit codes, and the shots folder.

## Closed

2026-10-13: merged as #1957
