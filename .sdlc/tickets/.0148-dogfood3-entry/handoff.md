---
id: T-0148
title: "Dogfood round 3: disabled field borders, filled fills, multi-select box, combo-box mark, select caret glyph, slider disabled, switch off track"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L3
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 3 of the dogfood fixes (Kim 2026-10-14: fan out the pass-2 findings, T-0145).

## Scope (one brief paragraph, per the Inner loop rule)
Kim 2026-10-14: the switch off track gets lighter while keeping at least 3:1 (use the field outline role for its edge or an equivalent that measures 3:1; amend the ADR-0059 note in switch.css). Your files: text-field, textarea, otp-field, select, combo-box (disabled fields keep their boundary in the disabled recipe; textarea and otp cells keep one idle fill whether empty or filled; combo-box paints a trailing disclosure glyph; select's trailing caret becomes ui-glyph), multi-select (the unselected indicator is a square box, not round), slider (disabled state joins the fleet disabled recipe), switch (off track), and their descriptors and tests. Findings: read the ## Findings of /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/tickets/.0145-dogfood-review-2/part-{a,b,c}/ui-designer-L1.md (absolute paths, in the main checkout) and fix every NEW finding and every partly-fixed pass-1 finding whose cause file is in your list; screenshots are in /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/tickets/.0145-dogfood-review-2/shots/. Standing rulings (do not reopen): pills for single-line controls and chips, square entry cells round squares at radius n, icon-only buttons round, segmented pill, icon versus glyph (glyph box max(8px, 2n - 2c); a mark like a caret, tick or chevron is a glyph in ui-glyph, not a Phosphor icon), one fleet disabled recipe, field outline role at least 3:1, cards keep their level radius, the full-width toggle label, the slider thumb, agent-admin's uppercase provider headings. Do NOT edit scripts/dogfood-rules.json, the render or compose lint or dogfood-lint.md, except to delete an allowlist line your change clears; list every measurable rule in your report instead (a later lane adds them). Stay inside your file list; report a finding whose cause is outside it. Root n 5 / 6 / 7. Local gate, foreground, through gate_lock.py: npm run check, census, probe --strict, touched folders' unit and browser tests, the render lint, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots per fixed finding at 400 and 1000, light and dark, viewed, not committed. A one-line progress message after each major step. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed or not (why), exit codes, proposed rules.

## Closed

2026-10-14: merged as #1965
