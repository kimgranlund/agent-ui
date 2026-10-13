---
id: T-0130
title: "Docs demos overflow the right edge at 400px"
type: bug             # feature | bug | chore | spike | idea
status: ready
size: L2
priority: P2
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-13
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
At a 400px viewport several docs demo specimens overflow or break badly; seen in the T-0120 parity review and present before it.

## Scope (one brief paragraph, per the Inner loop rule)
On the docs site at 400px fix: the button demo form-actions row, the text-field demo fields, the first card demo card and the API attributes table overflowing the right edge, and the table demo breaking words mid-cell. Fix in the site demo and example files (site/**, the specimen content and its local layout), using row and column wrap, min-inline-size: 0 and an overflow-x container for genuinely wide tables; do not change a control's own CSS or site/pages/_page.css chrome rules. Evidence: before and after screenshots of each page at 400px and 1000px (1000px must not change) in the ticket folder, viewed; add one browser test that the document does not scroll horizontally at 400px on those pages. This lane merges after T-0121, so expect to rebase. Local gate: npm run check plus the touched folders' tests (browser files through gate_lock.py; a golden only with '<file> --update', the file filter before the flag, and only after viewing it). Regenerate generated files with their scripts, never by hand. Root is n 5 / 6 / 7 (heights 20 / 24 / 28). Two other lanes are running: stay out of the shell, page chrome and container CSS (T-0121) and out of control padding, badge, checkbox and scripts/generate-foundations.mjs (T-0122). Commit locally, do not push, no per-ticket verifier, no em dashes, report in one short message with exit codes.
