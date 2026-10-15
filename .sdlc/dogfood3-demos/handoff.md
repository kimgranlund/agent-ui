---
id: T-0150
title: "Dogfood round 3: site demo fixes (toggle icons, backticks, specimen widths, avatar cluster and captions, badge and text demos, overlay triggers)"
type: bug             # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 3 of the dogfood fixes (Kim 2026-10-14: fan out the pass-2 findings, T-0145).

## Scope (one brief paragraph, per the Inner loop rule)
Your files: site/pages/{toggle,segmented-control,icon,avatar,badge,text,slider,drawer,toast,popover,timeline,card}-demo.ts, site/lib/specimens.ts, site/pages/containers.css. Fixes: toggle formatting icons match their labels (add text-b, text-italic, text-underline to the icon pack only if packages/agent-ui/icons is the right home and it is a small change, else pick the closest existing icons and say so); no raw backticks in demo text (use code()); specimen figures size from the specimen, not the caption, so size comparisons line up; avatar cluster gets a surface ring and at most a quarter overlap; product text never uses the mono .demo-caption; badge-demo caption matches what renders, rows align to start, no unscrollable cut at 400; text-demo overline sits closer to its heading than to the previous block; slider-demo prints the value once; overlay demos share one trigger emphasis and the widget gutter between triggers. Findings: read the ## Findings of /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/dogfood-review-2/part-{a,b,c}/ui-designer-L1.md (absolute paths, in the main checkout) and fix every NEW finding and every partly-fixed pass-1 finding whose cause file is in your list; screenshots are in /Users/kimgranlund/Projects/nonoun/agent-ui/.sdlc/dogfood-review-2/shots/. Standing rulings (do not reopen): pills for single-line controls and chips, square entry cells round squares at radius n, icon-only buttons round, segmented pill, icon versus glyph (glyph box max(8px, 2n - 2c); a mark like a caret, tick or chevron is a glyph in ui-glyph, not a Phosphor icon), one fleet disabled recipe, field outline role at least 3:1, cards keep their level radius, the full-width toggle label, the slider thumb, agent-admin's uppercase provider headings. Do NOT edit scripts/dogfood-rules.json, the render or compose lint or dogfood-lint.md, except to delete an allowlist line your change clears; list every measurable rule in your report instead (a later lane adds them). Stay inside your file list; report a finding whose cause is outside it. Root n 5 / 6 / 7. Local gate, foreground, through gate_lock.py: npm run check, census, probe --strict, touched folders' unit and browser tests, the render lint, then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each. Before and after screenshots per fixed finding at 400 and 1000, light and dark, viewed, not committed. A one-line progress message after each major step. Commit locally, do not push, no per-ticket verifier, no em dashes. Report: per finding fixed or not (why), exit codes, proposed rules.

## Closed

2026-10-14: merged as #1962
