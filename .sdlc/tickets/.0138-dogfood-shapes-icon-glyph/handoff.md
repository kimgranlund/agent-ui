---
id: T-0138
title: "Dogfood: OTP round squares, pill segmented control, and icon versus glyph sizing (ADR-0245 Amendment 6)"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
From the T-0137 dogfood design review (Kim asked for it after catching sharp badges and a rectangular icon button). Kim's rulings 2026-10-13: OTP cells are round squares at radius n (square entry cells are not pills); the segmented control is a pill track with a concentric thumb; icon and glyph are two distinct things and the system must say so: a glyph (+, minus, carets, ticks, the HUD and result marks, board corner marks) always sits in its own glyph box 2n - 2c; an icon (pictorial) is the 2n icon box inside a control cell and follows the surrounding text (1em) anywhere else, so an explicit size is honoured. The full-width toggle's centred label stays as is (Amendment 4 deviation kept).

## Scope (one brief paragraph, per the Inner loop rule)
Record the rulings as ADR-0245 Amendment 6 (append-only). In scripts/generate-foundations.mjs scope --md-sys-icon-box to control cells and explicit data-tier regions instead of :root, so a standalone ui-icon falls back to 1em; keep --md-sys-glyph-box everywhere; regenerate. Your files: otp-field, segmented-control, icon, glyph, game-hud, result-card, board-grid (their css, md, tests), the generator and foundations tokens, site/pages/icon-demo.ts and glyph-doc, the table plan-facet segmented nit, the ADR and the review doc .sdlc/mathematical-design-system-review.md (add P14 on icon versus glyph sizing). Findings: read the ## Findings sections of .sdlc/tickets/.0137-dogfood-design-review/part-{a,b,c}/ui-designer-L1.md and fix every finding whose cause file is in your list (each finding names the screenshot, the cause and the fix; screenshots are in .sdlc/tickets/.0137-dogfood-design-review/shots/). Where a finding proposes a measurable rule, add it to scripts/dogfood-rules.json only if that file exists on main; otherwise list the rule in your report for T-0136. Stay inside your file list; another lane owns the rest, and a finding that needs a file outside your list is reported, not fixed. Root n 5 / 6 / 7. Local gate: npm run check, census, probe --strict, the touched folders' unit and browser tests through gate_lock.py in the foreground, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots of each fixed finding at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed / not fixed (why), exit codes, and the shots folder.

## Closed

2026-10-13: merged as #1954
