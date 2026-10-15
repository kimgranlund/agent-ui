---
id: T-0139
title: "Dogfood: one fleet disabled recipe for button, switch, checkbox, radio, toggle and pagination"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
From the T-0137 dogfood design review (Kim asked for it after catching sharp badges and a rectangular icon button). Every disabled control reads wrong: a disabled switch loses its track, a checkbox loses its box, a checked radio goes darker than enabled, a disabled primary button is louder than the enabled button beside it.

## Scope (one brief paragraph, per the Inner loop rule)
One recipe for all: keep the variant's silhouette and outline at outline-variant, low-emphasis container (the existing *-container-disabled roles in shared/src/tokens/tokens.css) and low-emphasis ink (*-on-surface-disabled), so a disabled control is always quieter than every enabled sibling and locked-on still differs from locked-off. Your files: button, switch, checkbox, radio, toggle and pagination css (and their tests and descriptors). Add a browser test per control that disabled ink contrast is below the same control enabled. Leave toggle's label alignment alone (Kim kept it). Findings: read the ## Findings sections of .sdlc/dogfood-design-review/part-{a,b,c}/ui-designer-L1.md and fix every finding whose cause file is in your list (each finding names the screenshot, the cause and the fix; screenshots are in .sdlc/dogfood-design-review/shots/). Where a finding proposes a measurable rule, add it to scripts/dogfood-rules.json only if that file exists on main; otherwise list the rule in your report for T-0136. Stay inside your file list; another lane owns the rest, and a finding that needs a file outside your list is reported, not fixed. Root n 5 / 6 / 7. Local gate: npm run check, census, probe --strict, the touched folders' unit and browser tests through gate_lock.py in the foreground, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots of each fixed finding at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed / not fixed (why), exit codes, and the shots folder.

## Closed

2026-10-13: merged as #1955
