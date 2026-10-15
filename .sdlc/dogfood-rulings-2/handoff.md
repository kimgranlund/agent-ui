---
id: T-0143
title: "Dogfood rulings: a 3:1 field outline role, calendar content cap, 8px glyph floor, table pager outside the scroll frame"
type: feature        # feature | bug | chore | spike | idea
status: done
size: L3
priority: P1
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim's rulings 2026-10-13 after the T-0137 dogfood review: (1) add a field-boundary outline role tuned to at least 3:1 against the page in both themes (WCAG 1.4.11) and use it for the resting border of text-field, select, combo-box, and extend the same resting border to otp-field cells and textarea, which still read faint; (2) cap the calendar at a named content width (about 7 cells of 6n per row) and centre it beyond that, narrow layouts unchanged, as an append-only amendment to ADR-0105; (3) floor the glyph box at 8px, max(8px, 2n - 2c), so sm dot, more and info marks stay legible, md and lg unchanged; (4) the table demo's pager sits outside the horizontal scroll frame so only the table body scrolls at 400px and T-0130's overflow test still holds. Kept as is (no change): slider thumb and rail; icons inside a data-tier region stay 2n; agent-admin's uppercase provider headings stay (GH #727 superseded, note it on the issue text in the ADR amendment, do not comment on GitHub). Also fix the ui-row align=center root cause: Chromium maps the attribute to a centred text-align that every child inherits (zig-zag rows in the badge and icon demos); fix it in row.css or list.css.

## Scope (one brief paragraph, per the Inner loop rule)
Record (1), (3) and the GH #727 supersession as ADR-0245 Amendment 7 (append-only), and add P15 for the glyph floor and P16 for the 3:1 field outline to .sdlc/mathematical-design-system-review.md. Files: shared tokens (tokens.css and the generator for the glyph floor), text-field, select, combo-box, otp-field, textarea, calendar, row or list, table demo and site/lib/specimens.ts, ADR-0245 and ADR-0105. Another lane (T-0144, dogfood lint rules) edits scripts/dogfood-rules.json, the render and compose lint and dogfood-lint.md at the same time: do not touch those except to delete an allowlist line your change clears. Root n 5 / 6 / 7. Local gate, each in the foreground through gate_lock.py: npm run check, census, probe --strict, the touched folders' unit and browser tests, the render lint (site/pages/dogfood-render.browser.test.ts), then the shards your files touch; re-pin from resolve(); re-mint goldens one file at a time with '<file> --update' after viewing each; delete any dogfood allowlist line your change clears. Before and after screenshots of each visible change at 400 and 1000, light and dark, in the ticket folder, viewed, not committed. One-line progress message to the conductor after each major step; never wait on a background monitor. Commit locally, do not push, no per-ticket verifier, no em dashes.

## Closed

2026-10-13: merged as #1960
